import { randomUUID } from "crypto";
import type { CandidateResult, ContextObject, DecisionLog, TodoCandidate, WorkerDefinition } from "./types";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./agents/interfaces";
import { assignWorker } from "./triage/worker-assignment";
import type { CandidateRepository, DecisionLogRepository } from "./storage/interfaces";

export interface PipelineDeps {
  contextScanner: ContextScannerAgent;
  decisionAgent: DecisionAgent;
  doneAssessor: DoneAssessor;
  riskAgent?: RiskAgent;
  candidateRepository?: CandidateRepository;
  decisionLogRepository?: DecisionLogRepository;
  workers?: WorkerDefinition[];
}

export class ObligationPipeline {
  constructor(private readonly deps: PipelineDeps) {}

  async run(context: ContextObject): Promise<CandidateResult> {
    const signals = await this.deps.contextScanner.scan(context);
    const decision = await this.deps.decisionAgent.decide(context, signals);
    const done = await this.deps.doneAssessor.assess(context);

    if (done.isDone || decision.decision !== "PROPOSE") {
      await this.appendDecisionLog({
        actor: "AI",
        action: decision.decision === "PROPOSE" ? "HOLD" : decision.decision,
        reason: done.isDone ? "Marked done by AI." : decision.rationale.join(" | "),
        timestamp: new Date(),
      });

      return { decision, done };
    }

    const risk = this.deps.riskAgent ? await this.deps.riskAgent.score(context) : undefined;
    const candidate = this.buildCandidate(context, decision, risk?.riskScore ?? 0);
    if (this.deps.candidateRepository) {
      await this.deps.candidateRepository.create(candidate);
    }

    await this.appendDecisionLog({
      actor: "AI",
      action: "CREATE",
      reason: decision.rationale.join(" | "),
      timestamp: new Date(),
    });

    return { candidate, decision, done };
  }

  assignWorker(candidate: TodoCandidate): ReturnType<typeof assignWorker> {
    return assignWorker(this.deps.workers ?? [], {
      title: candidate.title,
      tags: [],
    });
  }

  private buildCandidate(
    context: ContextObject,
    decision: { rationale: string[] },
    riskScore: number,
  ): TodoCandidate {
    return {
      id: randomUUID(),
      title: context.normalizedText ?? "Untitled obligation",
      source: context.event.source,
      inferredReason: decision.rationale.join(" | "),
      riskScore,
      decisionLog: [],
    };
  }

  private async appendDecisionLog(entry: DecisionLog): Promise<void> {
    if (!this.deps.decisionLogRepository) {
      return;
    }

    await this.deps.decisionLogRepository.append(entry);
  }
}
