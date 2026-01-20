import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve, dirname } from "path";

function findEnvFile(start: string, filename: string): string | null {
  let current = start;
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(current, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function loadEnv(): void {
  const cwd = process.cwd();
  const localPath = findEnvFile(cwd, ".env.local");
  const defaultPath = findEnvFile(cwd, ".env");

  if (localPath) {
    config({ path: localPath });
    return;
  }

  if (defaultPath) {
    config({ path: defaultPath });
  }
}
