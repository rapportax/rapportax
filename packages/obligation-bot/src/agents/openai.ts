import { Agent, run } from "@openai/agents";
import type {
  ContextObject,
  ContextScannerOutput,
  DecisionOutput,
  DoneAssessment,
  RiskOutput,
} from "../types";
import type { ContextScannerAgent, DecisionAgent, DoneAssessor, RiskAgent } from "./interfaces";

export interface OpenAIConfig {
  model: string;
  baseURL?: string;
}

function ensureBaseUrl(baseURL?: string): void {
  if (baseURL) {
    process.env.OPENAI_BASE_URL = baseURL;
  }
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

function normalizeRationale(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [String(value)];
}

export class OpenAIContextScanner implements ContextScannerAgent {
  private readonly agent: Agent;

  constructor(private readonly config: OpenAIConfig) {
    ensureBaseUrl(config.baseURL);
    this.agent = new Agent({
      name: "ContextScanner",
      instructions:
        "Extract action hints from the event. Return JSON with { hints: [{ signalType, sentence, confidence }] }. Include all keys; use null if unknown.",
      model: config.model,
    });
  }

  async scan(context: ContextObject): Promise<ContextScannerOutput[]> {
    const result = await run(this.agent, buildContextText(context));
    const parsed = safeJsonParse(result.finalOutput);
    const hints = Array.isArray(parsed.hints) ? parsed.hints : [];

    return hints
      .map((hint) => {
        const record = hint as Record<string, unknown>;
        const sentence = record.sentence ?? "";
        const confidence = record.confidence ?? 0;
        return {
          signalType: "ACTION_HINT",
          sentence: String(sentence),
          confidence: typeof confidence === "number" ? confidence : Number(confidence) || 0,
        };
      })
      .filter((item) => item.sentence.trim().length > 0);
  }
}

export class OpenAIDoneAssessor implements DoneAssessor {
  private readonly agent: Agent;

  constructor(private readonly config: OpenAIConfig) {
    ensureBaseUrl(config.baseURL);
    this.agent = new Agent({
      name: "DoneAssessor",
      instructions:
        "Decide if the obligation implied by this event is already done. Return JSON with { isDone, rationale }. Include all keys; use null if unknown.",
      model: config.model,
    });
  }

  async assess(context: ContextObject): Promise<DoneAssessment> {
    const result = await run(this.agent, buildContextText(context));
    const parsed = safeJsonParse(result.finalOutput);
    const isDoneRaw = parsed.isDone;
    const isDone = typeof isDoneRaw === "boolean" ? isDoneRaw : false;
    return {
      isDone,
      rationale: normalizeRationale(parsed.rationale),
    };
  }
}

export class OpenAIDecisionAgent implements DecisionAgent {
  private readonly agent: Agent;

  constructor(private readonly config: OpenAIConfig) {
    ensureBaseUrl(config.baseURL);
    this.agent = new Agent({
      name: "DecisionAgent",
      instructions:
        "Decide whether to PROPOSE, HOLD, or IGNORE a TODO candidate. Return JSON with { decision, rationale }. Include all keys; use null if unknown.",
      model: config.model,
    });
  }

  async decide(context: ContextObject, signals: ContextScannerOutput[]): Promise<DecisionOutput> {
    const input = `${buildContextText(context)}\n\nsignals: ${JSON.stringify(signals)}`;
    const result = await run(this.agent, input);
    const parsed = safeJsonParse(result.finalOutput);
    const decisionRaw = parsed.decision;
    const decision =
      decisionRaw === "PROPOSE" || decisionRaw === "HOLD" || decisionRaw === "IGNORE"
        ? decisionRaw
        : "HOLD";
    return {
      decision,
      rationale: normalizeRationale(parsed.rationale),
    };
  }
}

export class OpenAIRiskAgent implements RiskAgent {
  private readonly agent: Agent;

  constructor(private readonly config: OpenAIConfig) {
    ensureBaseUrl(config.baseURL);
    this.agent = new Agent({
      name: "RiskAgent",
      instructions:
        "Score risk of not doing this obligation. Return JSON with { riskScore, impact, reason }. Include all keys; use null if unknown.",
      model: config.model,
    });
  }

  async score(context: ContextObject): Promise<RiskOutput> {
    const result = await run(this.agent, buildContextText(context));
    const parsed = safeJsonParse(result.finalOutput);
    const riskScoreRaw = parsed.riskScore;
    const impactRaw = parsed.impact;
    const reasonRaw = parsed.reason;
    const impact = impactRaw === "LOW" || impactRaw === "MEDIUM" || impactRaw === "HIGH" ? impactRaw : "LOW";
    const riskScore = typeof riskScoreRaw === "number" ? riskScoreRaw : Number(riskScoreRaw) || 0;
    return {
      riskScore,
      impact,
      reason: reasonRaw ? String(reasonRaw) : "",
    };
  }
}
