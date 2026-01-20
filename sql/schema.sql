CREATE TABLE IF NOT EXISTS obligation_candidates (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  inferred_reason TEXT NOT NULL,
  risk_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  suggested_owner TEXT,
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY,
  candidate_id UUID,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_logs_candidate_id_idx
  ON decision_logs(candidate_id);

CREATE TABLE IF NOT EXISTS admin_exec_requests (
  id UUID PRIMARY KEY,
  candidate_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  action_type TEXT NOT NULL,
  requested_by_user_id TEXT,
  target_user_id TEXT,
  target_org_id TEXT,
  payload JSONB,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_exec_requests_candidate_id_idx
  ON admin_exec_requests(candidate_id);

CREATE TABLE IF NOT EXISTS admin_user_tokens (
  slack_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_id_idx
  ON admin_audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS admin_audit_logs_command_idx
  ON admin_audit_logs(command);

CREATE TABLE IF NOT EXISTS admin_tokens (
  token TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_tokens_actor_id_idx
  ON admin_tokens(actor_id);

CREATE TABLE IF NOT EXISTS admin_auth_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_orgs (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free',
  credit INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_user_orgs (
  user_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_user_orgs_org_id_idx
  ON admin_user_orgs(org_id);

INSERT INTO admin_auth_users (username, password)
VALUES ('admin', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO admin_orgs (id, tier, credit)
VALUES
  ('org123', 'pro', 1200),
  ('org456', 'team', 450),
  ('org789', 'enterprise', 5000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_users (id, plan)
VALUES
  ('user123', 'pro'),
  ('user456', 'free'),
  ('user789', 'enterprise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_user_orgs (user_id, org_id)
VALUES
  ('user123', 'org123'),
  ('user456', 'org456'),
  ('user789', 'org123')
ON CONFLICT (user_id) DO NOTHING;
