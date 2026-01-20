import type { DecisionLog, TodoCandidate } from "../types";

export type CandidateStatus = "PROPOSED" | "EXECUTED" | "HELD" | "IGNORED";

export interface CandidateRepository {
  create(candidate: TodoCandidate): Promise<void>;
  listOpen(): Promise<TodoCandidate[]>;
  updateStatus(id: string, status: CandidateStatus): Promise<void>;
}

export interface DecisionLogRepository {
  append(entry: DecisionLog, candidateId?: string): Promise<void>;
}
