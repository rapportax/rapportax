import { NextResponse } from "next/server";
import { verifyAdminToken } from "../../../../../../../auth/adminToken";
import { getPool } from "../../../../../../../db/pool";

export const runtime = "nodejs";

interface CreditRequestBody {
  credit?: number | string;
  creditDelta?: number | string;
}

function parseNumber(value?: number | string): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  let payload: CreditRequestBody = {};
  try {
    payload = (await request.json()) as CreditRequestBody;
  } catch {
    payload = {};
  }

  const credit = parseNumber(payload.credit);
  const creditDelta = parseNumber(payload.creditDelta);

  if (credit === null && creditDelta === null) {
    return NextResponse.json(
      { ok: false, message: "missing_credit" },
      { status: 400 },
    );
  }

  const pool = getPool();

  if (credit !== null) {
    await pool.query(
      `INSERT INTO admin_orgs (id, credit)
       VALUES ($1, $2)
       ON CONFLICT (id)
       DO UPDATE SET credit = EXCLUDED.credit, updated_at = NOW()`
,
      [params.orgId, Math.trunc(credit)],
    );

    return NextResponse.json({
      ok: true,
      orgId: params.orgId,
      credit: Math.trunc(credit),
    });
  }

  await pool.query(
    `INSERT INTO admin_orgs (id, credit)
     VALUES ($1, $2)
     ON CONFLICT (id)
     DO UPDATE SET credit = admin_orgs.credit + $2, updated_at = NOW()`
,
    [params.orgId, Math.trunc(creditDelta ?? 0)],
  );

  return NextResponse.json({
    ok: true,
    orgId: params.orgId,
    creditDelta: Math.trunc(creditDelta ?? 0),
  });
}
