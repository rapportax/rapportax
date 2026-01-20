import { randomUUID } from "crypto";
import type { CandidateResult, ContextObject, DecisionLog, SourceType, TodoCandidate } from "./types";
import type { CandidateRepository, CandidateStatus, DecisionLogRepository } from "./storage/interfaces";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./agents/interfaces";
import { ObligationPipeline } from "./pipeline";
import type { ExecutorResult, ExecutorService } from "./executor/service";

export interface ObligationServiceDeps {
  contextScanner: ContextScannerAgent;
  decisionAgent: DecisionAgent;
  doneAssessor: DoneAssessor;
  riskAgent?: RiskAgent;
  candidateRepository: CandidateRepository;
  decisionLogRepository: DecisionLogRepository;
  executorService?: ExecutorService;
}

export class ObligationService {
  private readonly pipeline: ObligationPipeline;

  constructor(private readonly deps: ObligationServiceDeps) {
    this.pipeline = new ObligationPipeline({
      contextScanner: deps.contextScanner,
      decisionAgent: deps.decisionAgent,
      doneAssessor: deps.doneAssessor,
      riskAgent: deps.riskAgent,
      candidateRepository: deps.candidateRepository,
      decisionLogRepository: deps.decisionLogRepository,
    });
  }

  async runDecisionPipeline(context: ContextObject): Promise<CandidateResult> {
    return this.pipeline.run(context);
  }

  async listCandidates(): Promise<TodoCandidate[]> {
    return this.deps.candidateRepository.listOpen();
  }

  async createObligation(input: {
    title: string;
    source?: SourceType;
    inferredReason?: string;
    riskScore?: number;
    suggestedOwner?: string;
  }): Promise<TodoCandidate> {
    const candidate: TodoCandidate = {
      id: randomUUID(),
      title: input.title,
      source: input.source ?? "webhook",
      inferredReason: input.inferredReason ?? "Manually created obligation",
      riskScore: input.riskScore ?? 0,
      suggestedOwner: input.suggestedOwner,
      decisionLog: [],
    };

    await this.deps.candidateRepository.create(candidate);
    await this.deps.decisionLogRepository.append(
      {
        actor: "HUMAN",
        action: "CREATE",
        reason: "API create",
        timestamp: new Date(),
      },
      candidate.id,
    );

    return candidate;
  }

  async recordDecision(
    candidateId: string,
    status: CandidateStatus,
    action: DecisionLog["action"],
    reason: string,
  ): Promise<void> {
    await this.deps.candidateRepository.updateStatus(candidateId, status);
    await this.deps.decisionLogRepository.append(
      {
        actor: "HUMAN",
        action,
        reason,
        timestamp: new Date(),
      },
      candidateId,
    );
  }

  async executeCandidate(candidateId: string, requestedByUserId?: string): Promise<ExecutorResult> {
    if (!this.deps.executorService) {
      return { status: "FAILED", error: "Executor service not configured" };
    }
    return this.deps.executorService.executeCandidate(candidateId, requestedByUserId);
  }
}
