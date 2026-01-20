# Active TODO Discovery Bot (AGENTS)

## 미션
조직 내 신호로부터 업무 의무(Obligation)를 탐지해 사람이 판단할 TODO 후보를 제안한다.

## 제품 노스스타
"이 봇은 TODO를 관리하지 않는다. 아무도 적지 않았지만 해야 했던 일을 찾아낸다."

## 핵심 원칙
- 업무 의무에 집중: 암시됨, 약속됨, 자동 발생해야 함, 누락 시 리스크가 있는 일.
- Human-in-the-loop: 제안만 하며 자동 생성하지 않음; 모든 판단 로그 기록.
- 단일 책임 에이전트 + 중앙 오케스트레이터만 제어.
- 프롬프트 내 개인정보 최소화; 결정 로그는 불변.

## 상위 아키텍처
Input Sources -> Event Normalizer -> Multi-Agent Layer -> Decision Agent -> TODO Candidate -> Human Decision

## 에이전트 역할 (단일 책임)
- Context Scanner Agent: 텍스트에서 행동을 암시하는 문장 탐지.
- State Change Agent: 시스템 이벤트를 의무로 매핑.
- Risk Agent: 미이행 리스크 점수와 영향도 산출.
- Dependency Agent: 중복/선행 여부 판단.
- Ownership Agent: 책임자(사용자/팀) 추론.
- Decision Agent: PROPOSE/HOLD/IGNORE 결정 및 근거 제공.

## Agent SDK 규칙
- OpenAI Agent SDK (JS) 사용.
- 에이전트 간 직접 호출 금지.
- 공유 상태는 오케스트레이터가 전달하는 Context Object만 사용.

## 데이터 계약
### Context Scanner 출력
{
  signalType: "ACTION_HINT",
  sentence: string,
  confidence: number
}

### State Change 출력
{
  trigger: "DEPLOY",
  inferredObligation: string
}

### Risk 출력
{
  riskScore: number,
  impact: "LOW" | "MEDIUM" | "HIGH",
  reason: string
}

### Dependency 출력
{
  isDuplicate: boolean,
  blockingTaskIds?: string[]
}

### Ownership 출력
{
  ownerType: "USER" | "TEAM",
  ownerId: string,
  confidence: number
}

### Decision 출력
{
  decision: "PROPOSE" | "HOLD" | "IGNORE",
  rationale: string[]
}

## TODO 후보 모델 (TypeScript)
interface TodoCandidate {
  id: string;
  title: string;
  source: string;
  inferredReason: string;
  riskScore: number;
  suggestedOwner?: string;
  decisionLog: DecisionLog[];
}

## 판단 로그 모델
{
  actor: "HUMAN" | "AI",
  action: "CREATE" | "HOLD" | "IGNORE",
  reason: string,
  timestamp: Date
}

## MVP 범위
- Phase 1: 입력 = 회의록 + PR 코멘트; 에이전트 = Context Scanner + Decision Agent; 출력 = Slack DM.
- Phase 2: 시스템 이벤트 연동, Risk Agent 추가, Ownership 추론.

## 비목표
- Jira/Linear 대체 금지.
- TODO 자동 생성 금지.
- 개인 생산성 앱 지향 금지.

## 보안 및 컴플라이언스
- 프롬프트에 개인정보 최소화.
- Role-based access; 판단 이력은 불변.
- AI 판단과 사람 판단을 분리 기록.

## 기여자 작업 노트
- Node.js + TypeScript 기반 이벤트 드리븐 구조 선호.
- 판단 로그는 PostgreSQL, 컨텍스트 캐시는 Redis.
- 신규 에이전트는 입력/출력 스키마와 단일 책임을 명시.
