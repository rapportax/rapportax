import type { AdminTokenRepository } from "./interfaces";

export interface AdminUserToken {
  slackUserId: string;
  accessToken: string;
}

export class InMemoryAdminTokenRepository implements AdminTokenRepository {
  private readonly tokens = new Map<string, string>();

  async upsert(slackUserId: string, accessToken: string): Promise<void> {
    this.tokens.set(slackUserId, accessToken);
  }

  async get(slackUserId: string): Promise<string | null> {
    return this.tokens.get(slackUserId) ?? null;
  }
}
