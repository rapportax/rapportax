export interface AdminApiConfig {
  baseUrl: string;
}

export interface AdminAuthResponse {
  ok: boolean;
  accessToken?: string;
}

export interface AdminApiResponse<T> {
  ok: boolean;
  status: number;
  body?: T;
  error?: string;
}

export async function issueAdminToken(config: AdminApiConfig & { username: string; password: string }): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });

  const data = (await response.json()) as AdminAuthResponse;
  if (!response.ok || !data.ok || !data.accessToken) {
    throw new Error("admin_auth_failed");
  }
  return data.accessToken;
}

export async function verifyAdminToken(config: AdminApiConfig, token: string): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { ok: boolean };
  return data.ok === true;
}

export async function getUserDetail<T>(
  config: AdminApiConfig,
  token: string,
  userId: string,
): Promise<AdminApiResponse<T>> {
  return requestJson<T>(`${config.baseUrl}/api/admin/users/${userId}/detail`, token, "GET");
}

export async function getOrgSummary<T>(
  config: AdminApiConfig,
  token: string,
  orgId: string,
): Promise<AdminApiResponse<T>> {
  return requestJson<T>(`${config.baseUrl}/api/admin/orgs/${orgId}`, token, "GET");
}

export async function executeAdminAction<T>(
  config: AdminApiConfig,
  token: string,
  url: string,
  payload?: Record<string, unknown>,
): Promise<AdminApiResponse<T>> {
  return requestJson<T>(`${config.baseUrl}${url}`, token, "POST", payload);
}

async function requestJson<T>(
  url: string,
  token: string,
  method: "GET" | "POST",
  payload?: Record<string, unknown>,
): Promise<AdminApiResponse<T>> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = (await response.json()) as T;
  if (!response.ok) {
    return { ok: false, status: response.status, body, error: "admin_api_error" };
  }

  return { ok: true, status: response.status, body };
}
