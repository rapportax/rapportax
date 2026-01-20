# Admin Executor Package (Draft)

## 목적
특정 어드민을 직접 실행하는 worker를 위한 전용 어드민 패키지를 만든다.
Slack에서 개인 인증을 거쳐 어드민 API를 직접 호출할 수 있게 하여,
당장 발생한 운영 이슈를 빠르게 해결한다.

## 1차 해결 대상 문제
- 개인에게 Pro plan이 제대로 적용되지 않는 문제
- 조직(org)에 tier와 credit이 제대로 적용되지 않는 문제

## 핵심 원칙
- 기존 어드민 API를 재사용하고 최소한의 래핑만 제공한다.
- Slack에서 실행하되, 사람 승인과 인증을 반드시 거친다.
- 실행/결정 로그는 불변(append-only)으로 기록한다.
- 개인정보/민감정보는 최소 수집, 최소 보관한다.

## MVP 범위
- Slack slash command 또는 message action으로 요청 접수
- 개인 인증(1회 또는 세션 기반)
- 어드민 API 호출(두 문제에 한정된 엔드포인트)
- 결과 요약 및 로그 기록

## 비목표
- 어드민 기능 전체를 Slack으로 옮기기
- 자동 실행(사람 승인 없이 실행)
- 기존 어드민 UI 대체

## 사용자 플로우 (MVP)
1) Slack에서 명령 실행
2) 사용자의 개인 인증 수행(ID/PW → 어드민 토큰 발급)
3) 실행 대상/파라미터 확인(사람 승인)
4) 어드민 토큰으로 API 호출
5) 결과 및 후속 액션 안내
6) 불변 로그 기록

## Slack 인터페이스 제안
### 명령 예시
- `/admin-exec pro-plan grant --userId=...`
- `/admin-exec org-tier fix --orgId=... --tier=... --credit=...`

### 응답 형식
- 실행 요약: 누가/무엇을/왜/어떤 API를 호출했는지
- 결과 요약: 성공/실패/부분 성공
- 로그 링크(또는 로그 ID)

## 인증/승인 정책
- 개인 인증: DB에 등록된 ID/PW로 어드민 토큰 발급 후 해당 토큰으로 API 호출
- 승인 모델: 요청자 = 승인자(초기) + 선택적으로 2인 승인 옵션
- 승인 타임아웃 및 만료 정책 명시

## 어드민 API 래퍼 설계
### 공통
- API 호출 전/후 표준 로깅
- 요청/응답 페이로드는 최소한으로 저장
- 실패 시 재시도/중복 실행 방지(idempotency key)

### 후보 엔드포인트 (예시)
- `POST /api/admin/users/{id}/plan/grant`
- `POST /api/admin/orgs/{id}/tier/update`
- `POST /api/admin/orgs/{id}/credit/update`

## 로깅 및 감사
- 실행 로그 (immutable)
  - who: Slack userId, role
  - what: 명령, 파라미터(민감정보 마스킹)
  - when: timestamp
  - result: success/failure, error summary
- 의사결정 로그: 승인/거절 이유

## 에러/안전장치
- 파라미터 검증(존재 여부, 포맷, 권한)
- 실행 전 최종 확인(내용 요약)
- 실패 시 복구 가이드 또는 티켓 생성 링크

## API 스펙
- OpenAPI: `docs/admin-executor-openapi.yaml`

## 데이터 모델 (Mock)
- `admin_users`: 개인 plan 저장
- `admin_orgs`: org tier/credit 저장
- `admin_user_orgs`: 사용자-조직 소속 매핑

## 패키지 구조 (제안)
```
packages/admin-executor/
  README.md
  next.config.js
  next-env.d.ts
  src/
    index.ts
    app/
      page.tsx
      layout.tsx
      api/
        auth/
          route.ts
        admin/
          users/[userId]/org/assign/route.ts
          users/[userId]/detail/route.ts
          users/route.ts
          users/[userId]/route.ts
          users/[userId]/plan/grant/route.ts
          orgs/route.ts
          orgs/[orgId]/route.ts
          orgs/[orgId]/tier/update/route.ts
          orgs/[orgId]/credit/update/route.ts
          route.ts
    slack/
      commands.ts
      handlers.ts
    auth/
      idPassword.ts
      adminToken.ts
    admin-api/
      client.ts
      endpoints.ts
    logging/
      audit.ts
    db/
      pool.ts
```

## 의존성/환경
- Node.js + TypeScript
- 기본 CSS
- Slack API (slash command + interactive message)
- 기존 어드민 API 인증 토큰/서비스 계정
- Postgres (루트 docker-compose의 `postgres`와 연동)
- 스키마: `sql/schema.sql`

## 오픈 질문
- 어드민 API의 실제 엔드포인트와 권한 모델은?
- 권한 모델은 OpenAI 내부 모델을 따를 수 있는지?
- 승인 모델은 1인 승인으로 시작해도 되는지?
- 로그 저장소는 어디로 할지? (PostgreSQL, S3, etc.)
- 실패 시 자동 복구/롤백이 필요한지?
