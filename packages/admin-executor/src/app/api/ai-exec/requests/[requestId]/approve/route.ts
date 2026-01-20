import { NextResponse } from "next/server";
import { AdminExecService } from "../../../../../../ai-exec/service";
import { PostgresAdminExecRequestRepository, PostgresDecisionLogRepository } from "../../../../../../ai-exec/repository";

export const runtime = "nodejs";

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

  await adminExecService.approveAndExecute(requestId, token);
  return NextResponse.json({ ok: true }, { status: 200 });
}
