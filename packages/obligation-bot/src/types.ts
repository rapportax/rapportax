export type SourceType = "slack" | "webhook" | "system";

export interface EventInput {
  source: SourceType;
  eventId: string;
  timestamp: string;
  payload: unknown;
}

export interface SlackEventEnvelope {
  event_id: string;
  event_time: number;
  type: "event_callback";
  event: {
    type: "message" | "app_mention" | "reaction_added";
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
  };
}

export interface ContextObject {
  event: EventInput;
  normalizedText?: string;
  metadata: Record<string, string>;
  recentSignals?: string[];
}

export interface ContextScannerOutput {
  signalType: "ACTION_HINT";
  sentence: string;
  confidence: number;
}

export interface StateChangeOutput {
  trigger: "DEPLOY";
  inferredObligation: string;
}

export interface RiskOutput {
  riskScore: number;
  impact: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

export interface DependencyOutput {
  isDuplicate: boolean;
  blockingTaskIds?: string[];
}

export interface OwnershipOutput {
  ownerType: "USER" | "TEAM";
  ownerId: string;
  confidence: number;
}

export interface DecisionOutput {
  decision: "PROPOSE" | "HOLD" | "IGNORE";
  rationale: string[];
}

export interface DecisionLog {
  actor: "HUMAN" | "AI";
  action: "CREATE" | "HOLD" | "IGNORE" | "EXECUTE";
  reason: string;
  timestamp: Date;
}

export interface TodoCandidate {
  id: string;
  title: string;
  source: string;
  inferredReason: string;
  riskScore: number;
  suggestedOwner?: string;
  decisionLog: DecisionLog[];
}

export interface WorkerDefinition {
  id: string;
  name: string;
  description?: string;
  capabilityTags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface WorkerAssignment {
  workerId: string;
  confidence: number;
  rationale: string[];
}

export interface DoneAssessment {
  isDone: boolean;
  rationale: string[];
}

export interface CandidateResult {
  candidate?: TodoCandidate;
  decision: DecisionOutput;
  done: DoneAssessment;
}

export type AdminExecStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";

export type AdminActionType =
  | "grant_pro_plan"
  | "update_org_tier"
  | "update_org_credit"
  | "assign_org"
  | "none";

export interface AdminExecRequest {
  id: string;
  candidateId: string;
  status: AdminExecStatus;
  actionType: AdminActionType;
  requestedByUserId?: string;
  targetUserId?: string;
  targetOrgId?: string;
  payload?: Record<string, unknown>;
  rationale?: string;
}
