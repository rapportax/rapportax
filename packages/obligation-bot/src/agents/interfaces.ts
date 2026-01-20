import type {
  ContextObject,
  ContextScannerOutput,
  DecisionOutput,
  DoneAssessment,
  RiskOutput,
} from "../types";

export interface ContextScannerAgent {
  scan(context: ContextObject): Promise<ContextScannerOutput[]>;
}

export interface DecisionAgent {
  decide(context: ContextObject, signals: ContextScannerOutput[]): Promise<DecisionOutput>;
}

export interface DoneAssessor {
  assess(context: ContextObject): Promise<DoneAssessment>;
}

export interface RiskAgent {
  score(context: ContextObject): Promise<RiskOutput>;
}
