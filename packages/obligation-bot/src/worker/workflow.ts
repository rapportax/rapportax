import { Runner } from "@openai/agents";
import { randomUUID } from "crypto";
import type { EventEmitter2 } from "eventemitter2";
import {
  createDeveloperAgent,
  createDeveloperResearchAgent,
  createImplementationAgent,
  createOrchestratorAgent,
  createProductOwnerAgent,
  createQaAgent,
} from "./agents";
import {
  OrchestratorOutput,
  OrchestratorOutputSchema,
} from "./schemas";
import { createRepoTools } from "./tools";
import {
  agentEventEmitter,
  attachAgentHookLogger,
  attachAgentHooks,
  attachAgentInstanceHooks,
} from "./monitor/agent-hooks";

export interface WorkflowInput {
  task: string;
  context?: string;
  constraints?: string[];
  signals?: string[];
  requestedByUserId?: string;
}

export interface WorkflowOptions {
  model?: string;
  maxTurns?: number;
  runner?: Runner;
  repoRoot?: string;
  logger?: (message: string, data?: Record<string, unknown>) => void;
  eventEmitter?: EventEmitter2;
  eventLogPath?: string;
}

export interface WorkflowResult {
  requestId: string;
  lastAgent: string | null;
  finalOutput: unknown;
  orchestrator?: OrchestratorOutput;
}

const buildDynamicPrompt = (input: WorkflowInput): string => {
  const constraints = input.constraints?.length
    ? input.constraints.map((item) => `- ${item}`).join("\n")
    : "- (none)";
  const signals = input.signals?.length
    ? input.signals.map((item) => `- ${item}`).join("\n")
    : "- (none)";

  return [
    "당신은 LLM 기반 오케스트레이터입니다. 필요한 에이전트를 도구/hand off로 호출하세요.",
    "각 에이전트 출력은 JSON 스키마를 따릅니다. 필요한 경우 JSON을 해석해서 합성하세요.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "Signals:",
    signals,
    "Constraints:",
    constraints,
    "최종 출력은 Orchestrator 스키마(JSON)로 반환하세요.",
  ].join("\n");
};

