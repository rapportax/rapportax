import type {
  ContextObject,
  ContextScannerOutput,
  DecisionOutput,
  DoneAssessment,
  RiskOutput,
} from "../types";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./interfaces";

export class NoopContextScanner implements ContextScannerAgent {
  async scan(_context: ContextObject): Promise<ContextScannerOutput[]> {
    return [];
  }
}

export class NoopDecisionAgent implements DecisionAgent {
  async decide(_context: ContextObject, _signals: ContextScannerOutput[]): Promise<DecisionOutput> {
    return {
      decision: "HOLD",
      rationale: ["No decision agent configured."],
    };
  }
}

export class NoopDoneAssessor implements DoneAssessor {
  async assess(_context: ContextObject): Promise<DoneAssessment> {
    return {
      isDone: false,
      rationale: ["No done assessor configured."],
    };
  }
}

export class NoopRiskAgent implements RiskAgent {
  async score(_context: ContextObject): Promise<RiskOutput> {
    return {
      riskScore: 0,
      impact: "LOW",
      reason: "No risk agent configured.",
    };
  }
}
