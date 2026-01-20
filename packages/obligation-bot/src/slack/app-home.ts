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
      text: { type: "plain_text", text: "Obligation Candidates" },
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
        text: `*${candidate.title}*\nRisk: ${candidate.riskScore}`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Execute" },
        action_id: `execute_${candidate.id}`,
        value: candidate.id,
      },
    });

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Hold" },
          action_id: `hold_${candidate.id}`,
          value: candidate.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Ignore" },
          action_id: `ignore_${candidate.id}`,
          value: candidate.id,
        },
      ],
    });
  }

  return { type: "home", blocks };
}
