import express from "express";
import type { ObligationService } from "../service";
import { handleSlackActionRequest, handleSlackEventRequest } from "./server";
import { publishAppHome } from "./publish";

export interface SlackHttpServerConfig {
  signingSecret: string;
  botToken: string;
  port: number;
}

export function createSlackServer(config: SlackHttpServerConfig, service: ObligationService) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  app.post(
    "/slack/events",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const rawBody = req.body.toString("utf8");
      const result = await handleSlackEventRequest(rawBody, req.headers, config, service);

      try {
        const payload = JSON.parse(rawBody) as { event?: { type?: string; user?: string } };
        if (payload.event?.type === "app_home_opened" && payload.event.user) {
          const candidates = await service.listCandidates();
          const pendingRequests = await service.listPendingAdminExecRequests();
          await publishAppHome({ botToken: config.botToken }, payload.event.user, candidates, pendingRequests);
        }
      } catch {
        // ignore non-JSON
      }

      res.status(result.status).send(result.body);
    },
  );

  app.post(
    "/slack/actions",
    express.raw({ type: "application/x-www-form-urlencoded" }),
    async (req, res) => {
      const rawBody = req.body.toString("utf8");
      const result = await handleSlackActionRequest(rawBody, req.headers, config, service);
      res.status(result.status).send(result.body);
    },
  );

  return app;
}

export function runSlackServer(config: SlackHttpServerConfig, service: ObligationService) {
  const app = createSlackServer(config, service);
  app.listen(config.port, () => {
    console.log(`Slack server listening on :${config.port}`);
  });
}
