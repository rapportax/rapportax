import type { SlackEventEnvelope, TodoCandidate } from "./types";
import type { CandidateRepository, DecisionLogRepository } from "./storage/interfaces";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./agents/interfaces";
import { normalizeSlackEvent } from "./normalize/slack";
import { ObligationPipeline } from "./pipeline";
import { parseSlackActionId } from "./slack/actions";

export interface ObligationServiceDeps {
  contextScanner: ContextScannerAgent;
  decisionAgent: DecisionAgent;
  doneAssessor: DoneAssessor;
  riskAgent?: RiskAgent;
  candidateRepository: CandidateRepository;
  decisionLogRepository: DecisionLogRepository;
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

  async handleSlackAction(actionId: string, value: string): Promise<void> {
    const parsed = parseSlackActionId(actionId, value);
    if (!parsed) {
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
}
