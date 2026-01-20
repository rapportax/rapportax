import type { Actor } from "../index";
import type { AuditLogger } from "../logging/audit";
import type { AdminApiClient } from "../admin-api/client";
import { parseAdminCommand } from "./commands";

const REQUIRED_SCOPE: Record<string, string> = {
  grant_pro_plan: "PERSONAL_PLAN_ADMIN",
  update_org_tier: "ORG_ADMIN",
  update_org_credit: "ORG_ADMIN",
};

export interface SlackCommandContext {
  rawText: string;
  actor: Actor;
  authSessionId?: string;
  auditLogger: AuditLogger;
  adminApi: AdminApiClient;
}

export async function handleSlackCommand(
  context: SlackCommandContext,
): Promise<{ ok: boolean; message: string }> {
  const command = parseAdminCommand(context.rawText);
  if (!command) {
    return { ok: false, message: "unknown_command" };
  }

  if (!context.authSessionId) {
    return { ok: false, message: "unauthorized" };
  }

  const requiredScope = REQUIRED_SCOPE[command.type];
  if (!context.actor.scopes.includes(requiredScope as never)) {
    return { ok: false, message: "forbidden" };
  }

  const response = await context.adminApi.request(
    command.type,
    command.params,
    command.params,
  );

  if (!response.ok) {
    await context.auditLogger.append({
      id: crypto.randomUUID(),
      action: "EXECUTE",
      actorId: context.actor.id,
      command: command.type,
      params: command.params,
      createdAt: new Date(),
      result: "FAILURE",
      error: response.error ?? "admin_api_error",
    });
    return { ok: false, message: response.error ?? "admin_api_error" };
  }

  await context.auditLogger.append({
    id: crypto.randomUUID(),
    action: "EXECUTE",
    actorId: context.actor.id,
    command: command.type,
    params: command.params,
    createdAt: new Date(),
    result: "SUCCESS",
  });

  return { ok: true, message: "ok" };
}
