import type { AdminExecutionPlan } from "./planner";
import type { ToolDefinition } from "./registry";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validatePlan(plan: AdminExecutionPlan, tool: ToolDefinition | null): ValidationResult {
  const errors: string[] = [];

  if (!tool) {
    errors.push("Unknown tool definition");
    return { ok: false, errors };
  }

  for (const param of tool.requiredParams) {
    if (!plan.params?.[param]) {
      errors.push(`Missing required param: ${param}`);
    }
  }

  if (tool.requiredPayloadKeys) {
    for (const key of tool.requiredPayloadKeys) {
      if (!plan.payload || plan.payload[key] === undefined || plan.payload[key] === null) {
        errors.push(`Missing required payload: ${key}`);
      }
    }
  }

  if (tool.actionType === "update_org_credit") {
    const credit = plan.payload?.credit;
    const delta = plan.payload?.creditDelta;
    const hasCredit = credit !== undefined && credit !== null;
    const hasDelta = delta !== undefined && delta !== null;

    if (!hasCredit && !hasDelta) {
      errors.push("Missing payload: credit or creditDelta required");
    }

    if (hasCredit && hasDelta) {
      errors.push("Only one of credit or creditDelta is allowed");
    }

    if (hasCredit && typeof credit !== "number") {
      errors.push("Invalid payload type: credit must be number");
    }
    if (hasDelta && typeof delta !== "number") {
      errors.push("Invalid payload type: creditDelta must be number");
    }
  }

  return { ok: errors.length === 0, errors };
}
