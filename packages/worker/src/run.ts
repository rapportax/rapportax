import path from "path";
import { runMultiAgentWorkflow } from "./index";
import { createJsonlLogger } from "./monitor/logger";

type GitHubIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: Array<{ name: string }>;
  pull_request?: object;
};

const GITHUB_API_BASE = "https://api.github.com";
const TARGET_REPO = "openai/openai-agents-js";

const fetchOpenIssues = async (repo: string): Promise<GitHubIssue[]> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repo}/issues?state=open&per_page=30`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub issues fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as GitHubIssue[];
  return data.filter((issue) => !issue.pull_request);
};

const pickCodeIssue = (issues: GitHubIssue[]): GitHubIssue | null => {
  const normalized = issues.map((issue) => ({
    ...issue,
    labelNames: issue.labels.map((label) => label.name.toLowerCase()),
  }));

  const preferred = normalized.find((issue) =>
    issue.labelNames.some(
      (label) =>
        label.includes("bug") ||
        label.includes("enhancement") ||
        label.includes("good first issue") ||
        label.includes("package:agents-core") ||
        label.includes("package:agents-openai") ||
        label.includes("package:agents-realtime") ||
        label.includes("package:agents-extensions"),
    ),
  );

  const candidate = preferred ?? normalized[0];
  return candidate ?? null;
};

async function main(): Promise<void> {
  const issues = await fetchOpenIssues(TARGET_REPO);
  const targetIssue = pickCodeIssue(issues);

  if (!targetIssue) {
    throw new Error("No open issues found to process.");
  }

  const labelText =
    targetIssue.labels.length > 0
      ? targetIssue.labels.map((label) => label.name).join(", ")
      : "none";
  const logPath = path.resolve(__dirname, "..", "monitor", "agent-log.jsonl");
  const logger = createJsonlLogger(logPath);

  const result = await runMultiAgentWorkflow(
    {
      task: `OpenAI Agents JS SDK 코드 작업 예시 도출 (이슈 #${targetIssue.number}: ${targetIssue.title})`,
      context: [
        "GitHub 오픈 이슈 중 코드 변경이 필요한 항목을 선택",
        `Issue URL: ${targetIssue.html_url}`,
        `Labels: ${labelText}`,
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
      enableImplementation: true,
      logger,
    },
  );

  console.log(
    JSON.stringify(
      {
        synthesis: result.synthesis,
        implementation: result.implementation,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("workflow failed", error);
  process.exit(1);
});
