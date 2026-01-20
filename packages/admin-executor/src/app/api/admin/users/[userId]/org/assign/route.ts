import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../../../auth/adminToken";
import { getPool } from "../../../../../../../db/pool";

export const runtime = "nodejs";

interface OrgAssignRequestBody {
  orgId?: string;
}

export async function POST(
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

  let payload: OrgAssignRequestBody = {};
  try {
    payload = (await request.json()) as OrgAssignRequestBody;
  } catch {
    payload = {};
  }

  if (!payload.orgId) {
    return NextResponse.json(
      { ok: false, message: "missing_org_id" },
      { status: 400 },
    );
  }

  const pool = getPool();

  await pool.query(
    `INSERT INTO admin_user_orgs (user_id, org_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET org_id = EXCLUDED.org_id, updated_at = NOW()`
,
    [params.userId, payload.orgId],
  );

  return NextResponse.json({
    ok: true,
    userId: params.userId,
    orgId: payload.orgId,
  });
}
