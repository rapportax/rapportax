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
    `SELECT id, tier, credit
     FROM admin_orgs
     ORDER BY id`,
  );

  const orgs = result.rows.map((row: { id: string; tier: string; credit: number }) => ({
    id: row.id,
    tier: row.tier,
    credit: row.credit,
  }));

  return NextResponse.json({ ok: true, orgs });
}
