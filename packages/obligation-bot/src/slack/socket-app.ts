import { App, LogLevel } from "@slack/bolt";
import { publishAppHome } from "./publish";
import { sendAdminApprovalRequest, sendAdminExecutionResult } from "./messages";
import { buildAdminLoginModal, parseAdminLogin, ADMIN_LOGIN_VIEW_ID } from "./modals";
import { createSlackSocketAppContext } from "../di";
import { startApiServer } from "../api/server";

export async function startSlackSocketApp(): Promise<void> {
  const { service, signingSecret, botToken, appToken, adminApiBaseUrl } = createSlackSocketAppContext();

  void startApiServer(service, adminApiBaseUrl);

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
