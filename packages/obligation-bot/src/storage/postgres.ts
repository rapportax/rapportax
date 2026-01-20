import { Pool } from "pg";
import { randomUUID } from "crypto";
import type { AdminExecRequest, DecisionLog, TodoCandidate } from "../types";
import type {
  DecisionLogRepository,
  CandidateRepository,
  CandidateStatus,
  AdminExecRequestRepository,
  AdminTokenRepository,
} from "./interfaces";

export interface PostgresConfig {
  connectionString: string;
}

export class PostgresClient {
  private readonly pool: Pool;

  constructor(config: PostgresConfig) {
    this.pool = new Pool({ connectionString: config.connectionString });
  }

  async query<T>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async execute(text: string, params?: unknown[]): Promise<void> {
    await this.pool.query(text, params);
  }
}

export class PostgresCandidateRepository implements CandidateRepository {
  constructor(private readonly client: PostgresClient) {}

  async create(candidate: TodoCandidate): Promise<void> {
    await this.client.execute(
      "INSERT INTO obligation_candidates (id, title, source, inferred_reason, risk_score, suggested_owner, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        candidate.id,
        candidate.title,
        candidate.source,
        candidate.inferredReason,
        candidate.riskScore,
        candidate.suggestedOwner ?? null,
        "PROPOSED",
      ],
    );
  }

  async listOpen(): Promise<TodoCandidate[]> {
    const rows = await this.client.query<{
      id: string;
      title: string;
      source: string;
      inferred_reason: string;
      risk_score: number;
      suggested_owner: string | null;
    }>(
      "SELECT id, title, source, inferred_reason, risk_score, suggested_owner FROM obligation_candidates WHERE status = 'PROPOSED' ORDER BY created_at DESC",
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      inferredReason: row.inferred_reason,
      riskScore: row.risk_score,
      suggestedOwner: row.suggested_owner ?? undefined,
      decisionLog: [],
    }));
  }

  async updateStatus(id: string, status: CandidateStatus): Promise<void> {
    await this.client.execute(
      "UPDATE obligation_candidates SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id],
    );
  }
}

export class PostgresDecisionLogRepository implements DecisionLogRepository {
  constructor(private readonly client: PostgresClient) {}

  async append(entry: DecisionLog, candidateId?: string): Promise<void> {
    await this.client.execute(
      "INSERT INTO decision_logs (id, candidate_id, actor, action, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        randomUUID(),
        candidateId ?? null,
        entry.actor,
        entry.action,
        entry.reason,
        entry.timestamp,
      ],
    );
  }
}

export class PostgresAdminExecRequestRepository implements AdminExecRequestRepository {
  constructor(private readonly client: PostgresClient) {}

  async create(request: AdminExecRequest): Promise<void> {
    await this.client.execute(
      `INSERT INTO admin_exec_requests
       (id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        request.id,
        request.candidateId,
        request.status,
        request.actionType,
        request.requestedByUserId ?? null,
        request.targetUserId ?? null,
        request.targetOrgId ?? null,
        request.payload ? JSON.stringify(request.payload) : null,
        request.rationale ?? null,
      ],
    );
  }

  async listPending(): Promise<AdminExecRequest[]> {
    const rows = await this.client.query<{
      id: string;
      candidate_id: string;
      status: string;
      action_type: string;
      requested_by_user_id: string | null;
      target_user_id: string | null;
      target_org_id: string | null;
      payload: Record<string, unknown> | null;
      rationale: string | null;
    }>(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE status = 'PENDING_APPROVAL' ORDER BY created_at DESC",
    );

    return rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: row.requested_by_user_id ?? undefined,
      targetUserId: row.target_user_id ?? undefined,
      targetOrgId: row.target_org_id ?? undefined,
      payload: row.payload ?? undefined,
      rationale: row.rationale ?? undefined,
    }));
  }

  async listPendingByCandidate(candidateId: string): Promise<AdminExecRequest[]> {
    const rows = await this.client.query<{
      id: string;
      candidate_id: string;
      status: string;
      action_type: string;
      requested_by_user_id: string | null;
      target_user_id: string | null;
      target_org_id: string | null;
      payload: Record<string, unknown> | null;
      rationale: string | null;
    }>(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE candidate_id = $1 AND status = 'PENDING_APPROVAL' ORDER BY created_at DESC",
      [candidateId],
    );

    return rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: row.requested_by_user_id ?? undefined,
      targetUserId: row.target_user_id ?? undefined,
      targetOrgId: row.target_org_id ?? undefined,
      payload: row.payload ?? undefined,
      rationale: row.rationale ?? undefined,
    }));
  }

  async updateStatus(id: string, status: AdminExecRequest["status"]): Promise<void> {
    await this.client.execute(
      "UPDATE admin_exec_requests SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id],
    );
  }

  async getById(id: string): Promise<AdminExecRequest | null> {
    const rows = await this.client.query<{
      id: string;
      candidate_id: string;
      status: string;
      action_type: string;
      requested_by_user_id: string | null;
      target_user_id: string | null;
      target_org_id: string | null;
      payload: Record<string, unknown> | null;
      rationale: string | null;
    }>(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE id = $1 LIMIT 1",
      [id],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      candidateId: row.candidate_id,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: row.requested_by_user_id ?? undefined,
      targetUserId: row.target_user_id ?? undefined,
      targetOrgId: row.target_org_id ?? undefined,
      payload: row.payload ?? undefined,
      rationale: row.rationale ?? undefined,
    };
  }
}

export class PostgresAdminTokenRepository implements AdminTokenRepository {
  constructor(private readonly client: PostgresClient) {}

  async upsert(slackUserId: string, accessToken: string): Promise<void> {
    await this.client.execute(
      `INSERT INTO admin_user_tokens (slack_user_id, access_token)
       VALUES ($1, $2)
       ON CONFLICT (slack_user_id)
       DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = NOW()`,
      [slackUserId, accessToken],
    );
  }

  async get(slackUserId: string): Promise<string | null> {
    const rows = await this.client.query<{ access_token: string }>(
      "SELECT access_token FROM admin_user_tokens WHERE slack_user_id = $1",
      [slackUserId],
    );
    return rows[0]?.access_token ?? null;
  }
}
