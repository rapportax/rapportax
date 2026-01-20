export type AdminEndpoint =
  | "grant_pro_plan"
  | "update_org_tier"
  | "update_org_credit";

export const ADMIN_ENDPOINTS: Record<AdminEndpoint, string> = {
  grant_pro_plan: "/api/admin/users/{userId}/plan/grant",
  update_org_tier: "/api/admin/orgs/{orgId}/tier/update",
  update_org_credit: "/api/admin/orgs/{orgId}/credit/update",
};

export function resolveEndpoint(
  endpoint: AdminEndpoint,
  params: Record<string, string>,
): string {
  const template = ADMIN_ENDPOINTS[endpoint];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return params[key] ?? `{${key}}`;
  });
}
