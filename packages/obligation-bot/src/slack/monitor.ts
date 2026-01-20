import type { EventEmitter2 } from "eventemitter2";

type SlackOpsPublisherOptions = {
  channel?: string;
  token?: string;
  flushIntervalMs?: number;
  maxLines?: number;
  events: string[];
  formatLine: (event: string, payload: unknown) => SlackMessage;
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
};

type SlackBlock = {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
};

type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

export const attachSlackOpsPublisher = (
  eventEmitter: EventEmitter2,
  options: SlackOpsPublisherOptions,
) => {
  const channel = options.channel ?? process.env.SLACK_OPS_CHANNEL ?? "C0A9N6KCMC6";
  const token = options.token ?? process.env.SLACK_BOT_TOKEN;

  if (!channel || !token) {
    return () => undefined;
  }

  const buffer = new Map<string, SlackMessage[]>();
  const threadTsByRequest = new Map<string, string>();
  const maxLines = options.maxLines ?? Number(process.env.SLACK_OPS_MAX_LINES ?? 20);
  const flushIntervalMs =
    options.flushIntervalMs ?? Number(process.env.SLACK_OPS_FLUSH_MS ?? 1500);

  const postMessage = async (
    message: SlackMessage,
    threadTs?: string,
  ): Promise<string | null> => {
    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel,
          text: message.text,
          blocks: message.blocks,
          thread_ts: threadTs,
          mrkdwn: true,
        }),
      });
      if (!response.ok) {
        console.error("[slack/monitor] Slack publish failed", response.status);
        return null;
      }
      const payload = (await response.json()) as SlackApiResponse;
      if (!payload.ok) {
        console.error("[slack/monitor] Slack publish failed", payload.error ?? "unknown");
        return null;
      }
      return payload.ts ?? null;
    } catch (error) {
      console.error("[slack/monitor] Slack publish error", error);
      return null;
    }
  };

  const flush = async () => {
    if (buffer.size === 0) {
      return;
    }
    const batches = Array.from(buffer.entries());
    buffer.clear();

    for (const [requestId, lines] of batches) {
      if (lines.length === 0) {
        continue;
      }
      const chunks: string[][] = [];
      for (let i = 0; i < lines.length; i += maxLines) {
        chunks.push(lines.slice(i, i + maxLines));
      }

      const threadKey = requestId === "unknown" ? null : requestId;
      let threadTs = threadKey ? threadTsByRequest.get(threadKey) ?? null : null;
      if (threadKey && !threadTs) {
        const header = [
          ":satellite: *Agent Ops*",
          `requestId: \`${threadKey}\``,
          "thread: started",
        ].join("\n");
        threadTs = await postMessage({ text: header });
        if (threadTs) {
          threadTsByRequest.set(threadKey, threadTs);
        }
      }

      for (const chunk of chunks) {
        const textParts: string[] = [];
        const blocks: SlackBlock[] = [];
        chunk.forEach((item) => {
          textParts.push(item.text);
          if (item.blocks && item.blocks.length > 0) {
            blocks.push(...item.blocks);
          } else {
            blocks.push({
              type: "section",
              text: { type: "mrkdwn", text: item.text },
            });
          }
        });
        await postMessage(
          {
            text: textParts.join("\n"),
            blocks: blocks.length ? blocks : undefined,
          },
          threadTs ?? undefined,
        );
      }
    }
  };

  const interval = setInterval(() => {
    void flush();
  }, flushIntervalMs);

  const handlers = new Map<string, (payload: unknown) => void>();

  options.events.forEach((event) => {
    const handler = (payload: unknown) => {
      const record = payload as { requestId?: string };
      const requestId = record?.requestId ?? "unknown";
      const lines = buffer.get(requestId) ?? [];
      lines.push(options.formatLine(event, payload));
      buffer.set(requestId, lines);
      if (lines.length >= maxLines * 2) {
        void flush();
      }
    };
    handlers.set(event, handler);
    eventEmitter.on(event, handler);
  });

  return () => {
    clearInterval(interval);
    handlers.forEach((handler, event) => {
      eventEmitter.off(event, handler);
    });
  };
};
