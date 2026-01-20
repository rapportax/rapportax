export interface SlackMessageConfig {
  botToken: string;
}

async function openImChannel(botToken: string, userId: string): Promise<string> {
  const response = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ users: userId }),
  });

  const payload = (await response.json()) as { ok: boolean; channel?: { id: string }; error?: string };
  if (!payload.ok || !payload.channel?.id) {
    throw new Error(`Slack conversations.open failed: ${payload.error ?? "unknown"}`);
  }

  return payload.channel.id;
}

export async function sendAdminApprovalRequest(
  config: SlackMessageConfig,
  userId: string,
  requestId: string,
  summary: string,
  rationale?: string,
): Promise<void> {
  const channel = await openImChannel(config.botToken, userId);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Admin Execute 요청*\n${summary}`,
      },
    },
  ];

  if (rationale) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_${rationale}_` },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        action_id: `approve_admin_${requestId}`,
        value: requestId,
        style: "primary",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject" },
        action_id: `reject_admin_${requestId}`,
        value: requestId,
        style: "danger",
      },
    ],
  });

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text: "Admin Execute 요청", blocks }),
  });

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(`Slack chat.postMessage failed: ${payload.error ?? "unknown"}`);
  }
}

export async function sendAdminExecutionResult(
  config: SlackMessageConfig,
  userId: string,
  summary: string,
  success: boolean,
): Promise<void> {
  const channel = await openImChannel(config.botToken, userId);
  const text = success ? `✅ ${summary}` : `❌ ${summary}`;
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  });

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(`Slack chat.postMessage failed: ${payload.error ?? "unknown"}`);
  }
}
