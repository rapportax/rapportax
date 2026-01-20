import path from "path";
import { runMultiAgentWorkflow } from "./index";
import { createJsonlLogger } from "./monitor/logger";

const LOCAL_TASKS = [
  {
    title: "MCP 도구 호출 진행 로그를 확인할 수 있는 내부 훅 보강",
    summary:
      "openai-agents-js 로컬 코드 기반으로 구현 가능한 개선 과제를 도출하고 코드 변경을 수행합니다.",
    scope: "agents-core",
  },
  {
    title: "Runner 로깅 이벤트의 문맥 정보(에이전트/턴) 노출 강화",
    summary:
      "로그 이벤트에 에이전트 이름과 턴 정보를 포함하도록 개선 가능한지 탐색합니다.",
    scope: "agents-core",
  },
  {
    title: "Tool 실행 오류 핸들링의 결과 포맷 표준화",
    summary:
      "tool 실행 실패 시 반환되는 에러 구조를 통일하고 사용자 가이드를 보강합니다.",
    scope: "agents-core",
  },
];

const pickLocalTask = () => {
  const indexRaw = process.env.TASK_INDEX;
  if (indexRaw) {
    const parsed = Number.parseInt(indexRaw, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < LOCAL_TASKS.length) {
      return LOCAL_TASKS[parsed];
    }
  }

  return LOCAL_TASKS[Math.floor(Math.random() * LOCAL_TASKS.length)];
};

async function main(): Promise<void> {
  const logPath = path.resolve(__dirname, "..", "..", "monitor", "agent-log.jsonl");
  const logger = createJsonlLogger(logPath);

  const selectedTask = pickLocalTask();
  const result = await runMultiAgentWorkflow(
    {
      task: `OpenAI Agents JS SDK 코드 작업 예시 도출 (${selectedTask.title})`,
      context: [
        "GitHub API 없이 로컬 리포지토리만 기반으로 작업을 정의",
        `Task Summary: ${selectedTask.summary}`,
        `Scope: ${selectedTask.scope}`,
        "문서화 대신 실제 코드 변경 작업을 목표로 범위를 정의",
        "openai-agents-js 리포지토리 코드를 확인해 구현 방향을 구체화",
      ].join("\n"),
      constraints: [
        "개인정보 최소화",
        "자동 생성 금지",
        "한국어로 요약",
        "문서화 작업 제외, 코드 변경 중심",
      ],
    },
    {
      repoRoot: "/Users/giyeonkim/Projects/rapportax/.repos/openai-agents-js",
      maxTurns: 50,
      logger,
    },
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("workflow failed", error);
  process.exit(1);
});
