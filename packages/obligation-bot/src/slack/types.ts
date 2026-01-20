export interface SlackEventCallbackPayload {
  type: "event_callback";
  challenge?: string;
  event?: {
    type: string;
    [key: string]: unknown;
  };
}

export interface SlackActionPayload {
  type: "block_actions";
  user: { id: string };
  actions: Array<{ action_id: string; value: string }>;
}
