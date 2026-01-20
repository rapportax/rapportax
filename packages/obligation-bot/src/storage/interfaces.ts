import type { DecisionLog, TodoCandidate } from "../types";
import type { AdminExecRequest, AdminExecStatus } from "../types";

export type CandidateStatus = "PROPOSED" | "EXECUTED" | "HELD" | "IGNORED";

export interface CandidateRepository {
  create(candidate: TodoCandidate): Promise<void>;
  listOpen(): Promise<TodoCandidate[]>;
  updateStatus(id: string, status: CandidateStatus): Promise<void>;
}

export interface DecisionLogRepository {
  append(entry: DecisionLog, candidateId?: string): Promise<void>;
}

export interface AdminExecRequestRepository {
  create(request: AdminExecRequest): Promise<void>;
  listPending(): Promise<AdminExecRequest[]>;
  listPendingByCandidate(candidateId: string): Promise<AdminExecRequest[]>;
  updateStatus(id: string, status: AdminExecStatus): Promise<void>;
  getById(id: string): Promise<AdminExecRequest | null>;
}

export interface AdminTokenRepository {
  upsert(slackUserId: string, accessToken: string): Promise<void>;
  get(slackUserId: string): Promise<string | null>;
}
