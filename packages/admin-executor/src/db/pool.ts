import { Pool } from "pg";

const DATABASE_URL =
  "postgres://rapportax:rapportax@localhost:5432/rapportax";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
    });
  }
  return pool;
}
