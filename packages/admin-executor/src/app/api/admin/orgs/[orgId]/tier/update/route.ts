import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../../../auth/adminToken";
import { getPool } from "../../../../../../../db/pool";

export const runtime = "nodejs";

interface TierRequestBody {
  tier?: string;
}

export async function POST(
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

  let payload: TierRequestBody = {};
  try {
    payload = (await request.json()) as TierRequestBody;
  } catch {
    payload = {};
  }

  if (!payload.tier) {
    return NextResponse.json(
      { ok: false, message: "missing_tier" },
      { status: 400 },
    );
  }

  const pool = getPool();

  await pool.query(
    `INSERT INTO admin_orgs (id, tier)
     VALUES ($1, $2)
     ON CONFLICT (id)
     DO UPDATE SET tier = EXCLUDED.tier, updated_at = NOW()`
,
    [params.orgId, payload.tier],
  );

  return NextResponse.json({ ok: true, orgId: params.orgId, tier: payload.tier });
}
