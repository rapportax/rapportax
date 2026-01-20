import type { CandidateRepository, DecisionLogRepository } from "../storage/interfaces";
import { assignWorker } from "../triage/worker-assignment";
import type { TodoCandidate, WorkerAssignment, WorkerDefinition } from "../types";
import type { WorkerRuntime } from "../workers/runtime";

export interface ExecutorServiceDeps {
  candidateRepository: CandidateRepository;
  decisionLogRepository: DecisionLogRepository;
  workerRuntime: WorkerRuntime;
  workers: WorkerDefinition[];
}

export type ExecutorStatus = "ENQUEUED" | "FAILED" | "NOT_FOUND" | "NO_WORKER";

export interface ExecutorResult {
  status: ExecutorStatus;
  requestId?: string;
  error?: string;
  assignment?: WorkerAssignment;
}

export class ExecutorService {
  constructor(private readonly deps: ExecutorServiceDeps) {}

  async executeCandidate(candidateId: string, requestedByUserId?: string): Promise<ExecutorResult> {
    const candidate = await this.findCandidate(candidateId);
    if (!candidate) {
      return { status: "NOT_FOUND" };
    }

    const assignment = assignWorker(this.deps.workers, { title: candidate.title, tags: [] });
    if (assignment.workerId === "HOLD") {
      await this.deps.decisionLogRepository.append(
        {
          actor: "HUMAN",
          action: "HOLD",
          reason: `No worker available: ${assignment.rationale.join(" | ")}`,
          timestamp: new Date(),
        },
        candidate.id,
      );
      return { status: "NO_WORKER", assignment };
    }

    const result = await this.deps.workerRuntime.run({
      candidate,
      assignment,
      requestedByUserId,
    });

    if (result.status === "ENQUEUED") {
      await this.deps.candidateRepository.updateStatus(candidate.id, "EXECUTED");
      await this.deps.decisionLogRepository.append(
        {
          actor: "HUMAN",
          action: "EXECUTE",
          reason: `Executor enqueued (${assignment.workerId})`,
          timestamp: new Date(),
        },
        candidate.id,
      );
      return { status: "ENQUEUED", requestId: result.requestId, assignment };
    }

    await this.deps.decisionLogRepository.append(
      {
        actor: "HUMAN",
        action: "HOLD",
        reason: `Executor failed: ${result.error ?? "unknown error"}`,
        timestamp: new Date(),
      },
      candidate.id,
    );

    return { status: "FAILED", error: result.error, assignment };
  }

  private async findCandidate(candidateId: string): Promise<TodoCandidate | null> {
    const candidates = await this.deps.candidateRepository.listOpen();
    return candidates.find((candidate) => candidate.id === candidateId) ?? null;
  }
}
