import type { AdminActionType } from "./types";

export interface ToolDefinition {
  actionType: Exclude<AdminActionType, "none">;
  requiredParams: Array<"userId" | "orgId">;
  requiredPayloadKeys?: string[];
  optionalPayloadKeys?: string[];
}

export const ADMIN_TOOL_REGISTRY: ToolDefinition[] = [
  {
    actionType: "grant_pro_plan",
    requiredParams: ["userId"],
    requiredPayloadKeys: ["plan"],
    optionalPayloadKeys: [],
  },
  {
    actionType: "update_org_tier",
    requiredParams: ["orgId"],
    requiredPayloadKeys: ["tier"],
    optionalPayloadKeys: [],
  },
  {
    actionType: "update_org_credit",
    requiredParams: ["orgId"],
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["credit", "creditDelta"],
  },
  {
    actionType: "assign_org",
    requiredParams: ["userId"],
    requiredPayloadKeys: ["orgId"],
    optionalPayloadKeys: [],
  },
];

export function getToolDefinition(actionType: AdminActionType): ToolDefinition | null {
  if (actionType === "none") return null;
  return ADMIN_TOOL_REGISTRY.find((tool) => tool.actionType === actionType) ?? null;
}
