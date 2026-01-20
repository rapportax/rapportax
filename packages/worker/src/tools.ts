import { tool } from "@openai/agents";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".cache",
]);

const DEFAULT_TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".cjs",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

const normalizeBase = (basePath: string): string => {
  return path.resolve(basePath);
};

const resolveSafePath = (basePath: string, targetPath: string): string => {
  const resolvedBase = normalizeBase(basePath);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  if (resolvedTarget === resolvedBase) {
    return resolvedTarget;
  }
  if (!resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Path is outside of the allowed repository root.");
  }
  return resolvedTarget;
};

const shouldIncludeExtension = (
  filePath: string,
  extensions?: string[],
): boolean => {
  if (!extensions || extensions.length === 0) {
    return true;
  }
  const ext = path.extname(filePath);
  return extensions.includes(ext);
};

const isTextFile = (filePath: string): boolean => {
  const ext = path.extname(filePath);
  return DEFAULT_TEXT_EXTENSIONS.has(ext);
};

const listFiles = async (
  basePath: string,
  relativePath: string,
  options: {
    maxFiles: number;
    extensions?: string[];
  },
): Promise<string[]> => {
  const results: string[] = [];
  const root = resolveSafePath(basePath, relativePath);
  const stack: Array<{ absolute: string; relative: string }> = [
    { absolute: root, relative: relativePath },
  ];

  while (stack.length > 0 && results.length < options.maxFiles) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await fs.readdir(current.absolute, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= options.maxFiles) {
        break;
      }
      const absolute = path.join(current.absolute, entry.name);
      const relative = path
        .join(current.relative, entry.name)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name)) {
          continue;
        }
        stack.push({ absolute, relative });
        continue;
      }

      if (!shouldIncludeExtension(relative, options.extensions)) {
        continue;
      }

      results.push(relative);
    }
  }

  return results.sort();
};

const readFileTruncated = async (
  absolutePath: string,
  maxBytes: number,
): Promise<string> => {
  const buffer = await fs.readFile(absolutePath);
  if (buffer.length <= maxBytes) {
    return buffer.toString("utf8");
  }
  return `${buffer.subarray(0, maxBytes).toString("utf8")}
\n... (truncated)`;
};

export const createRepoTools = (basePath: string) => {
  const listRepoFilesTool = tool({
    name: "list_repo_files",
    description:
      "리포지토리 내부 파일 목록을 반환합니다. path는 리포지토리 루트 기준 상대 경로입니다.",
    parameters: z.object({
      path: z.string().nullable().default("."),
      maxFiles: z.number().int().min(1).max(2000).nullable().default(400),
      extensions: z.array(z.string()).nullable(),
    }),
    strict: true,
    execute: async (input) => {
      const pathValue = input.path ?? ".";
      const maxFilesValue = input.maxFiles ?? 400;
      const files = await listFiles(basePath, pathValue, {
        maxFiles: maxFilesValue,
        extensions: input.extensions ?? undefined,
      });
      return {
        basePath,
        count: files.length,
        files,
      };
    },
  });

  const readRepoFileTool = tool({
    name: "read_repo_file",
    description:
      "리포지토리 내부 파일 내용을 읽습니다. path는 리포지토리 루트 기준 상대 경로입니다.",
    parameters: z.object({
      path: z.string(),
      maxBytes: z.number().int().min(100).max(200000).nullable().default(20000),
    }),
    strict: true,
    execute: async (input) => {
      const maxBytesValue = input.maxBytes ?? 20000;
      const absolute = resolveSafePath(basePath, input.path);
      const contents = await readFileTruncated(absolute, maxBytesValue);
      return {
        path: input.path,
        contents,
      };
    },
  });

  const searchRepoTool = tool({
    name: "search_repo",
    description:
      "리포지토리 내 텍스트 파일에서 쿼리를 검색합니다.",
    parameters: z.object({
      query: z.string().min(1),
      maxResults: z.number().int().min(1).max(200).nullable().default(50),
      extensions: z.array(z.string()).nullable(),
    }),
    strict: true,
    execute: async (input) => {
      const maxResultsValue = input.maxResults ?? 50;
      const files = await listFiles(basePath, ".", {
        maxFiles: 1200,
        extensions: input.extensions ?? undefined,
      });
      const results: Array<{ path: string; line: number; text: string }> = [];

      for (const file of files) {
        if (results.length >= maxResultsValue) {
          break;
        }
        if (!isTextFile(file)) {
          continue;
        }
        const absolute = resolveSafePath(basePath, file);
        const contents = await readFileTruncated(absolute, 60000);
        const lines = contents.split(/\r?\n/);
        lines.forEach((lineText, index) => {
          if (results.length >= maxResultsValue) {
            return;
          }
          if (lineText.includes(input.query)) {
            results.push({
              path: file,
              line: index + 1,
              text: lineText.trim(),
            });
          }
        });
      }

      return {
        query: input.query,
        count: results.length,
        results,
      };
    },
  });

  const applyRepoPatchTool = tool({
    name: "apply_repo_patch",
    description:
      "리포지토리에 unified diff 패치를 적용합니다. path는 패치 내부 경로 기준이며, repoRoot 아래에서만 적용됩니다.",
    parameters: z.object({
      patch: z.string().min(1),
      dryRun: z.boolean().nullable().default(false),
    }),
    strict: true,
    execute: async (input) => {
      const dryRun = input.dryRun ?? false;
      const tmpFile = path.join(
        os.tmpdir(),
        `repo-patch-${Date.now()}-${Math.random().toString(16).slice(2)}.diff`,
      );
      await fs.writeFile(tmpFile, input.patch, "utf8");

      const args = ["apply", "--whitespace=nowarn"];
      if (dryRun) {
        args.push("--check");
      }
      args.push(tmpFile);

      try {
        const { stdout, stderr } = await execFileAsync("git", args, {
          cwd: basePath,
        });
        return {
          ok: true,
          dryRun,
          stdout: stdout?.trim() ?? "",
          stderr: stderr?.trim() ?? "",
        };
      } catch (error) {
        const err = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        return {
          ok: false,
          dryRun,
          error: err.message ?? "git apply failed",
          stdout: err.stdout?.trim() ?? "",
          stderr: err.stderr?.trim() ?? "",
        };
      } finally {
        await fs.unlink(tmpFile).catch(() => undefined);
      }
    },
  });

  return [
    listRepoFilesTool,
    readRepoFileTool,
    searchRepoTool,
    applyRepoPatchTool,
  ];
};
