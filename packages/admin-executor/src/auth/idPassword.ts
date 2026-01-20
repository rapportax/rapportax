export interface IdPasswordCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  ok: boolean;
  reason?: string;
  sessionId?: string;
  accessToken?: string;
}

export async function verifyIdPassword(
  credentials: IdPasswordCredentials,
): Promise<AuthResult> {
  if (!credentials.username || !credentials.password) {
    return { ok: false, reason: "missing_credentials" };
  }

  const { getPool } = await import("../db/pool");
  const pool = getPool();
  let result: { rowCount: number | null; rows: Array<{ password?: string }> };
  try {
    result = await pool.query(
      `SELECT username, password
       FROM admin_auth_users
       WHERE username = $1`,
      [credentials.username],
    );
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "42P01") {
      return { ok: false, reason: "missing_schema" };
    }
    return { ok: false, reason: "auth_query_failed" };
  }

  if (result.rowCount === 0) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const row = result.rows[0] as { password?: string };
  if (!row.password || row.password !== credentials.password) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const { issueAdminToken } = await import("./adminToken");
  const token = await issueAdminToken(credentials.username);

  return {
    ok: true,
    sessionId: `session_${Date.now()}`,
    accessToken: token,
  };
}
