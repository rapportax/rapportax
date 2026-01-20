export type AdminCommandType =
  | "grant_pro_plan"
  | "update_org_tier"
  | "update_org_credit";

export interface AdminCommand {
  type: AdminCommandType;
  params: Record<string, string>;
}

function parseArgs(tokens: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.startsWith("--")) {
      const [key, inlineValue] = token.slice(2).split("=");
      if (inlineValue !== undefined) {
        params[key] = inlineValue;
        i += 1;
        continue;
      }
      const next = tokens[i + 1];
      if (next && !next.startsWith("--")) {
        params[key] = next;
        i += 2;
        continue;
      }
      params[key] = "";
      i += 1;
      continue;
    }
    i += 1;
  }
  return params;
}

export function parseAdminCommand(rawCommand: string): AdminCommand | null {
  const tokens = rawCommand.trim().split(/\s+/);
  if (tokens.length === 0) {
    return null;
  }

  const [scope, action, ...rest] = tokens;
  if (!scope || !action) {
    return null;
  }

  if (scope === "pro-plan" && action === "grant") {
    return { type: "grant_pro_plan", params: parseArgs(rest) };
  }

  if (scope === "org-tier" && action === "fix") {
    return { type: "update_org_tier", params: parseArgs(rest) };
  }

  if (scope === "org-credit" && action === "fix") {
    return { type: "update_org_credit", params: parseArgs(rest) };
  }

  return null;
}
