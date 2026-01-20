export type SourceType = "slack" | "webhook" | "system";

export interface EventInput {
  source: SourceType;
  eventId: string;
  timestamp: string;
  payload: unknown;
}

export interface ContextObject {
  event: EventInput;
  normalizedText?: string;
  metadata: Record<string, string>;
  recentSignals?: string[];
}

export interface AdminExecCandidate {
  id: string;
  title: string;
  source: string;
  inferredReason: string;
  riskScore: number;
  suggestedOwner?: string;
}

export interface DecisionLog {
  actor: "HUMAN" | "AI";
  action: "CREATE" | "HOLD" | "IGNORE";
  reason: string;
  timestamp: Date;
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

export interface DecisionLogRepository {
  append(entry: DecisionLog, candidateId?: string): Promise<void>;
}

export interface AdminExecRequestRepository {
  create(request: AdminExecRequest): Promise<void>;
  listPending(): Promise<AdminExecRequest[]>;
  listPendingByCandidate(candidateId: string): Promise<AdminExecRequest[]>;
  updateStatus(id: string, status: AdminExecStatus): Promise<void>;
  getById(id: string): Promise<AdminExecRequest | null>;
}
