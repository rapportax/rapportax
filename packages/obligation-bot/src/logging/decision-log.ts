import type { DecisionLog } from "../types";

export interface DecisionLogWriter {
  append(entry: DecisionLog): Promise<void>;
}
