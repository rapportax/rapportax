import { NextResponse } from "next/server";
import { createAdminApiClient } from "../../../admin-api/client";
import { verifyIdPassword } from "../../../auth/idPassword";
import { createAuditLogger } from "../../../logging/audit";
import { handleSlackCommand } from "../../../slack/handlers";
import type { Actor } from "../../../index";
import { verifyAdminToken } from "../../../auth/adminToken";

export const runtime = "nodejs";

interface AdminRequestBody {
  rawText: string;
  actor: Actor;
  credentials?: {
    username: string;
    password: string;
  };
}

function resolveStatus(message: string): number {
  if (message === "unauthorized") return 401;
  if (message === "forbidden") return 403;
  if (message === "unknown_command") return 400;
  if (message === "admin_api_error") return 502;
  return 400;
}

export async function POST(request: Request) {
  let payload: AdminRequestBody | null = null;
  try {
    payload = (await request.json()) as AdminRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "invalid_json" },
      { status: 400 },
    );
  }

  if (!payload?.rawText || !payload.actor) {
    return NextResponse.json(
      { ok: false, message: "missing_fields" },
      { status: 400 },
    );
  }

  const adminBaseUrl = process.env.ADMIN_API_BASE_URL;
  if (!adminBaseUrl) {
    return NextResponse.json(
      { ok: false, message: "missing_admin_api_config" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\\s+(.+)$/i);
  let accessToken = tokenMatch?.[1];

  if (!accessToken) {
    if (!payload.credentials) {
      return NextResponse.json(
        { ok: false, message: "unauthorized" },
        { status: 401 },
      );
    }

    const auth = await verifyIdPassword(payload.credentials);
    if (!auth.ok || !auth.accessToken) {
      return NextResponse.json(
        { ok: false, message: "unauthorized" },
        { status: 401 },
      );
    }
    accessToken = auth.accessToken;
  }

  const isTokenValid = await verifyAdminToken(accessToken);
  if (!isTokenValid) {
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 },
    );
  }

  const adminApi = createAdminApiClient({
    baseUrl: adminBaseUrl,
    token: accessToken,
  });

  const auditLogger = createAuditLogger();

  const result = await handleSlackCommand({
    rawText: payload.rawText,
    actor: payload.actor,
    authSessionId: `bearer_${Date.now()}`,
    auditLogger,
    adminApi,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : resolveStatus(result.message),
  });
}
