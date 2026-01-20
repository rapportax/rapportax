import { runSlackServer } from "./http-server";
import { createSlackAppRuntime } from "../di";

export function startSlackApp(): void {
  const { config, service } = createSlackAppRuntime();
  runSlackServer(config, service);
}

if (require.main === module) {
  startSlackApp();
}
