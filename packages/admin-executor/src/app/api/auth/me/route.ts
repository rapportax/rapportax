import { NextResponse } from "next/server";
import { getAdminTokenInfo } from "../../../../auth/adminToken";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1];
  if (!token) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const info = await getAdminTokenInfo(token);
  if (!info) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, actorId: info.actorId, expiresAt: info.expiresAt });
}
