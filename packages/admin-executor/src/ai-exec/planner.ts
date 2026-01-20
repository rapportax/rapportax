import { Agent, run } from "@openai/agents";
import type { ContextObject } from "./types";
import type { AdminActionType } from "./types";

export interface OpenAIConfig {
  model: string;
  baseURL?: string;
}

export interface AdminTargetExtraction {
  targetType: "user" | "org" | "unknown";
  userId?: string | null;
  orgId?: string | null;
  intent: AdminActionType | "unknown";
  desired?: {
    plan?: string | null;
    tier?: string | null;
    credit?: number | null;
    creditDelta?: number | null;
    orgId?: string | null;
  } | null;
}

export interface AdminExecutionPlan {
  actionType: AdminActionType;
  params: Record<string, string>;
  payload?: Record<string, unknown>;
  rationale: string[];
}

export class OpenAIAdminPlanner {
  private readonly targetAgent: Agent;
  private readonly planAgent: Agent;

  constructor(private readonly config: OpenAIConfig) {
    if (config.baseURL) {
      process.env.OPENAI_BASE_URL = config.baseURL;
    }
    this.targetAgent = new Agent({
      name: "AdminTargetExtractor",
      instructions:
        "Extract admin execution intent and target identifiers from the event. Return JSON with keys { targetType, userId, orgId, intent, desired }. Include all keys; use null if unknown.",
      model: config.model,
    });
    this.planAgent = new Agent({
      name: "AdminPlanner",
      instructions:
        "Decide which admin API action to execute based on target and current state. Return JSON with keys { actionType, params, payload, rationale }. Include all keys; use null if unknown.",
      model: config.model,
    });
  }

  async extractTarget(context: ContextObject): Promise<AdminTargetExtraction> {
    const result = await run(this.targetAgent, buildContextText(context));
    const parsed = safeJsonParse(result.finalOutput);
    return {
      targetType: normalizeTargetType(parsed.targetType),
      userId: parsed.userId ? String(parsed.userId) : null,
      orgId: parsed.orgId ? String(parsed.orgId) : null,
      intent: normalizeIntent(parsed.intent),
      desired: parsed.desired ? (parsed.desired as AdminTargetExtraction["desired"]) : null,
    };
  }

  async decidePlan(
    context: ContextObject,
    target: AdminTargetExtraction,
    stateSnapshot: unknown,
  ): Promise<AdminExecutionPlan> {
    const input = [
      buildContextText(context),
      `target: ${JSON.stringify(target)}`,
      `state: ${JSON.stringify(stateSnapshot)}`,
    ].join("\n");
    const result = await run(this.planAgent, input);
    const parsed = safeJsonParse(result.finalOutput);

    const actionType = normalizeActionType(parsed.actionType);
    const params = typeof parsed.params === "object" && parsed.params ? (parsed.params as Record<string, string>) : {};
    const payload = typeof parsed.payload === "object" && parsed.payload ? (parsed.payload as Record<string, unknown>) : undefined;
    const rationale = Array.isArray(parsed.rationale)
      ? parsed.rationale.map((item: unknown) => String(item))
      : parsed.rationale
        ? [String(parsed.rationale)]
        : [];

    return { actionType, params, payload, rationale };
  }
}

function buildContextText(context: ContextObject): string {
  const lines: string[] = [];
  lines.push(`source: ${context.event.source}`);
  lines.push(`eventId: ${context.event.eventId}`);
  lines.push(`timestamp: ${context.event.timestamp}`);
  if (context.normalizedText) {
    lines.push(`text: ${context.normalizedText}`);
  }
  if (context.metadata && Object.keys(context.metadata).length > 0) {
    lines.push(`metadata: ${JSON.stringify(context.metadata)}`);
  }
  if (context.recentSignals && context.recentSignals.length > 0) {
    lines.push(`recentSignals: ${context.recentSignals.join(" | ")}`);
  }
  return lines.join("\n");
}

function safeJsonParse(text: unknown): Record<string, unknown> {
  if (typeof text !== "string") {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeTargetType(value: unknown): AdminTargetExtraction["targetType"] {
  if (value === "user" || value === "org" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function normalizeIntent(value: unknown): AdminTargetExtraction["intent"] {
  if (
    value === "grant_pro_plan" ||
    value === "update_org_tier" ||
    value === "update_org_credit" ||
    value === "assign_org" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeActionType(value: unknown): AdminExecutionPlan["actionType"] {
  if (
    value === "grant_pro_plan" ||
    value === "update_org_tier" ||
    value === "update_org_credit" ||
    value === "assign_org" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}
