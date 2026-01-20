import express from "express";
import type { ObligationService } from "../service";
import type { SourceType } from "../types";

const API_PORT = Number(process.env.API_PORT ?? "4040");
const VALID_SOURCES: SourceType[] = ["slack", "webhook", "system"];

const requireParam = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const parseSource = (value: unknown): SourceType => {
  if (typeof value !== "string") {
    return "webhook";
  }
  const trimmed = value.trim();
  return VALID_SOURCES.includes(trimmed as SourceType) ? (trimmed as SourceType) : "webhook";
};

const parseRiskScore = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const formatError = (error: unknown): { message: string; details?: string } => {
  if (error instanceof Error) {
    const details = error.stack && error.stack !== error.message ? error.stack : undefined;
    return { message: error.message || "Unknown error", details };
  }
  if (typeof error === "string") {
    return { message: error || "Unknown error" };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: "Unknown error" };
  }
};

export const startApiServer = async (service: ObligationService): Promise<void> => {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  app.post("/api/obligations", async (req, res) => {
    try {
      const title = requireParam(req.body?.title, "title");
      const candidate = await service.createObligation({
        title,
        source: parseSource(req.body?.source),
        inferredReason: optionalString(req.body?.inferredReason),
        suggestedOwner: optionalString(req.body?.suggestedOwner),
        riskScore: parseRiskScore(req.body?.riskScore),
      });
      res.status(201).json({ ok: true, candidate });
    } catch (error) {
      const payload = formatError(error);
      console.error("[api] create obligation failed", payload);
      res.status(400).json({ ok: false, error: payload.message });
    }
  });

  app.post("/api/obligations/:id/execute", async (req, res) => {
    try {
      const candidateId = requireParam(req.params?.id, "id");
      const requestedByUserId = optionalString(req.body?.requestedByUserId);
      const result = await service.executeCandidate(candidateId, requestedByUserId);
      res.json({ ok: result.status === "ENQUEUED", result });
    } catch (error) {
      const payload = formatError(error);
      console.error("[api] execute obligation failed", payload);
      res.status(400).json({ ok: false, error: payload.message });
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const payload = formatError(error);
    console.error("[api] request failed", payload);
    res.status(400).json({ ok: false, error: payload.message });
  });

  app.listen(API_PORT, () => {
    console.log(`API server listening on :${API_PORT}`);
  });
};
