import type { SlackEventEnvelope } from "../types";
import type { SlackActionPayload, SlackEventCallbackPayload } from "./types";
import { verifySlackSignature } from "./signature";
import { publishAppHome } from "./publish";
import type { ObligationService } from "../service";

export interface SlackRequestContext {
  signingSecret: string;
  botToken: string;
}

export interface SlackRequestResult {
  status: number;
  body: string;
}

export async function handleSlackEventRequest(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  ctx: SlackRequestContext,
  service: ObligationService,
): Promise<SlackRequestResult> {
  const timestamp = String(headers["x-slack-request-timestamp"] ?? "");
  const signature = String(headers["x-slack-signature"] ?? "");

  if (!verifySlackSignature(ctx.signingSecret, timestamp, rawBody, signature)) {
    return { status: 401, body: "invalid signature" };
  }

  const payload = JSON.parse(rawBody) as SlackEventCallbackPayload;
  if (payload.challenge) {
    return { status: 200, body: payload.challenge };
  }

  if (payload.type === "event_callback" && payload.event) {
    await service.handleSlackEvent(payload as unknown as SlackEventEnvelope);
  }

  return { status: 200, body: "ok" };
}

export async function handleSlackActionRequest(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  ctx: SlackRequestContext,
  service: ObligationService,
): Promise<SlackRequestResult> {
  const timestamp = String(headers["x-slack-request-timestamp"] ?? "");
  const signature = String(headers["x-slack-signature"] ?? "");

  if (!verifySlackSignature(ctx.signingSecret, timestamp, rawBody, signature)) {
    return { status: 401, body: "invalid signature" };
  }

  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  if (!payloadRaw) {
    return { status: 400, body: "missing payload" };
  }

  const payload = JSON.parse(payloadRaw) as SlackActionPayload;
  const action = payload.actions[0];
  if (action) {
    await service.handleSlackAction(action.action_id, action.value, payload.user?.id);
  }

  const candidates = await service.listCandidates();
  const pendingRequests = await service.listPendingAdminExecRequests();
  await publishAppHome({ botToken: ctx.botToken }, payload.user.id, candidates, pendingRequests);

  return { status: 200, body: "ok" };
}
