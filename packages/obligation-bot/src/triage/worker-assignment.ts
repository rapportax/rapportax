import type { WorkerAssignment, WorkerDefinition } from "../types";

export interface WorkerAssignmentInput {
  title: string;
  tags?: string[];
  explicitWorkerId?: string;
}

export function assignWorker(
  workers: WorkerDefinition[],
  input: WorkerAssignmentInput,
): WorkerAssignment {
  if (input.explicitWorkerId) {
    return {
      workerId: input.explicitWorkerId,
      confidence: 1,
      rationale: ["Explicit worker mapping found."],
    };
  }

  if (input.tags && input.tags.length > 0) {
    const tagged = workers.find((worker) =>
      worker.capabilityTags?.some((tag) => input.tags?.includes(tag)),
    );

    if (tagged) {
      return {
        workerId: tagged.id,
        confidence: 0.6,
        rationale: ["Matched capability tags."],
      };
    }
  }

  if (workers.length > 0) {
    return {
      workerId: workers[0].id,
      confidence: 0.3,
      rationale: ["Fallback worker assigned."],
    };
  }

  return {
    workerId: "HOLD",
    confidence: 0,
    rationale: ["No worker available; hold for review."],
  };
}
