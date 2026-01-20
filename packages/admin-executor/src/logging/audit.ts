export type AuditAction = "EXECUTE" | "APPROVE" | "REJECT";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  command: string;
  params: Record<string, string>;
  createdAt: Date;
  result?: "SUCCESS" | "FAILURE";
  error?: string;
}

import { Pool } from "pg";
import { getPool } from "../db/pool";

export interface AuditLogger {
  append: (entry: AuditLogEntry) => Promise<void>;
}

export interface AuditLoggerOptions {
  connectionString?: string;
}

const DEFAULT_CONNECTION =
  "postgres://rapportax:rapportax@localhost:5432/rapportax";

export function createAuditLogger(
  options: AuditLoggerOptions = {},
): AuditLogger {
  const pool =
    options.connectionString !== undefined
      ? new Pool({ connectionString: options.connectionString })
      : getPool();

  return {
    async append(entry) {
      await pool.query(
        `INSERT INTO admin_audit_logs
          (id, action, actor_id, command, params, result, error, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.id,
          entry.action,
          entry.actorId,
          entry.command,
          entry.params,
          entry.result ?? null,
          entry.error ?? null,
          entry.createdAt,
        ],
      );
    },
  };
}
