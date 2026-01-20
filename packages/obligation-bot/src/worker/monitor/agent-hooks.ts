import fs from "fs";
import path from "path";
import { EventEmitter2 } from "eventemitter2";
import type { Agent, RunContext, Runner, Tool } from "@openai/agents";
import { attachSlackOpsPublisher } from "../../slack/monitor";

export type AgentHookEvent =
  | "agent_start"
  | "agent_end"
  | "agent_handoff"
  | "agent_tool_start"
  | "agent_tool_call"
  | "agent_tool_end";

export type AgentHookPayload = {
  requestId?: string;
  timestamp: string;
  agent?: string;
  nextAgent?: string;
  tool?: string;
  toolCallId?: string;
  toolName?: string;
  turnInputCount?: number;
  output?: string;
  result?: string;
};

export const agentEventEmitter = new EventEmitter2({
  wildcard: true,
  maxListeners: 100,
});

const AGENT_HOOK_EVENTS: AgentHookEvent[] = [
  "agent_start",
  "agent_end",
  "agent_handoff",
  "agent_tool_start",
  "agent_tool_call",
  "agent_tool_end",
];

export const DEFAULT_AGENT_LOG_PATH =
  process.env.MONITOR_LOG_PATH ??
  path.resolve(__dirname, "..", "..", "monitor", "agent-log.jsonl");

const ensureDir = (filePath: string): void => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const truncate = (value: string, max = 800): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
};

const EVENT_EMOJI: Record<AgentHookEvent, string> = {
  agent_start: "🟢",
  agent_end: "✅",
  agent_handoff: "➡️",
  agent_tool_start: "🧰",
  agent_tool_call: "📣",
  agent_tool_end: "🧾",
};

const TOOL_AGENT_MAP: Record<string, string> = {
  ask_po: "PO",
  ask_dev: "Developer",
  ask_dev_research: "DeveloperResearch",
  ask_implementation: "Implementation",
  ask_qa: "QA",
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const shortenId = (value: string, head = 6, tail = 4): string => {
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

const formatJsonPreview = (value: string, max = 600): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  let text = trimmed;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      text = JSON.stringify(parsed, null, 2);
    } catch {
      text = trimmed;
    }
  }
  if (text.length > max) {
    text = `${text.slice(0, max)}…`;
  }
  return text;
};

const formatSlackEventLine = (event: AgentHookEvent, payload: AgentHookPayload): string => {
  const emoji = EVENT_EMOJI[event] ?? "🧾";
  const parts: string[] = [];
  const time = formatTime(payload.timestamp);
  const toolKey = payload.toolName ?? payload.tool ?? "";
  const targetAgent = TOOL_AGENT_MAP[toolKey];
  if (payload.agent) {
    parts.push(`*${payload.agent}*`);
  }
  if (payload.nextAgent) {
    parts.push(`→ *${payload.nextAgent}*`);
  }
  if (targetAgent) {
    parts.push(`→ *${targetAgent}*`);
  }
  if (payload.tool) {
    parts.push(`tool=\`${payload.tool}\``);
  }
  if (payload.toolCallId) {
    parts.push(`call=\`${shortenId(payload.toolCallId)}\``);
  }
  if (payload.toolName) {
    parts.push(`name=\`${payload.toolName}\``);
  }
  if (payload.turnInputCount !== undefined) {
    parts.push(`inputs=${payload.turnInputCount}`);
  }
  if (payload.output) {
    parts.push(`output=${truncate(payload.output, 120)}`);
  }
  let resultBlock = "";
  if (payload.result) {
    const preview = formatJsonPreview(payload.result, 700);
    if (preview) {
      resultBlock = `\n\`\`\`json\n${preview}\n\`\`\``;
    }
  }
  return `${emoji} *${event}* \`[${time}]\` ${parts.join(" ")}`.trim() + resultBlock;
};

const buildPayload = (requestId: string | undefined, data: Omit<AgentHookPayload, "requestId" | "timestamp">) => ({
  requestId,
  timestamp: new Date().toISOString(),
  ...data,
});

