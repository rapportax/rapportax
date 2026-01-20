import type { AdminActionType } from "../types";

export type AdminEndpoint = Exclude<AdminActionType, "none">;

const ADMIN_ENDPOINTS: Record<AdminEndpoint, string> = {
  grant_pro_plan: "/api/admin/users/{userId}/plan/grant",
  update_org_tier: "/api/admin/orgs/{orgId}/tier/update",
  update_org_credit: "/api/admin/orgs/{orgId}/credit/update",
  assign_org: "/api/admin/users/{userId}/org/assign",
};

export function resolveAdminEndpoint(endpoint: AdminEndpoint, params: Record<string, string>): string {
  const template = ADMIN_ENDPOINTS[endpoint];
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}
