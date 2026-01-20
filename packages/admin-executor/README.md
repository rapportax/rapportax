# Admin Executor

Slack에서 어드민 API를 실행하기 위한 패키지입니다.
MVP는 ID/PW 인증과 두 가지 문제(개인 Pro plan, org tier/credit) 해결에 집중합니다.

## 개발용 메모
- Postgres는 루트 `docker-compose.yml`의 `postgres` 서비스 사용
- 스키마는 `sql/schema.sql`에 통합 관리
- 실제 어드민 API 엔드포인트와 권한 모델은 확정되면 `admin-api` 모듈에 반영
- UI는 기본 CSS 기반

## 환경 변수 (초기)
- `DATABASE_URL` (없으면 `postgres://rapportax:rapportax@localhost:5432/rapportax`)
- `ADMIN_API_BASE_URL` (mock 기준: `http://localhost:3000`)
 
## 관리자 계정 (초기)
`admin_auth_users` 테이블에 직접 등록합니다.
```sql
INSERT INTO admin_auth_users (username, password)
VALUES ('admin', 'pass1234');
```

## 토큰 발급 응답 형식 (가정)
```json
{ "access_token": "..." }
```

## API (초기)
OpenAPI 스펙: `docs/admin-executor-openapi.yaml`

### POST /api/auth
ID/PW로 어드민 토큰 발급.

요청:
```json
{ "username": "...", "password": "..." }
```

응답:
```json
{ "ok": true, "accessToken": "..." }
```

### POST /api/admin
Slack 명령을 실행. `Authorization: Bearer <token>` 또는 `credentials` 사용.

요청:
```json
{
  "rawText": "pro-plan grant --userId=...",
  "actor": { "id": "U123", "scopes": ["PERSONAL_PLAN_ADMIN"] }
}
```

### POST /api/admin/users/{userId}/plan/grant
Bearer 토큰으로 개인 플랜을 변경 (기본 `pro`).

### POST /api/admin/users/{userId}/org/assign
Bearer 토큰으로 사용자 org 소속을 변경.

### GET /api/admin/users/{userId}
Bearer 토큰으로 사용자 plan/org 조회.

### GET /api/admin/users/{userId}/detail
Bearer 토큰으로 사용자 plan + org 상세(tier/credit) 조회.

### GET /api/admin/users
Bearer 토큰으로 사용자 리스트 조회.

### GET /api/admin/orgs/{orgId}
Bearer 토큰으로 org tier/credit 조회.

### GET /api/admin/orgs
Bearer 토큰으로 org 리스트 조회.

### POST /api/admin/orgs/{orgId}/tier/update
Bearer 토큰으로 org tier 변경.

### POST /api/admin/orgs/{orgId}/credit/update
Bearer 토큰으로 org credit 변경 (`credit` 또는 `creditDelta`).

## Web UI (초기)
`/` 페이지에서 토큰 발급과 plan/tier/credit 변경을 실행할 수 있습니다.
