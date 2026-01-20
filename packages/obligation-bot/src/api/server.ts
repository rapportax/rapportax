import express from "express";
import { issueAdminToken } from "../admin-exec/api";
import { buildAppHomeView } from "../slack/app-home";
import type { ObligationService } from "../service";

const API_PORT = Number(process.env.API_PORT ?? "4040");

const requireParam = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

export const startApiServer = async (service: ObligationService, adminApiBaseUrl: string): Promise<void> => {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  app.get("/api/obligations/home", async (req, res) => {
    try {
      const userId = requireParam(req.query.userId, "userId");
      const candidates = await service.listCandidates();
      const pendingRequests = await service.listPendingAdminExecRequests();
      const adminLoggedIn = await service.isAdminLoggedIn(userId);
      const view = buildAppHomeView(candidates, pendingRequests, adminLoggedIn);
      res.json(view);
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/obligations/action", async (req, res) => {
    try {
      const userId = requireParam(req.body?.userId, "userId");
      const actionId = requireParam(req.body?.actionId, "actionId");
      const value = requireParam(req.body?.value, "value");
      await service.handleSlackAction(actionId, value, userId);
      const candidates = await service.listCandidates();
      const pendingRequests = await service.listPendingAdminExecRequests();
      const adminLoggedIn = await service.isAdminLoggedIn(userId);
      const view = buildAppHomeView(candidates, pendingRequests, adminLoggedIn);
      res.json({ ok: true, view });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/obligations/admin-login", async (req, res) => {
    try {
      const userId = requireParam(req.body?.userId, "userId");
      const username = requireParam(req.body?.username, "username");
      const password = requireParam(req.body?.password, "password");
      const accessToken = await issueAdminToken({ baseUrl: adminApiBaseUrl, username, password });
      await service.saveAdminToken(userId, accessToken);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.listen(API_PORT, () => {
    console.log(`API server listening on :${API_PORT}`);
  });
};
