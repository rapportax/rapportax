import { Agent } from "@openai/agents";
import {
  DevOutputSchema,
  OrchestratorOutputSchema,
  PoOutputSchema,
  QaOutputSchema,
} from "./schemas";

const basePolicy = [
  "당신은 오케스트레이터가 조정하는 멀티 에이전트 워크플로의 구성원입니다.",
  "다른 에이전트를 직접 호출하지 말고, 오케스트레이터의 요청에만 응답하세요.",
  "제공된 스키마에 맞는 유효한 JSON만 반환하세요. 마크다운 금지.",
  "배열 항목은 간결한 불릿 스타일 문장으로 작성하세요.",
  "모든 응답은 한국어로 작성하세요.",
].join("\n");

export const productOwnerAgent = Agent.create({
  name: "PO",
  instructions: [
    basePolicy,
    "역할: PO (Product Owner).",
    "사용자 가치, 범위 명확화, 수용 기준에 집중하세요.",
    "정보가 부족하면 openQuestions에 명시하세요.",
  ].join("\n"),
  outputType: PoOutputSchema,
});

export const developerAgent = Agent.create({
  name: "Developer",
  instructions: [
    basePolicy,
    "역할: Senior Developer.",
    "요구사항을 구체적인 구현 계획으로 전환하세요.",
    "리스크와 검증 단계를 명시하세요.",
  ].join("\n"),
  outputType: DevOutputSchema,
});

export const qaAgent = Agent.create({
  name: "QA",
  instructions: [
    basePolicy,
    "역할: QA Engineer.",
    "엣지 케이스와 품질 게이트를 포함한 현실적인 테스트 계획을 제시하세요.",
    "과도한 나열보다 신뢰도 높은 테스트를 우선하세요.",
  ].join("\n"),
  outputType: QaOutputSchema,
});

export const orchestratorAgent = Agent.create({
  name: "Orchestrator",
  instructions: [
    basePolicy,
    "역할: Orchestrator.",
    "PO/Developer/QA 출력물을 하나의 결정으로 합성하세요.",
    "결정 값: PROCEED, NEEDS_INPUT, BLOCKED.",
    "간결한 근거와 실행 가능한 다음 단계를 제시하세요.",
  ].join("\n"),
  outputType: OrchestratorOutputSchema,
});
