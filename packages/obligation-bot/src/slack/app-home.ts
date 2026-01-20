import type { AdminExecRequest, TodoCandidate } from "../types";

export interface SlackViewPayload {
  type: "home";
  blocks: Array<Record<string, unknown>>;
}

export function buildAppHomeView(
  candidates: TodoCandidate[],
  pendingRequests: AdminExecRequest[] = [],
  adminLoggedIn = false,
): SlackViewPayload {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: "Obligation Candidates" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: adminLoggedIn ? "Admin Login: ✅" : "Admin Login: ❌ (required for Admin Execute)",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: adminLoggedIn ? "Re-Login" : "Admin Login" },
          action_id: "admin_login",
          value: "admin_login",
        },
      ],
    },
  ];

  if (candidates.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "현재 제안된 후보가 없습니다." },
    });
    return { type: "home", blocks };
  }

  const pendingByCandidate = new Map<string, AdminExecRequest[]>();
  for (const request of pendingRequests) {
    const list = pendingByCandidate.get(request.candidateId) ?? [];
    list.push(request);
    pendingByCandidate.set(request.candidateId, list);
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
        {
          type: "button",
          text: { type: "plain_text", text: "Admin Execute" },
          action_id: `execute_admin_${candidate.id}`,
          value: candidate.id,
        },
      ],
    });

    const pending = pendingByCandidate.get(candidate.id) ?? [];
    for (const request of pending) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Admin 실행 승인 대기* (${request.actionType})\n${request.rationale ?? ""}`,
        },
      });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            action_id: `approve_admin_${request.id}`,
            value: request.id,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            action_id: `reject_admin_${request.id}`,
            value: request.id,
            style: "danger",
          },
        ],
      });
    }
  }

  return { type: "home", blocks };
}
