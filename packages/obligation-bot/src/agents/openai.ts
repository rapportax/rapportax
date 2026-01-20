import OpenAI from "openai";
import type {
  ContextObject,
  ContextScannerOutput,
  DecisionOutput,
  DoneAssessment,
  RiskOutput,
} from "../types";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./interfaces";

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

function createClient(config: OpenAIConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
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

export class OpenAIContextScanner implements ContextScannerAgent {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = createClient(config);
  }

  async scan(context: ContextObject): Promise<ContextScannerOutput[]> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content: "Extract action hints from the event. Return JSON only.",
        },
        {
          role: "user",
          content: buildContextText(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "action_hints",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              hints: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    signalType: { type: "string", enum: ["ACTION_HINT"] },
                    sentence: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["signalType", "sentence", "confidence"],
                },
              },
            },
            required: ["hints"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 200,
      store: false,
    });

    const text = extractOutputText(response);
    const parsed = JSON.parse(text) as { hints: ContextScannerOutput[] };
    return parsed.hints ?? [];
  }
}

export class OpenAIDoneAssessor implements DoneAssessor {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = createClient(config);
  }

  async assess(context: ContextObject): Promise<DoneAssessment> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content:
            "Decide if the obligation implied by this event is already done. Return JSON only.",
        },
        {
          role: "user",
          content: buildContextText(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "done_assessment",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              isDone: { type: "boolean" },
              rationale: { type: "array", items: { type: "string" } },
            },
            required: ["isDone", "rationale"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 120,
      store: false,
    });

    const text = extractOutputText(response);
    return JSON.parse(text) as DoneAssessment;
  }
}

export class OpenAIDecisionAgent implements DecisionAgent {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = createClient(config);
  }

  async decide(context: ContextObject, signals: ContextScannerOutput[]): Promise<DecisionOutput> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content:
            "Decide whether to PROPOSE, HOLD, or IGNORE a TODO candidate based on the event and signals. Return JSON only.",
        },
        {
          role: "user",
          content: `${buildContextText(context)}\n\nsignals: ${JSON.stringify(signals)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "decision",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              decision: { type: "string", enum: ["PROPOSE", "HOLD", "IGNORE"] },
              rationale: { type: "array", items: { type: "string" } },
            },
            required: ["decision", "rationale"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 160,
      store: false,
    });

    const text = extractOutputText(response);
    return JSON.parse(text) as DecisionOutput;
  }
}

export class OpenAIRiskAgent implements RiskAgent {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = createClient(config);
  }

  async score(context: ContextObject): Promise<RiskOutput> {
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        {
          role: "system",
          content: "Score risk of not doing this obligation. Return JSON only.",
        },
        {
          role: "user",
          content: buildContextText(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "risk",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              riskScore: { type: "number" },
              impact: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              reason: { type: "string" },
            },
            required: ["riskScore", "impact", "reason"],
          },
          strict: true,
        },
      },
      temperature: 0.2,
      max_output_tokens: 120,
      store: false,
    });

    const text = extractOutputText(response);
    return JSON.parse(text) as RiskOutput;
  }
}
