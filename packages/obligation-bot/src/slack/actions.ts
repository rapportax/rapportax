import type { CandidateStatus } from "../storage/interfaces";

export type SlackActionType =
  | "EXECUTE"
  | "HOLD"
  | "IGNORE";

export interface SlackActionResult {
  action: SlackActionType;
  candidateId?: string;
  status?: CandidateStatus;
}

export function parseSlackActionId(actionId: string, value: string): SlackActionResult | null {
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
