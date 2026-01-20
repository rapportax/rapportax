import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../../../auth/adminToken";
import { getPool } from "../../../../../../../db/pool";

export const runtime = "nodejs";

interface PlanRequestBody {
  plan?: string;
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

  let payload: PlanRequestBody = {};
  try {
    payload = (await request.json()) as PlanRequestBody;
  } catch {
    payload = {};
  }

  const plan = payload.plan ?? "pro";
  const pool = getPool();

  await pool.query(
    `INSERT INTO admin_users (id, plan)
     VALUES ($1, $2)
     ON CONFLICT (id)
     DO UPDATE SET plan = EXCLUDED.plan, updated_at = NOW()`
,
    [params.userId, plan],
  );

  return NextResponse.json({ ok: true, userId: params.userId, plan });
}
