import { Pool } from "pg";

const DEFAULT_CONNECTION =
  "postgres://rapportax:rapportax@localhost:5432/rapportax";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? DEFAULT_CONNECTION,
    });
  }
  return pool;
}
