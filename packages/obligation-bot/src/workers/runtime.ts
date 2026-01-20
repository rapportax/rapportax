import { runMultiAgentWorkflow } from "../worker";
import type { TodoCandidate, WorkerAssignment } from "../types";

export interface WorkerRunInput {
  candidate: TodoCandidate;
  assignment: WorkerAssignment;
  requestedByUserId?: string;
}

export interface WorkerRunResult {
  status: "ENQUEUED" | "FAILED";
  requestId?: string;
  error?: string;
}

export interface WorkerRuntime {
  run(input: WorkerRunInput): Promise<WorkerRunResult>;
}

export interface LocalWorkerRuntimeConfig {
  model?: string;
  maxTurns?: number;
  repoRoot?: string;
}

const buildContextLines = (input: WorkerRunInput): string => {
  const lines = [
    `CandidateId: ${input.candidate.id}`,
    `Source: ${input.candidate.source}`,
    `Reason: ${input.candidate.inferredReason}`,
    `RiskScore: ${input.candidate.riskScore}`,
    `WorkerId: ${input.assignment.workerId}`,
  ];

  if (input.requestedByUserId) {
    lines.push(`RequestedBy: ${input.requestedByUserId}`);
  }

  if (input.assignment.rationale.length > 0) {
    lines.push(`AssignmentRationale: ${input.assignment.rationale.join(" | ")}`);
  }

  return lines.join("\n");
};

export function createLocalWorkerRuntime(config: LocalWorkerRuntimeConfig = {}): WorkerRuntime {
  return {
    async run(input: WorkerRunInput): Promise<WorkerRunResult> {
      try {
        const result = await runMultiAgentWorkflow(
          {
            task: input.candidate.title,
            context: buildContextLines(input),
            constraints: ["개인정보 최소화", "자동 생성 금지", "사람 승인 절차 준수"],
            signals: input.assignment.rationale,
            requestedByUserId: input.requestedByUserId,
          },
          {
            model: config.model,
            maxTurns: config.maxTurns,
            repoRoot: config.repoRoot,
          },
        );

        return { status: "ENQUEUED", requestId: result.requestId };
      } catch (error) {
        return {
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
