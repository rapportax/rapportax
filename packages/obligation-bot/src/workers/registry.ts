import type { WorkerDefinition } from "../types";

export const DEFAULT_WORKERS: WorkerDefinition[] = [
  {
    id: "multi-agent",
    name: "Multi-Agent Worker",
    description: "OpenAI Agents SDK 기반 멀티 에이전트 워커",
    capabilityTags: ["task", "code", "analysis"],
  },
];
