import { Runner } from "@openai/agents";
import { randomUUID } from "crypto";
import {
  developerAgent,
  orchestratorAgent,
  productOwnerAgent,
  qaAgent,
} from "./agents";
import {
  DevOutput,
  DevOutputSchema,
  OrchestratorOutput,
  OrchestratorOutputSchema,
  PoOutput,
  PoOutputSchema,
  QaOutput,
  QaOutputSchema,
} from "./schemas";

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
}

export interface WorkflowResult {
  requestId: string;
  po: PoOutput;
  dev: DevOutput;
  qa: QaOutput;
  synthesis: OrchestratorOutput;
}

const buildPoPrompt = (input: WorkflowInput): string => {
  const constraints = input.constraints?.length
    ? input.constraints.map((item) => `- ${item}`).join("\n")
    : "- (none)";
  const signals = input.signals?.length
    ? input.signals.map((item) => `- ${item}`).join("\n")
    : "- (none)";

  return [
    "당신은 Active TODO Discovery Bot의 업무를 평가합니다.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "Signals:",
    signals,
    "Constraints:",
    constraints,
    "PO 요약과 수용 기준을 제공하세요.",
  ].join("\n");
};

const buildDevPrompt = (input: WorkflowInput, po: PoOutput): string => {
  return [
    "당신은 PO 출력을 구현 계획으로 전환합니다.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "PO Output (JSON):",
    JSON.stringify(po),
    "구체적인 개발 계획을 제시하세요.",
  ].join("\n");
};

const buildQaPrompt = (input: WorkflowInput, po: PoOutput, dev: DevOutput): string => {
  return [
    "당신은 구현을 위한 QA 가이드를 준비합니다.",
    `Task: ${input.task}`,
    "PO Output (JSON):",
    JSON.stringify(po),
    "Developer Output (JSON):",
    JSON.stringify(dev),
    "QA 테스트 계획과 품질 게이트를 제시하세요.",
  ].join("\n");
};

const buildOrchestratorPrompt = (
  input: WorkflowInput,
  po: PoOutput,
  dev: DevOutput,
  qa: QaOutput,
): string => {
  return [
    "PO, Developer, QA 출력을 합성해 최종 결정을 내리세요.",
    `Task: ${input.task}`,
    "PO Output (JSON):",
    JSON.stringify(po),
    "Developer Output (JSON):",
    JSON.stringify(dev),
    "QA Output (JSON):",
    JSON.stringify(qa),
    "결정, 근거, 다음 단계를 반환하세요.",
  ].join("\n");
};

export async function runMultiAgentWorkflow(
  input: WorkflowInput,
  options: WorkflowOptions = {},
): Promise<WorkflowResult> {
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
  const maxTurns = options.maxTurns ?? 6;

  const poResult = await runner.run(productOwnerAgent, buildPoPrompt(input), {
    maxTurns,
  });
  const po = PoOutputSchema.parse(poResult.finalOutput);

  const devResult = await runner.run(developerAgent, buildDevPrompt(input, po), {
    maxTurns,
  });
  const dev = DevOutputSchema.parse(devResult.finalOutput);

  const qaResult = await runner.run(qaAgent, buildQaPrompt(input, po, dev), {
    maxTurns,
  });
  const qa = QaOutputSchema.parse(qaResult.finalOutput);

  const orchestratorResult = await runner.run(
    orchestratorAgent,
    buildOrchestratorPrompt(input, po, dev, qa),
    {
      maxTurns,
    },
  );
  const synthesis = OrchestratorOutputSchema.parse(
    orchestratorResult.finalOutput,
  );

  return {
    requestId,
    po,
    dev,
    qa,
    synthesis,
  };
}
