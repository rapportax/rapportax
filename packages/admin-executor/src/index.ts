export type PermissionScope = "ORG_ADMIN" | "PERSONAL_PLAN_ADMIN";

export interface Actor {
  id: string;
  displayName?: string;
  scopes: PermissionScope[];
}

export interface AdminCommandRequest {
  rawCommand: string;
  actor: Actor;
}

export interface AdminCommandResult {
  ok: boolean;
  message: string;
  auditId?: string;
}

export * from "./auth/idPassword";
export * from "./admin-api/client";
export * from "./admin-api/endpoints";
export * from "./logging/audit";
export * from "./slack/commands";
export * from "./slack/handlers";