export async function runMultiAgentWorkflow(
  input: WorkflowInput,
  options: WorkflowOptions = {},
): Promise<WorkflowResult> {
  const log =
    options.logger ??
    ((message, data) => {
      if (data) {
        console.info(message, data);
      } else {
        console.info(message);
      }
    });
  const model = options.model ?? "gpt-5.2";
  const runner =
    options.runner ??
    new Runner({
      model,
      modelSettings: {
        reasoning: {
          effort: "medium",
        },
      },
    });
  const requestId = randomUUID();
  const maxTurns = options.maxTurns ?? 50;
  const repoRoot = options.repoRoot ?? process.cwd();
  const repoToolsForDevResearch = createRepoTools(repoRoot, "DeveloperResearch");
  const repoToolsForDev = createRepoTools(repoRoot, "Developer");
  const repoToolsForImpl = createRepoTools(repoRoot, "Implementation");

  const poBase = createProductOwnerAgent();
  const devResearchBase = createDeveloperResearchAgent(repoToolsForDevResearch);
  const devBase = createDeveloperAgent(repoToolsForDev);
  const implBase = createImplementationAgent(repoToolsForImpl);
  const qaBase = createQaAgent();

  const agentToolConfig = {
    runConfig: {
      model,
      modelSettings: {
        reasoning: { effort: "medium" },
      },
    },
    runOptions: {
      maxTurns,
    },
  };

  const poTool = poBase.asTool({
    toolName: "ask_po",
    toolDescription:
      "PO 에이전트에게 질문합니다. PO 스키마 JSON 문자열을 반환합니다.",
    ...agentToolConfig,
  });
  const devResearchTool = devResearchBase.asTool({
    toolName: "ask_dev_research",
    toolDescription:
      "DeveloperResearch 에이전트에게 조사 요청을 보냅니다. JSON 문자열을 반환합니다.",
    ...agentToolConfig,
  });
  const devTool = devBase.asTool({
    toolName: "ask_dev",
    toolDescription:
      "Developer 에이전트에게 구현 질문을 보냅니다. JSON 문자열을 반환합니다.",
    ...agentToolConfig,
  });
  const implTool = implBase.asTool({
    toolName: "ask_implementation",
    toolDescription:
      "Implementation 에이전트에게 코드 변경을 요청합니다. JSON 문자열을 반환합니다.",
    ...agentToolConfig,
  });
  const qaTool = qaBase.asTool({
    toolName: "ask_qa",
    toolDescription:
      "QA 에이전트에게 테스트 관점 질문을 보냅니다. JSON 문자열을 반환합니다.",
    ...agentToolConfig,
  });

  const poAgent = createProductOwnerAgent([devTool, qaTool, devResearchTool]);
  const devResearchAgent = createDeveloperResearchAgent([
    ...repoToolsForDevResearch,
    poTool,
    devTool,
  ]);
  const devAgent = createDeveloperAgent([...repoToolsForDev, poTool, qaTool]);
  const implAgent = createImplementationAgent([
    ...repoToolsForImpl,
    poTool,
    devTool,
  ]);
  const qaAgent = createQaAgent([poTool, devTool]);
  const orchestratorAgent = createOrchestratorAgent(
    [poTool, devTool, qaTool, devResearchTool, implTool],
    [poAgent, devResearchAgent, devAgent, implAgent, qaAgent],
  );

  log("workflow.dynamic.start", { requestId, task: input.task });

  const hookEmitter = options.eventEmitter ?? agentEventEmitter;
  const detachHooks = attachAgentHooks(runner, hookEmitter, requestId);
  const detachAgentInstances = [
    attachAgentInstanceHooks(poBase, hookEmitter, requestId),
    attachAgentInstanceHooks(devResearchBase, hookEmitter, requestId),
    attachAgentInstanceHooks(devBase, hookEmitter, requestId),
    attachAgentInstanceHooks(implBase, hookEmitter, requestId),
    attachAgentInstanceHooks(qaBase, hookEmitter, requestId),
  ];
  const detachLogger = attachAgentHookLogger(hookEmitter, {
    requestId,
    logPath: options.eventLogPath,
  });
  hookEmitter.emit("workflow_start", {
    requestId,
    timestamp: new Date().toISOString(),
    task: input.task,
    requestedByUserId: input.requestedByUserId,
  });
  const result = await runner.run(
    orchestratorAgent,
    buildDynamicPrompt(input),
    { maxTurns },
  ).finally(() => {
    detachHooks();
    detachAgentInstances.forEach((detach) => detach());
    detachLogger();
  });

  const lastAgent = result.lastAgent?.name ?? null;
  let orchestrator: OrchestratorOutput | undefined;

  if (result.finalOutput) {
    try {
      orchestrator = OrchestratorOutputSchema.parse(result.finalOutput);
    } catch {
      orchestrator = undefined;
    }
  }

  if (!orchestrator && result.finalOutput) {
    const finalizer = createOrchestratorAgent([poTool, devTool, qaTool]);
    const finalResult = await runner.run(
      finalizer,
      [
        "최종 결정이 Orchestrator 스키마로 필요합니다.",
        `Task: ${input.task}`,
        "이전 에이전트 출력(JSON):",
        JSON.stringify(result.finalOutput),
        "이 내용을 바탕으로 Orchestrator 스키마(JSON)로 요약하세요.",
      ].join("\n"),
      { maxTurns },
    );
    try {
      orchestrator = OrchestratorOutputSchema.parse(finalResult.finalOutput);
    } catch {
      orchestrator = undefined;
    }
  }

  log("workflow.dynamic.done", {
    requestId,
    lastAgent,
    decision: orchestrator?.decision ?? null,
  });

  return {
    requestId,
    lastAgent,
    finalOutput: result.finalOutput ?? null,
    orchestrator,
  };
}
