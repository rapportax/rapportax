import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../auth/adminToken";
import { getPool } from "../../../../../db/pool";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { userId: string } },
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
  const userResult = await pool.query(
    `SELECT plan FROM admin_users WHERE id = $1`,
    [params.userId],
  );
  const orgResult = await pool.query(
    `SELECT org_id FROM admin_user_orgs WHERE user_id = $1`,
    [params.userId],
  );

  const plan = (userResult.rows[0] as { plan?: string } | undefined)?.plan;
  const orgId = (orgResult.rows[0] as { org_id?: string } | undefined)?.org_id;

  return NextResponse.json({
    ok: true,
    userId: params.userId,
    plan: plan ?? "free",
    orgId: orgId ?? null,
  });
}
