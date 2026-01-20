import type { TodoCandidate } from "../types";
import { buildAppHomeView } from "./app-home";

export interface SlackPublisherConfig {
  botToken: string;
}

export async function publishAppHome(
  config: SlackPublisherConfig,
  userId: string,
  candidates: TodoCandidate[],
): Promise<void> {
  const view = buildAppHomeView(candidates);
  const response = await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ user_id: userId, view }),
  });

  if (!response.ok) {
    throw new Error(`Slack publish failed: ${response.status}`);
  }

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(`Slack publish failed: ${payload.error ?? "unknown"}`);
  }
}
