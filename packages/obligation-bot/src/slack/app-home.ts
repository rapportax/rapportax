import type { TodoCandidate } from "../types";

export interface SlackViewPayload {
  type: "home";
  blocks: Array<Record<string, unknown>>;
}

export function buildAppHomeView(
  candidates: TodoCandidate[],
): SlackViewPayload {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: "Your TODOs" },
    },
  ];

  if (candidates.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "현재 제안된 후보가 없습니다." },
    });
    return { type: "home", blocks };
  }

  for (const candidate of candidates) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${candidate.title}*`,
      },
    });
  }

  return { type: "home", blocks };
}
