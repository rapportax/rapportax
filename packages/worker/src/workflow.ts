import { Runner } from "@openai/agents";
import { randomUUID } from "crypto";
import {
  createDeveloperAgent,
  createDeveloperResearchAgent,
  createImplementationAgent,
  createOrchestratorAgent,
  createProductOwnerAgent,
  createQaAgent,
} from "./agents";
import {
  DevOutput,
  DevOutputSchema,
  DevResearchOutput,
  DevResearchOutputSchema,
  ImplementationOutput,
  ImplementationOutputSchema,
  OrchestratorOutput,
  OrchestratorOutputSchema,
  PoOutput,
  PoOutputSchema,
  QaOutput,
  QaOutputSchema,
} from "./schemas";
import { createRepoTools } from "./tools";

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
  enableImplementation?: boolean;
}

export interface WorkflowResult {
  requestId: string;
  poDraft: PoOutput;
  devResearch: DevResearchOutput;
  po: PoOutput;
  dev: DevOutput;
  implementation?: ImplementationOutput;
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

const buildDevResearchPrompt = (
  input: WorkflowInput,
  poDraft: PoOutput,
): string => {
  return [
    "당신은 PO 질문에 답하기 위해 현재 스펙과 코드를 조사합니다.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "PO Draft Output (JSON):",
    JSON.stringify(poDraft),
    "questionsForDev에 대한 답변과 근거를 제공하세요.",
  ].join("\n");
};

const buildPoRefinementPrompt = (
  input: WorkflowInput,
  poDraft: PoOutput,
  devResearch: DevResearchOutput,
): string => {
  return [
    "DEV 조사 결과를 반영해 PO 산출물을 보완하세요.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "PO Draft Output (JSON):",
    JSON.stringify(poDraft),
    "DEV Research Output (JSON):",
    JSON.stringify(devResearch),
    "목표, 수용 기준, 제약, 질문을 업데이트하세요.",
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

const buildImplementationPrompt = (
  input: WorkflowInput,
  po: PoOutput,
  dev: DevOutput,
): string => {
  return [
    "당신은 실제 코드 변경을 수행합니다.",
    `Task: ${input.task}`,
    `Context: ${input.context ?? "(없음)"}`,
    "PO Output (JSON):",
    JSON.stringify(po),
    "Developer Output (JSON):",
    JSON.stringify(dev),
    "리포지토리 도구를 활용해 변경을 수행하고 결과를 보고하세요.",
  ].join("\n");
};

const buildOrchestratorPrompt = (
  input: WorkflowInput,
  po: PoOutput,
  dev: DevOutput,
  qa: QaOutput,
  implementation?: ImplementationOutput,
): string => {
  const implementationBlock = implementation
    ? ["Implementation Output (JSON):", JSON.stringify(implementation)]
    : [];

  return [
    "PO, Developer, QA 출력을 합성해 최종 결정을 내리세요.",
    `Task: ${input.task}`,
    "PO Output (JSON):",
    JSON.stringify(po),
    "Developer Output (JSON):",
    JSON.stringify(dev),
    "QA Output (JSON):",
    JSON.stringify(qa),
    ...implementationBlock,
    "결정, 근거, 다음 단계를 반환하세요.",
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
  const maxTurns = options.maxTurns ?? 6;
  const repoRoot = options.repoRoot ?? process.cwd();
  const productOwnerAgent = createProductOwnerAgent();
  const developerResearchAgent = createDeveloperResearchAgent(
    createRepoTools(repoRoot, "DeveloperResearch"),
  );
  const developerAgent = createDeveloperAgent(
    createRepoTools(repoRoot, "Developer"),
  );
  const implementationAgent = createImplementationAgent(
    createRepoTools(repoRoot, "Implementation"),
  );
  const qaAgent = createQaAgent();
  const orchestratorAgent = createOrchestratorAgent();
  const enableImplementation = options.enableImplementation ?? false;

  log("workflow.start", { requestId, task: input.task });

  log("workflow.step.po_draft.start", { requestId });
  const poDraftResult = await runner.run(
    productOwnerAgent,
    buildPoPrompt(input),
    {
      maxTurns,
    },
  );
  const poDraft = PoOutputSchema.parse(poDraftResult.finalOutput);
  log("workflow.step.po_draft.done", {
    requestId,
    questionsForDevCount: poDraft.questionsForDev.length,
  });

  log("workflow.step.dev_research.start", { requestId });
  const devResearchResult = await runner.run(
    developerResearchAgent,
    buildDevResearchPrompt(input, poDraft),
    {
      maxTurns,
    },
  );
  const devResearch = DevResearchOutputSchema.parse(
    devResearchResult.finalOutput,
  );
  log("workflow.step.dev_research.done", {
    requestId,
    answersForPoCount: devResearch.answersForPo.length,
    filesVisitedCount: devResearch.filesVisited.length,
  });

  log("workflow.step.po_refine.start", { requestId });
  const poResult = await runner.run(
    productOwnerAgent,
    buildPoRefinementPrompt(input, poDraft, devResearch),
    {
      maxTurns,
    },
  );
  const po = PoOutputSchema.parse(poResult.finalOutput);
  log("workflow.step.po_refine.done", {
    requestId,
    acceptanceCriteriaCount: po.acceptanceCriteria.length,
  });

  log("workflow.step.dev_plan.start", { requestId });
  const devResult = await runner.run(
    developerAgent,
    buildDevPrompt(input, po),
    {
      maxTurns,
    },
  );
  const dev = DevOutputSchema.parse(devResult.finalOutput);
  log("workflow.step.dev_plan.done", {
    requestId,
    planCount: dev.plan.length,
    filesToTouchCount: dev.filesToTouch.length,
  });

  let implementation: ImplementationOutput | undefined;
  if (enableImplementation) {
    log("workflow.step.implementation.start", { requestId });
    const implementationResult = await runner.run(
      implementationAgent,
      buildImplementationPrompt(input, po, dev),
      {
        maxTurns,
      },
    );
    implementation = ImplementationOutputSchema.parse(
      implementationResult.finalOutput,
    );
    log("workflow.step.implementation.done", {
      requestId,
      filesChangedCount: implementation.filesChanged.length,
    });
  }

  log("workflow.step.qa.start", { requestId });
  const qaResult = await runner.run(qaAgent, buildQaPrompt(input, po, dev), {
    maxTurns,
  });
  const qa = QaOutputSchema.parse(qaResult.finalOutput);
  log("workflow.step.qa.done", {
    requestId,
    testPlanCount: qa.testPlan.length,
  });

  log("workflow.step.synthesis.start", { requestId });
  const orchestratorResult = await runner.run(
    orchestratorAgent,
    buildOrchestratorPrompt(input, po, dev, qa, implementation),
    {
      maxTurns,
    },
  );
  const synthesis = OrchestratorOutputSchema.parse(
    orchestratorResult.finalOutput,
  );
  log("workflow.step.synthesis.done", {
    requestId,
    decision: synthesis.decision,
  });

  log("workflow.done", { requestId });
  return {
    requestId,
    poDraft,
    devResearch,
    po,
    dev,
    implementation,
    qa,
    synthesis,
  };
}
