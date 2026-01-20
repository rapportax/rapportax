import type { CandidateStatus } from "../storage/interfaces";

export type SlackActionType =
  | "EXECUTE"
  | "HOLD"
  | "IGNORE"
  | "ADMIN_EXECUTE"
  | "ADMIN_APPROVE"
  | "ADMIN_REJECT";

export interface SlackActionResult {
  action: SlackActionType;
  candidateId?: string;
  requestId?: string;
  status?: CandidateStatus;
}

export function parseSlackActionId(actionId: string, value: string): SlackActionResult | null {
  if (actionId.startsWith("execute_admin_")) {
    return { action: "ADMIN_EXECUTE", candidateId: value };
  }
  if (actionId.startsWith("approve_admin_")) {
    return { action: "ADMIN_APPROVE", requestId: value };
  }
  if (actionId.startsWith("reject_admin_")) {
    return { action: "ADMIN_REJECT", requestId: value };
  }
  if (actionId.startsWith("execute_")) {
    return { action: "EXECUTE", candidateId: value, status: "EXECUTED" };
  }
  if (actionId.startsWith("hold_")) {
    return { action: "HOLD", candidateId: value, status: "HELD" };
  }
  if (actionId.startsWith("ignore_")) {
    return { action: "IGNORE", candidateId: value, status: "IGNORED" };
  }

  return null;
}
