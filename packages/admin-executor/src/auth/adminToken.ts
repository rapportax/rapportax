import { getPool } from "../db/pool";

const DEFAULT_TTL_MINUTES = 60;

export async function issueAdminToken(actorId: string): Promise<string> {
  const pool = getPool();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO admin_tokens (token, actor_id, expires_at)
     VALUES ($1, $2, $3)`
    ,
    [token, actorId, expiresAt],
  );

  return token;
}

export async function verifyAdminToken(
  token: string,
  actorId?: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT token, actor_id, expires_at
     FROM admin_tokens
     WHERE token = $1`,
    [token],
  );

  if (result.rowCount === 0) {
    return false;
  }

  const row = result.rows[0] as {
    actor_id: string;
    expires_at: Date;
  };

  if (actorId && row.actor_id !== actorId) {
    return false;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return false;
  }

  return true;
}

export async function getAdminTokenInfo(
  token: string,
): Promise<{ actorId: string; expiresAt: Date } | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT actor_id, expires_at
     FROM admin_tokens
     WHERE token = $1`,
    [token],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0] as { actor_id: string; expires_at: Date };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  return { actorId: row.actor_id, expiresAt: row.expires_at };
}
