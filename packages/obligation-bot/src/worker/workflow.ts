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
import { agentEventEmitter, attachAgentHookLogger, attachAgentHooks } from "./monitor/agent-hooks";

export interface WorkflowInput {
  task: string;
  context?: string;
  constraints?: string[];
  signals?: string[];
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
    "당신은 LLM 기반 오케스트레이터입니다. 필요한 에이전트를 handoff로 호출하세요.",
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

  const poAgent = createProductOwnerAgent();
  const devResearchAgent = createDeveloperResearchAgent(repoToolsForDevResearch);
  const devAgent = createDeveloperAgent(repoToolsForDev);
  const implAgent = createImplementationAgent(repoToolsForImpl);
  const qaAgent = createQaAgent();
  const orchestratorAgent = createOrchestratorAgent();

  orchestratorAgent.handoffs = [
    poAgent,
    devResearchAgent,
    devAgent,
    implAgent,
    qaAgent,
  ];
  poAgent.handoffs = [orchestratorAgent];
  devResearchAgent.handoffs = [orchestratorAgent];
  devAgent.handoffs = [orchestratorAgent];
  implAgent.handoffs = [orchestratorAgent];
  qaAgent.handoffs = [orchestratorAgent];

  log("workflow.dynamic.start", { requestId, task: input.task });

  const hookEmitter = options.eventEmitter ?? agentEventEmitter;
  const detachHooks = attachAgentHooks(runner, hookEmitter, requestId);
  const detachLogger = attachAgentHookLogger(hookEmitter, {
    requestId,
    logPath: options.eventLogPath,
  });
  const result = await runner.run(
    orchestratorAgent,
    buildDynamicPrompt(input),
    { maxTurns },
  ).finally(() => {
    detachHooks();
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
