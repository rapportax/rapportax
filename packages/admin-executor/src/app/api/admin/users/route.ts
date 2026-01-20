import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../auth/adminToken";
import { getPool } from "../../../../db/pool";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1];

  if (!accessToken || !(await verifyAdminToken(accessToken))) {
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 },
    );
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id, u.plan, uo.org_id
     FROM admin_users u
     LEFT JOIN admin_user_orgs uo ON u.id = uo.user_id
     ORDER BY u.id`,
  );

  const users = result.rows.map((row: { id: string; plan: string; org_id?: string }) => ({
    id: row.id,
    plan: row.plan,
    orgId: row.org_id ?? null,
  }));

  return NextResponse.json({ ok: true, users });
}
