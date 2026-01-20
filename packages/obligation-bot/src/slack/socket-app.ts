import { loadEnv } from "./env";
import { App, LogLevel } from "@slack/bolt";
import { NoopContextScanner, NoopDecisionAgent, NoopDoneAssessor, NoopRiskAgent } from "../agents/noop";
import { OpenAIContextScanner, OpenAIDecisionAgent, OpenAIDoneAssessor, OpenAIRiskAgent } from "../agents/openai";
import { PostgresCandidateRepository, PostgresClient, PostgresDecisionLogRepository } from "../storage/postgres";
import { ObligationService } from "../service";
import { publishAppHome } from "./publish";
import { WorkflowVisualizationService, workflowVizEvents } from "../workflow-viz";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export async function startSlackSocketApp(): Promise<void> {
  loadEnv();
  const signingSecret = requireEnv("SLACK_SIGNING_SECRET");
  const botToken = requireEnv("SLACK_BOT_TOKEN");
  const appToken = requireEnv("SLACK_APP_TOKEN");
  const databaseUrl = requireEnv("DATABASE_URL");
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-5.2";
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;

  const client = new PostgresClient({ connectionString: databaseUrl });
  const candidateRepository = new PostgresCandidateRepository(client);
  const decisionLogRepository = new PostgresDecisionLogRepository(client);

  const service = new ObligationService({
    contextScanner: openaiApiKey
      ? new OpenAIContextScanner({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopContextScanner(),
    decisionAgent: openaiApiKey
      ? new OpenAIDecisionAgent({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopDecisionAgent(),
    doneAssessor: openaiApiKey
      ? new OpenAIDoneAssessor({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopDoneAssessor(),
    riskAgent: openaiApiKey
      ? new OpenAIRiskAgent({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopRiskAgent(),
    candidateRepository,
    decisionLogRepository,
  });

  // Initialize workflow visualization service
  const workflowViz = new WorkflowVisualizationService({ botToken });

  // Connect EventEmitter to service (for same-process communication)
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
    await service.handleSlackEvent({
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
  });

  app.event("app_mention", async ({ event }) => {
    console.log("[slack] app_mention", event.user);
    await service.handleSlackEvent({
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
  });

  app.action(/^(execute_|hold_|ignore_)/, async ({ ack, body }) => {
    await ack();
    console.log("[slack] action", body.actions?.[0]?.action_id);
    const action = body.actions?.[0];
    if (action && "action_id" in action && "value" in action) {
      const actionId = String(action.action_id);
      const value = String(action.value ?? "");
      await service.handleSlackAction(actionId, value);
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
