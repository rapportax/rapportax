import http from "http";
import fs from "fs/promises";
import path from "path";
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.MONITOR_PORT ?? 8787);
const LOG_PATH = process.env.MONITOR_LOG_PATH ??
  path.resolve(__dirname, "..", "..", "..", "monitor", "agent-log.jsonl");
const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "..", "monitor");

const readLogEntries = async (): Promise<any[]> => {
  try {
    const contents = await fs.readFile(LOG_PATH, "utf8");
    return contents
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((entry) => entry);
  } catch {
    return [];
  }
};

const serveStatic = async (res: http.ServerResponse, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType =
      ext === ".html"
        ? "text/html"
        : ext === ".css"
          ? "text/css"
          : ext === ".js"
            ? "text/javascript"
            : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
};

const server = http.createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const entries = await readLogEntries();
    res.write(`event: init\n`);
    res.write(`data: ${JSON.stringify(entries.slice(-200))}\n\n`);

    let lastCount = entries.length;
    const interval = setInterval(async () => {
      const nextEntries = await readLogEntries();
      if (nextEntries.length > lastCount) {
        const newEntries = nextEntries.slice(lastCount);
        newEntries.forEach((entry) => {
          res.write(`event: log\n`);
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        });
        lastCount = nextEntries.length;
      }
    }, 1200);

    req.on("close", () => {
      clearInterval(interval);
    });
    return;
  }

  if (url === "/") {
    await serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
    return;
  }

  if (url === "/styles.css") {
    await serveStatic(res, path.join(PUBLIC_DIR, "styles.css"));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.info(`Agent monitor running on http://localhost:${PORT}`);
  console.info(`Watching log file: ${LOG_PATH}`);
});
