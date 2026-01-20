import { randomUUID } from "crypto";
import { getPool } from "../db/pool";
import type { AdminExecRequest, AdminExecRequestRepository, DecisionLog, DecisionLogRepository } from "./types";

export class PostgresAdminExecRequestRepository implements AdminExecRequestRepository {
  async create(request: AdminExecRequest): Promise<void> {
    const pool = getPool();
    await pool.query(
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
    const pool = getPool();
    const result = await pool.query(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE status = 'PENDING_APPROVAL' ORDER BY created_at DESC",
    );

    return result.rows.map((row) => ({
      id: row.id as string,
      candidateId: row.candidate_id as string,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: (row.requested_by_user_id as string | null) ?? undefined,
      targetUserId: (row.target_user_id as string | null) ?? undefined,
      targetOrgId: (row.target_org_id as string | null) ?? undefined,
      payload: (row.payload as Record<string, unknown> | null) ?? undefined,
      rationale: (row.rationale as string | null) ?? undefined,
    }));
  }

  async listPendingByCandidate(candidateId: string): Promise<AdminExecRequest[]> {
    const pool = getPool();
    const result = await pool.query(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE candidate_id = $1 AND status = 'PENDING_APPROVAL' ORDER BY created_at DESC",
      [candidateId],
    );

    return result.rows.map((row) => ({
      id: row.id as string,
      candidateId: row.candidate_id as string,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: (row.requested_by_user_id as string | null) ?? undefined,
      targetUserId: (row.target_user_id as string | null) ?? undefined,
      targetOrgId: (row.target_org_id as string | null) ?? undefined,
      payload: (row.payload as Record<string, unknown> | null) ?? undefined,
      rationale: (row.rationale as string | null) ?? undefined,
    }));
  }

  async updateStatus(id: string, status: AdminExecRequest["status"]): Promise<void> {
    const pool = getPool();
    await pool.query(
      "UPDATE admin_exec_requests SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id],
    );
  }

  async getById(id: string): Promise<AdminExecRequest | null> {
    const pool = getPool();
    const result = await pool.query(
      "SELECT id, candidate_id, status, action_type, requested_by_user_id, target_user_id, target_org_id, payload, rationale FROM admin_exec_requests WHERE id = $1 LIMIT 1",
      [id],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id as string,
      candidateId: row.candidate_id as string,
      status: row.status as AdminExecRequest["status"],
      actionType: row.action_type as AdminExecRequest["actionType"],
      requestedByUserId: (row.requested_by_user_id as string | null) ?? undefined,
      targetUserId: (row.target_user_id as string | null) ?? undefined,
      targetOrgId: (row.target_org_id as string | null) ?? undefined,
      payload: (row.payload as Record<string, unknown> | null) ?? undefined,
      rationale: (row.rationale as string | null) ?? undefined,
    };
  }
}

export class PostgresDecisionLogRepository implements DecisionLogRepository {
  async append(entry: DecisionLog, candidateId?: string): Promise<void> {
    const pool = getPool();
    await pool.query(
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
