import type { AdminExecCandidate, AdminExecRequest } from "./types";

export interface AiExecClientOptions {
  baseUrl: string;
  token: string;
}

export interface CreateRequestInput {
  candidate: AdminExecCandidate;
  requestedByUserId: string;
}

export async function createExecutionRequest(
  options: AiExecClientOptions,
  input: CreateRequestInput,
): Promise<AdminExecRequest | null> {
  const response = await fetch(`${options.baseUrl}/api/ai-exec/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`ai_exec_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as { ok: boolean; request?: AdminExecRequest | null };
  if (!payload.ok) {
    return null;
  }

  return payload.request ?? null;
}

export async function approveExecutionRequest(
  options: AiExecClientOptions,
  requestId: string,
): Promise<boolean> {
  const response = await fetch(`${options.baseUrl}/api/ai-exec/requests/${requestId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { ok: boolean };
  return payload.ok === true;
}

export async function rejectExecutionRequest(
  options: AiExecClientOptions,
  requestId: string,
): Promise<boolean> {
  const response = await fetch(`${options.baseUrl}/api/ai-exec/requests/${requestId}/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { ok: boolean };
  return payload.ok === true;
}
