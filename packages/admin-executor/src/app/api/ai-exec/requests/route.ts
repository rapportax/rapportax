import { NextResponse } from "next/server";
import { AdminExecService } from "../../../../ai-exec/service";
import type { AdminExecCandidate } from "../../../../ai-exec/types";
import { PostgresAdminExecRequestRepository, PostgresDecisionLogRepository } from "../../../../ai-exec/repository";

export const runtime = "nodejs";

const ADMIN_API_BASE_URL = "http://localhost:3000";
const OPENAI_MODEL = "gpt-5.2";
const OPENAI_BASE_URL = "";

interface CreateRequestBody {
  candidate: AdminExecCandidate;
  requestedByUserId: string;
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return tokenMatch?.[1] ?? null;
}

export async function POST(request: Request) {
  let payload: CreateRequestBody | null = null;
  try {
    payload = (await request.json()) as CreateRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "invalid_json" }, { status: 400 });
  }

  if (!payload?.candidate || !payload.requestedByUserId) {
    return NextResponse.json({ ok: false, message: "missing_fields" }, { status: 400 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const adminExecService = new AdminExecService(
    {
      adminApiBaseUrl: ADMIN_API_BASE_URL,
      openaiModel: OPENAI_MODEL,
      openaiBaseUrl: OPENAI_BASE_URL || undefined,
    },
    {
      requestRepository: new PostgresAdminExecRequestRepository(),
      decisionLogRepository: new PostgresDecisionLogRepository(),
    },
  );

  const tokenOk = await adminExecService.verifyToken(token);
  if (!tokenOk) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const requestResult = await adminExecService.createExecutionRequest(
    payload.candidate,
    token,
    payload.requestedByUserId,
  );

  return NextResponse.json({ ok: true, request: requestResult ?? null }, { status: 200 });
}
