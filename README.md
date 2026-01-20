# rapportax

조직 신호에서 숨은 업무 의무를 찾아 사람이 판단할 TODO 후보를 제안하는 멀티 에이전트 워크플로를 개발합니다.

## 패키지
- `packages/worker`: OpenAI Agent SDK 기반 멀티 에이전트 워커
- `packages/todo`: TODO 모델 샘플

## 워커 개요
`packages/worker`는 오케스트레이터가 PO, Developer, QA 에이전트를 순차 호출해 의사결정을 합성합니다.
자세한 설계 규칙은 `AGENTS.md`를 참고하세요.

## 빠른 시작
```bash
pnpm install
export OPENAI_API_KEY="YOUR_API_KEY"
pnpm --filter @rapportax/worker dev
```

## 사용 예시
```ts
import { runMultiAgentWorkflow } from "@rapportax/worker";

const result = await runMultiAgentWorkflow({
  task: "회의록에서 암시된 후속 조치를 찾아 정리",
  context: "지난 스프린트 회고 회의록",
  constraints: ["개인정보 최소화", "자동 생성 금지"],
});

console.log(result.synthesis);
```

## 에이전트 모니터 화면
로컬 로그를 기반으로 에이전트 실행 상태를 확인할 수 있습니다.

```bash
pnpm --filter @rapportax/worker monitor
```

브라우저에서 `http://localhost:8787`에 접속하면 실시간 이벤트가 표시됩니다.
