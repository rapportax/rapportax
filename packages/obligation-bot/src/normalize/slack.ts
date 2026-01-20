import type { ContextObject, EventInput, SlackEventEnvelope } from "../types";

export function normalizeSlackEvent(envelope: SlackEventEnvelope): ContextObject {
  const event: EventInput = {
    source: "slack",
    eventId: envelope.event_id,
    timestamp: new Date(envelope.event_time * 1000).toISOString(),
    payload: envelope,
  };

  const normalizedText = envelope.event.text?.trim();

  return {
    event,
    normalizedText,
    metadata: {
      slackEventType: envelope.event.type,
      slackChannel: envelope.event.channel ?? "",
      slackUser: envelope.event.user ?? "",
      slackThreadTs: envelope.event.thread_ts ?? "",
    },
  };
}