export const attachAgentHooks = (
  runner: Runner,
  eventEmitter: EventEmitter2 = agentEventEmitter,
  requestId?: string,
) => {
  const emit = (event: AgentHookEvent, payload: Omit<AgentHookPayload, "requestId" | "timestamp">) => {
    eventEmitter.emit(event, buildPayload(requestId, payload));
  };

  const onAgentStart = (
    _context: RunContext<any>,
    agent: Agent<any, any>,
    turnInput?: unknown[],
  ) => {
    emit("agent_start", {
      agent: agent.name,
      turnInputCount: turnInput?.length ?? 0,
    });
  };

  const onAgentEnd = (_context: RunContext<any>, agent: Agent<any, any>, output: string) => {
    emit("agent_end", {
      agent: agent.name,
      output: truncate(output),
    });
  };

  const onAgentHandoff = (_context: RunContext<any>, fromAgent: Agent<any, any>, toAgent: Agent<any, any>) => {
    emit("agent_handoff", {
      agent: fromAgent.name,
      nextAgent: toAgent.name,
    });
  };

  const onAgentToolStart = (
    _context: RunContext<any>,
    agent: Agent<any, any>,
    tool: Tool,
    details: { toolCall: { id?: string; name?: string } },
  ) => {
    const toolCallId = details?.toolCall?.id;
    const toolName = details?.toolCall?.name;
    emit("agent_tool_start", {
      agent: agent.name,
      tool: tool.name,
      toolCallId,
      toolName,
    });
    emit("agent_tool_call", {
      agent: agent.name,
      tool: tool.name,
      toolCallId,
      toolName,
    });
  };

  const onAgentToolEnd = (
    _context: RunContext<any>,
    agent: Agent<any, any>,
    tool: Tool,
    result: string,
    details: { toolCall: { id?: string; name?: string } },
  ) => {
    const toolCallId = details?.toolCall?.id;
    const toolName = details?.toolCall?.name;
    emit("agent_tool_end", {
      agent: agent.name,
      tool: tool.name,
      toolCallId,
      toolName,
      result: truncate(result),
    });
  };

  runner.on("agent_start", onAgentStart);
  runner.on("agent_end", onAgentEnd);
  runner.on("agent_handoff", onAgentHandoff);
  runner.on("agent_tool_start", onAgentToolStart);
  runner.on("agent_tool_end", onAgentToolEnd);

  return () => {
    runner.off("agent_start", onAgentStart);
    runner.off("agent_end", onAgentEnd);
    runner.off("agent_handoff", onAgentHandoff);
    runner.off("agent_tool_start", onAgentToolStart);
    runner.off("agent_tool_end", onAgentToolEnd);
  };
};

export const attachAgentHookLogger = (
  eventEmitter: EventEmitter2 = agentEventEmitter,
  options: { requestId?: string; logPath?: string } = {},
) => {
  const logPath = options.logPath ?? DEFAULT_AGENT_LOG_PATH;
  ensureDir(logPath);
  const detachSlack = attachSlackOpsPublisher(eventEmitter, {
    events: AGENT_HOOK_EVENTS,
    formatLine: formatSlackEventLine,
  });
  const handlers = new Map<AgentHookEvent, (payload: AgentHookPayload) => void>();

  AGENT_HOOK_EVENTS.forEach((event) => {
    const handler = (payload: AgentHookPayload) => {
      const entry = {
        timestamp: new Date().toISOString(),
        message: `agent.${event}`,
        data: payload,
      };
      fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, () => undefined);
    };
    handlers.set(event, handler);
    eventEmitter.on(event, handler);
  });

  return () => {
    handlers.forEach((handler, event) => {
      eventEmitter.off(event, handler);
    });
    detachSlack();
  };
};

export const attachAgentHookSlackPublisher = (
  eventEmitter: EventEmitter2 = agentEventEmitter,
  options: {
    channel?: string;
    token?: string;
    flushIntervalMs?: number;
    maxLines?: number;
  } = {},
) =>
  attachSlackOpsPublisher(eventEmitter, {
    ...options,
    events: AGENT_HOOK_EVENTS,
    formatLine: formatSlackEventLine,
  });
