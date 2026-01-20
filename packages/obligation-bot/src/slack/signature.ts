import { createHmac, timingSafeEqual } from "crypto";

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): boolean {
  const version = "v0";
  const baseString = `${version}:${timestamp}:${rawBody}`;
  const digest = createHmac("sha256", signingSecret).update(baseString).digest("hex");
  const expected = `${version}=${digest}`;

  if (expected.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
