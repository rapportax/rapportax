import { NextResponse } from "next/server";
import { AdminExecService } from "../../../../ai-exec/service";
import type { AdminExecCandidate } from "../../../../ai-exec/types";
import { PostgresAdminExecRequestRepository, PostgresDecisionLogRepository } from "../../../../ai-exec/repository";

export const runtime = "nodejs";

interface CreateRequestBody {
  candidate: AdminExecCandidate;
  requestedByUserId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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

  let adminApiBaseUrl: string;
  let openaiModel: string;
  let openaiBaseUrl: string | undefined;
  try {
    adminApiBaseUrl = requireEnv("ADMIN_API_BASE_URL");
    openaiModel = process.env.OPENAI_MODEL ?? "gpt-5.2";
    openaiBaseUrl = process.env.OPENAI_BASE_URL;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "missing_config", detail: String(error) },
      { status: 500 },
    );
  }

  const adminExecService = new AdminExecService(
    {
      adminApiBaseUrl,
      openaiModel,
      openaiBaseUrl,
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
