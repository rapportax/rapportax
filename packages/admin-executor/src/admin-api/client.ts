import { resolveEndpoint, type AdminEndpoint } from "./endpoints";

export interface AdminApiClientOptions {
  baseUrl: string;
  token: string;
}

export interface AdminApiResponse {
  ok: boolean;
  status: number;
  body?: unknown;
  error?: string;
}

export interface AdminApiClient {
  request: (
    endpoint: AdminEndpoint,
    params: Record<string, string>,
    payload?: Record<string, unknown>,
  ) => Promise<AdminApiResponse>;
}

export function createAdminApiClient(
  options: AdminApiClientOptions,
): AdminApiClient {
  return {
    async request(endpoint, params, payload) {
      const url = `${options.baseUrl}${resolveEndpoint(endpoint, params)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const body =
        contentType.includes("application/json")
          ? await response.json()
          : await response.text();

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          body,
          error: "admin_api_error",
        };
      }

      return {
        ok: true,
        status: response.status,
        body,
      };
    },
  };
}
