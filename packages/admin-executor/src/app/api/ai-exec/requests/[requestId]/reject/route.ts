import { NextResponse } from "next/server";
import { AdminExecService } from "../../../../../../ai-exec/service";
import { PostgresAdminExecRequestRepository, PostgresDecisionLogRepository } from "../../../../../../ai-exec/repository";

export const runtime = "nodejs";

const ADMIN_API_BASE_URL = "http://localhost:3000";
const OPENAI_MODEL = "gpt-5.2";
const OPENAI_BASE_URL = "";

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\\s+(.+)$/i);
  return tokenMatch?.[1] ?? null;
}

export async function POST(
  request: Request,
  context: { params: { requestId: string } },
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const { requestId } = context.params;
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "missing_request_id" }, { status: 400 });
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

  await adminExecService.reject(requestId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
