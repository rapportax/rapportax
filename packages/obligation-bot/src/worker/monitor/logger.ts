import fs from "fs";
import path from "path";

type LogEntry = {
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
};

const ensureDir = (filePath: string): void => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const createJsonlLogger = (filePath: string) => {
  ensureDir(filePath);
  const stream = fs.createWriteStream(filePath, { flags: "a" });

  return (message: string, data?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      message,
      data,
    };

    stream.write(`${JSON.stringify(entry)}\n`);
    if (data) {
      console.info(message, data);
    } else {
      console.info(message);
    }
  };
};
