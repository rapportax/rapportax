export interface WorkerTask {
  id: string;
  payload: unknown;
}

export function processTask(task: WorkerTask): void {
  console.log("processing task", task.id);
}
