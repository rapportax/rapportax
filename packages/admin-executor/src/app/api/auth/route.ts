import { NextResponse } from "next/server";
import { verifyIdPassword } from "../../../auth/idPassword";

export const runtime = "nodejs";

interface AuthRequestBody {
  username: string;
  password: string;
}

export async function POST(request: Request) {
  let payload: AuthRequestBody | null = null;
  try {
    payload = (await request.json()) as AuthRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "invalid_json" },
      { status: 400 },
    );
  }

  if (!payload?.username || !payload.password) {
    return NextResponse.json(
      { ok: false, message: "missing_fields" },
      { status: 400 },
    );
  }

  const auth = await verifyIdPassword({
    username: payload.username,
    password: payload.password,
  });

  if (!auth.ok || !auth.accessToken) {
    if (auth.reason === "missing_schema") {
      return NextResponse.json(
        { ok: false, message: "missing_schema" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, accessToken: auth.accessToken });
}
