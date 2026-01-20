import { App, LogLevel } from "@slack/bolt";
import { publishAppHome } from "./publish";
import { createSlackSocketAppContext } from "../di";
import { startApiServer } from "../api/server";

export async function startSlackSocketApp(): Promise<void> {
  const { service, signingSecret, botToken, appToken } = createSlackSocketAppContext();

  void startApiServer(service);

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
      await service.handleSlackAction(actionId, value, body.user?.id);
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
