import { App, LogLevel } from "@slack/bolt";
import { publishAppHome } from "./publish";
import { parseSlackActionId } from "./actions";
import { createSlackSocketAppContext } from "../di";
import { startApiServer } from "../api/server";
import { WorkflowVisualizationService, workflowVizEvents } from "../workflow-viz";
import { normalizeSlackEvent } from "../normalize/slack";

export async function startSlackSocketApp(): Promise<void> {
  const { service, signingSecret, botToken, appToken } = createSlackSocketAppContext();

  void startApiServer(service);

  const workflowViz = new WorkflowVisualizationService({ botToken });

  workflowVizEvents.on("session:start", (session) => {
    workflowViz.startSession(session).catch((err) => {
      console.error("[workflow-viz] Error starting session:", err);
    });
  });

  workflowVizEvents.on("session:end", ({ sessionId }) => {
    workflowViz.endSession(sessionId).catch((err) => {
      console.error("[workflow-viz] Error ending session:", err);
    });
  });

  workflowVizEvents.on("workflow:event", (event) => {
    workflowViz.handleEvent(event).catch((err) => {
      console.error("[workflow-viz] Error handling event:", err);
    });
  });

  console.log("[workflow-viz] Service initialized and EventEmitter connected");

  const app = new App({
    token: botToken,
    signingSecret,
    appToken,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  app.event("app_home_opened", async ({ event }) => {
    console.log("[slack] app_home_opened", event.user);
    const candidates = await service.listCandidates();
    await publishAppHome({ botToken }, event.user, candidates);
  });

  app.event("message", async ({ event }) => {
    console.log("[slack] message", "type" in event ? event.type : "unknown");
    const context = normalizeSlackEvent({
      event_id: "socket-message",
      event_time: Math.floor(Date.now() / 1000),
      type: "event_callback",
      event: {
        type: "message",
        user: "user" in event ? event.user : undefined,
        text: "text" in event ? event.text : undefined,
        channel: "channel" in event ? event.channel : undefined,
        ts: "ts" in event ? event.ts : undefined,
        thread_ts: "thread_ts" in event ? event.thread_ts : undefined,
      },
    });
    await service.runDecisionPipeline(context);
  });

  app.event("app_mention", async ({ event }) => {
    console.log("[slack] app_mention", event.user);
    const context = normalizeSlackEvent({
      event_id: "socket-mention",
      event_time: Math.floor(Date.now() / 1000),
      type: "event_callback",
      event: {
        type: "app_mention",
        user: event.user,
        text: event.text,
        channel: event.channel,
        ts: event.ts,
        thread_ts: event.thread_ts,
      },
    });
    await service.runDecisionPipeline(context);
  });

  app.action(/^(execute_|hold_|ignore_)/, async ({ ack, body }) => {
    await ack();
    console.log("[slack] action", body.actions?.[0]?.action_id);
    const action = body.actions?.[0];
    if (action && "action_id" in action && "value" in action) {
      const actionId = String(action.action_id);
      const value = String(action.value ?? "");
      const parsed = parseSlackActionId(actionId, value);
      if (parsed?.action === "EXECUTE" && parsed.candidateId) {
        await service.executeCandidate(parsed.candidateId, body.user?.id);
      } else if (parsed?.candidateId && parsed.status) {
        await service.recordDecision(
          parsed.candidateId,
          parsed.status,
          parsed.action,
          `Slack action: ${parsed.action}`,
        );
      }
    }
    if (body.user?.id) {
      const candidates = await service.listCandidates();
      await publishAppHome({ botToken }, body.user.id, candidates);
    }
  });

  await app.start();
  console.log("Slack Socket Mode app started");
}

if (require.main === module) {
  startSlackSocketApp().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
