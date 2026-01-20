import { runMultiAgentWorkflow } from "./index";

async function main(): Promise<void> {
  const result = await runMultiAgentWorkflow({
    task: "회의록에서 암시된 후속 조치를 찾아 정리",
    context: "지난 스프린트 회고 회의록",
    constraints: ["개인정보 최소화", "자동 생성 금지"],
  });

  console.log(JSON.stringify(result.synthesis, null, 2));
}

main().catch((error) => {
  console.error("workflow failed", error);
  process.exit(1);
});
