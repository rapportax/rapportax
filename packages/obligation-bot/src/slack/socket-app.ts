import { loadEnv } from "./env";
import { App, LogLevel } from "@slack/bolt";
import { NoopContextScanner, NoopDecisionAgent, NoopDoneAssessor, NoopRiskAgent } from "../agents/noop";
import { OpenAIContextScanner, OpenAIDecisionAgent, OpenAIDoneAssessor, OpenAIRiskAgent } from "../agents/openai";
import {
  PostgresAdminExecRequestRepository,
  PostgresAdminTokenRepository,
  PostgresCandidateRepository,
  PostgresClient,
  PostgresDecisionLogRepository,
} from "../storage/postgres";
import { ObligationService } from "../service";
import { publishAppHome } from "./publish";
import { AdminExecService } from "../admin-exec/service";
import { sendAdminApprovalRequest, sendAdminExecutionResult } from "./messages";
import { buildAdminLoginModal, parseAdminLogin, ADMIN_LOGIN_VIEW_ID } from "./modals";
import { issueAdminToken } from "../admin-exec/api";
import { ExecutorService } from "../executor/service";
import { createLocalWorkerRuntime } from "../workers/runtime";
import { DEFAULT_WORKERS } from "../workers/registry";

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
  const adminApiBaseUrl = requireEnv("ADMIN_API_BASE_URL");
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-5.2";
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;
  const workerModel = process.env.WORKER_MODEL;
  const workerMaxTurnsRaw = process.env.WORKER_MAX_TURNS;
  const workerRepoRoot = process.env.WORKER_REPO_ROOT;
  const workerMaxTurns = workerMaxTurnsRaw ? Number(workerMaxTurnsRaw) : undefined;

  const client = new PostgresClient({ connectionString: databaseUrl });
  const candidateRepository = new PostgresCandidateRepository(client);
  const decisionLogRepository = new PostgresDecisionLogRepository(client);
  const adminExecRequestRepository = new PostgresAdminExecRequestRepository(client);
  const adminTokenRepository = new PostgresAdminTokenRepository(client);

  const adminExecService =
    openaiApiKey
      ? new AdminExecService(
          {
            adminApiBaseUrl,
            openaiModel,
            openaiBaseUrl,
          },
          { requestRepository: adminExecRequestRepository, decisionLogRepository },
        )
      : undefined;

  const workerRuntime = openaiApiKey
    ? createLocalWorkerRuntime({
        model: workerModel ?? openaiModel,
        maxTurns: workerMaxTurns && Number.isFinite(workerMaxTurns) ? workerMaxTurns : undefined,
        repoRoot: workerRepoRoot,
      })
    : undefined;

  const executorService = workerRuntime
    ? new ExecutorService({
        candidateRepository,
        decisionLogRepository,
        workerRuntime,
        workers: DEFAULT_WORKERS,
      })
    : undefined;

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
    adminExecRequestRepository,
    adminExecService,
    adminTokenRepository,
    executorService,
  });

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
    const pendingRequests = await service.listPendingAdminExecRequests();
    const adminLoggedIn = await service.isAdminLoggedIn(event.user);
    await publishAppHome({ botToken }, event.user, candidates, pendingRequests, adminLoggedIn);
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

  app.action(/^(execute_|hold_|ignore_|execute_admin_|approve_admin_|reject_admin_|admin_login)/, async ({ ack, body, client: slackClient }) => {
    await ack();
    console.log("[slack] action", body.actions?.[0]?.action_id);
    const action = body.actions?.[0];
    if (action && "action_id" in action && "value" in action) {
      const actionId = String(action.action_id);
      const value = String(action.value ?? "");
      if (actionId === "admin_login") {
        await slackClient.views.open({ trigger_id: body.trigger_id, view: buildAdminLoginModal() });
        return;
      }

      if (actionId.startsWith("execute_admin_")) {
        const userId = body.user?.id;
        if (!userId) return;
        const token = await service.getAdminToken(userId);
        if (!token) {
          await slackClient.views.open({ trigger_id: body.trigger_id, view: buildAdminLoginModal() });
          return;
        }
        const request = await service.handleAdminExecute(value, token, userId);
        if (request && body.user?.id) {
          await sendAdminApprovalRequest(
            { botToken },
            body.user.id,
            request.id,
            `${request.actionType} (${request.targetUserId ?? request.targetOrgId ?? ""})`,
            request.rationale,
          );
        }
      } else if (actionId.startsWith("approve_admin_")) {
        const userId = body.user?.id;
        if (!userId) return;
        const token = await service.getAdminToken(userId);
        if (!token) {
          await slackClient.views.open({ trigger_id: body.trigger_id, view: buildAdminLoginModal() });
          return;
        }
        await service.handleAdminApproval(value, token);
        if (body.user?.id) {
          await sendAdminExecutionResult({ botToken }, body.user.id, "Admin exec approved", true);
        }
      } else if (actionId.startsWith("reject_admin_")) {
        await service.handleAdminRejection(value);
        if (body.user?.id) {
          await sendAdminExecutionResult({ botToken }, body.user.id, "Admin exec rejected", false);
        }
      } else {
        await service.handleSlackAction(actionId, value, body.user?.id);
      }
    }
    if (body.user?.id) {
      const candidates = await service.listCandidates();
      const pendingRequests = await service.listPendingAdminExecRequests();
      const adminLoggedIn = await service.isAdminLoggedIn(body.user.id);
      await publishAppHome({ botToken }, body.user.id, candidates, pendingRequests, adminLoggedIn);
    }
  });

  app.view(ADMIN_LOGIN_VIEW_ID, async ({ ack, body, view }) => {
    await ack();
    const userId = body.user.id;
    const values = view.state.values as Record<string, Record<string, { value?: string }>>;
    const { username, password } = parseAdminLogin(values);
    const accessToken = await issueAdminToken({ baseUrl: adminApiBaseUrl, username, password });
    await service.saveAdminToken(userId, accessToken);
    await sendAdminExecutionResult({ botToken }, userId, "Admin login success", true);
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
