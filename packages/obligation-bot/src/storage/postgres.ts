import { Pool } from "pg";
import { randomUUID } from "crypto";
import type { DecisionLog, TodoCandidate } from "../types";
import type {
  DecisionLogRepository,
  CandidateRepository,
  CandidateStatus,
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
