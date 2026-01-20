# Obligation Bot Package

## 목적
Slack 이벤트와 기타 신호를 지속적으로 수집해 개인 의무(Obligation)를 탐지하고,
이미 완료된 일인지 AI로 판단한 뒤, 사람(HITL)이 결정할 후보를 제안한다.
승인 시 적절한 worker를 할당해 실행한다.

## 핵심 흐름
1) 이벤트 수집 (Slack 이벤트/기타 소스)
2) 이벤트 정규화 (Context Object)
3) 의무 신호 탐지 (Context Scanner)
4) Done 판단 (AI 판단, 고정 키워드 미사용)
5) 의무 후보 생성 + 결정 (Decision Agent)
6) 후보 저장 + 판단 로그 기록 (PostgreSQL)
7) App Home에 후보 리스트 표시
8) Execute/Hold/Ignore 처리

## Phase 1 결정사항
- Slack Event API의 최소 필드만 사용
- Done 판단은 AI가 수행
- Worker 리스트는 추상 모델 유지
- 저장소: PostgreSQL
- HITL UI: Slack App Home

## Slack 이벤트 스키마 (Phase 1)
```ts
interface SlackEventEnvelope {
  event_id: string;
  event_time: number;
  type: "event_callback";
  event: {
    type: "message" | "app_mention" | "reaction_added";
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
  };
}
```

## Worker 추상 모델
```ts
interface WorkerDefinition {
  id: string;
  name: string;
  description?: string;
  capabilityTags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}
```

## 환경변수
필수
- `DATABASE_URL`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
 - `PORT` (기본값 3000)
 - `SLACK_APP_TOKEN` (Socket Mode)

선택
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (기본: gpt-5.2)
 - `OPENAI_BASE_URL`

## 구현 현황
구현됨
- Slack 이벤트 정규화
- 파이프라인 기본 흐름 (Context Scanner/Decision/Done/Risk)
- 후보 생성/저장/조회
- Decision log 저장
- App Home view 빌더
- Execute/Hold/Ignore 액션 라우팅
- Slack 이벤트 처리/액션 처리 서비스 레이어
- PostgreSQL 스키마 + docker-compose
- Slack 서명 검증 및 이벤트/액션 핸들러
- App Home publish 호출
- Slack HTTP 서버 (Events/Interactivity/App Home publish)
- OpenAI Agent SDK 기반 에이전트 연결

미구현 (요청 필요)
 - Worker 실행 런타임 및 실제 worker 레지스트리

## 디렉터리 구조
```

## Admin 실행 분리
- Admin 실행/인증/토큰 관리 및 AI 실행 플로우는 `admin-executor`로 이관
- Obligation Bot은 Slack 인터페이스 + 후보 관리에만 집중
packages/obligation-bot/
  src/
    agents/
    ingest/
    logging/
    normalize/
    slack/
    storage/
    triage/
    workers/
    index.ts
  sql/
```

## 다음 확인 필요
- Slack App 설정(Events URL, Interactivity URL)
- App Home UI publish 타이밍
- Worker 실행 방식 (내부 프로세스/외부 큐)
- OpenAI 모델/정책

## 실행 준비 (로컬)
1) PostgreSQL 실행
```
docker compose up -d
```

2) 스키마 적용
```
psql \"$DATABASE_URL\" -f sql/schema.sql
```

3) 환경변수 설정
- `.env.example` 참고해서 `.env.local` 생성 (루트 기준으로 자동 로드)

4) 서버 실행
```
pnpm --filter @rapportax/obligation-bot slack:dev
```

Socket Mode 실행
```
pnpm --filter @rapportax/obligation-bot slack:socket
```

## Slack App 설정 체크리스트 (Socket Mode)
- Socket Mode 활성화 + App-Level Token 발급 (`connections:write`)
- App Home 활성화
- Event Subscriptions (Bot Events)
  - `app_home_opened`, `app_mention`, `message`
- Interactivity & Shortcuts 활성화

## 권장 Bot Token Scope
- `app_mentions:read`
- `channels:history` (공개 채널 메시지 수신 시)
- `im:history` (DM 메시지 수신 시)
- `app_home:read`
- `app_home:write`
- `chat:write` (App Home publish)
