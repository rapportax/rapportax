import OpenAI from "openai";
import type { ContextObject } from "../types";
import type { AdminActionType } from "../types";

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AdminTargetExtraction {
  targetType: "user" | "org" | "unknown";
  userId?: string;
  orgId?: string;
  intent: AdminActionType | "unknown";
  desired?: {
    plan?: string;
    tier?: string;
    credit?: number;
    creditDelta?: number;
    orgId?: string;
  };
}

export interface AdminExecutionPlan {
  actionType: AdminActionType;
  params: Record<string, string>;
  payload?: Record<string, unknown>;
  rationale: string[];
}

export class OpenAIAdminPlanner {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }

  async extractTarget(context: ContextObject): Promise<AdminTargetExtraction> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content:
            "Extract admin execution intent and target identifiers from the event. Return JSON only.",
        },
        {
          role: "user",
          content: buildContextText(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "admin_target",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              targetType: { type: "string", enum: ["user", "org", "unknown"] },
              userId: { type: "string" },
              orgId: { type: "string" },
              intent: {
                type: "string",
                enum: [
                  "grant_pro_plan",
                  "update_org_tier",
                  "update_org_credit",
                  "assign_org",
                  "unknown",
                ],
              },
              desired: {
                type: "object",
                additionalProperties: false,
                properties: {
                  plan: { type: "string" },
                  tier: { type: "string" },
                  credit: { type: "number" },
                  creditDelta: { type: "number" },
                  orgId: { type: "string" },
                },
              },
            },
            required: ["targetType", "intent"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 200,
      store: false,
    });

    const text = extractOutputText(response);
    return JSON.parse(text) as AdminTargetExtraction;
  }

  async decidePlan(
    context: ContextObject,
    target: AdminTargetExtraction,
    stateSnapshot: unknown,
  ): Promise<AdminExecutionPlan> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content:
            "Decide which admin API action to execute based on target and current state. Return JSON only.",
        },
        {
          role: "user",
          content: [
            buildContextText(context),
            `target: ${JSON.stringify(target)}`,
            `state: ${JSON.stringify(stateSnapshot)}`,
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "admin_plan",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              actionType: {
                type: "string",
                enum: ["grant_pro_plan", "update_org_tier", "update_org_credit", "assign_org", "none"],
              },
              params: {
                type: "object",
                additionalProperties: { type: "string" },
              },
              payload: {
                type: "object",
                additionalProperties: true,
              },
              rationale: { type: "array", items: { type: "string" } },
            },
            required: ["actionType", "params", "rationale"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 240,
      store: false,
    });

    const text = extractOutputText(response);
    return JSON.parse(text) as AdminExecutionPlan;
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

function extractOutputText(response: unknown): string {
  const anyResponse = response as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof anyResponse.output_text === "string") {
    return anyResponse.output_text;
  }

  const output = anyResponse.output ?? [];
  for (const item of output) {
    if (item.type !== "message") {
      continue;
    }
    const content = item.content ?? [];
    for (const part of content) {
      if (part.type === "output_text" && part.text) {
        return part.text;
      }
    }
  }

  return "{}";
}
