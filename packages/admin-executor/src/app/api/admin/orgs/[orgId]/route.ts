import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../auth/adminToken";
import { getPool } from "../../../../../db/pool";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { orgId: string } },
) {
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
  const orgResult = await pool.query(
    `SELECT tier, credit FROM admin_orgs WHERE id = $1`,
    [params.orgId],
  );

  const row = orgResult.rows[0] as
    | { tier?: string; credit?: number }
    | undefined;

  return NextResponse.json({
    ok: true,
    orgId: params.orgId,
    tier: row?.tier ?? "free",
    credit: row?.credit ?? 0,
  });
}
