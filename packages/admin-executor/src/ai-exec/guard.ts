import type { AdminExecutionPlan } from "./planner";
import type { ToolDefinition } from "./registry";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validatePlan(plan: AdminExecutionPlan, tool: ToolDefinition | null): ValidationResult {
  if (!tool) {
    return { ok: false, errors: ["no_matching_tool"] };
  }

  const errors: string[] = [];
  for (const key of tool.requiredParams) {
    if (!plan.params?.[key]) {
      errors.push(`missing_param:${key}`);
    }
  }

  if (tool.requiredPayloadKeys) {
    for (const key of tool.requiredPayloadKeys) {
      if (!plan.payload || plan.payload[key] === undefined) {
        errors.push(`missing_payload:${key}`);
      }
    }
  }

  if (tool.actionType === "update_org_credit") {
    const hasCredit = plan.payload?.credit !== undefined;
    const hasDelta = plan.payload?.creditDelta !== undefined;
    if (hasCredit && hasDelta) {
      errors.push("credit_conflict");
    }
  }

  return { ok: errors.length === 0, errors };
}
