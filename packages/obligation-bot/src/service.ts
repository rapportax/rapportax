import { randomUUID } from "crypto";
import type { SlackEventEnvelope, SourceType, TodoCandidate } from "./types";
import type { CandidateRepository, DecisionLogRepository } from "./storage/interfaces";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./agents/interfaces";
import { normalizeSlackEvent } from "./normalize/slack";
import { ObligationPipeline } from "./pipeline";
import { parseSlackActionId } from "./slack/actions";
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

  async handleSlackEvent(envelope: SlackEventEnvelope): Promise<void> {
    const context = normalizeSlackEvent(envelope);
    await this.pipeline.run(context);
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

  async handleSlackAction(actionId: string, value: string, requestedByUserId?: string): Promise<void> {
    const parsed = parseSlackActionId(actionId, value);
    if (!parsed) {
      return;
    }

    if (parsed.action === "EXECUTE" && parsed.candidateId && this.deps.executorService) {
      await this.deps.executorService.executeCandidate(parsed.candidateId, requestedByUserId);
      return;
    }

    if (parsed.candidateId && parsed.status) {
      await this.deps.candidateRepository.updateStatus(parsed.candidateId, parsed.status);
      await this.deps.decisionLogRepository.append(
        {
          actor: "HUMAN",
          action: parsed.action,
          reason: `Slack action: ${parsed.action}`,
          timestamp: new Date(),
        },
        parsed.candidateId,
      );
    }
  }

  async executeCandidate(candidateId: string, requestedByUserId?: string): Promise<ExecutorResult> {
    if (!this.deps.executorService) {
      return { status: "FAILED", error: "Executor service not configured" };
    }
    return this.deps.executorService.executeCandidate(candidateId, requestedByUserId);
  }
}
