import { loadEnv } from "./slack/env";
import { NoopContextScanner, NoopDecisionAgent, NoopDoneAssessor, NoopRiskAgent } from "./agents/noop";
import { OpenAIContextScanner, OpenAIDecisionAgent, OpenAIDoneAssessor, OpenAIRiskAgent } from "./agents/openai";
import {
  PostgresAdminExecRequestRepository,
  PostgresAdminTokenRepository,
  PostgresCandidateRepository,
  PostgresClient,
  PostgresDecisionLogRepository,
} from "./storage/postgres";
import { ObligationService } from "./service";
import { AdminExecService } from "./admin-exec/service";
import { ExecutorService } from "./executor/service";
import { createLocalWorkerRuntime } from "./workers/runtime";
import { DEFAULT_WORKERS } from "./workers/registry";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

const createRepositories = (databaseUrl: string) => {
  const client = new PostgresClient({ connectionString: databaseUrl });
  return {
    candidateRepository: new PostgresCandidateRepository(client),
    decisionLogRepository: new PostgresDecisionLogRepository(client),
    adminExecRequestRepository: new PostgresAdminExecRequestRepository(client),
    adminTokenRepository: new PostgresAdminTokenRepository(client),
  };
};

const createWorkerRuntime = (openaiApiKey: string | undefined, openaiModel: string) => {
  if (!openaiApiKey) {
    return undefined;
  }

  const workerMaxTurnsRaw = process.env.WORKER_MAX_TURNS;
  const workerMaxTurns = workerMaxTurnsRaw ? Number(workerMaxTurnsRaw) : undefined;

  return createLocalWorkerRuntime({
    model: process.env.WORKER_MODEL ?? openaiModel,
    maxTurns: workerMaxTurns && Number.isFinite(workerMaxTurns) ? workerMaxTurns : undefined,
    repoRoot: process.env.WORKER_REPO_ROOT,
  });
};

const createService = (params: {
  repositories: ReturnType<typeof createRepositories>;
  openaiApiKey?: string;
  openaiModel: string;
  openaiBaseUrl?: string;
  adminExecService?: AdminExecService;
  includeAdminTokens?: boolean;
}) => {
  const workerRuntime = createWorkerRuntime(params.openaiApiKey, params.openaiModel);
  const executorService = workerRuntime
    ? new ExecutorService({
        candidateRepository: params.repositories.candidateRepository,
        decisionLogRepository: params.repositories.decisionLogRepository,
        workerRuntime,
        workers: DEFAULT_WORKERS,
      })
    : undefined;

  return new ObligationService({
    contextScanner: params.openaiApiKey
      ? new OpenAIContextScanner({
          apiKey: params.openaiApiKey,
          model: params.openaiModel,
          baseURL: params.openaiBaseUrl,
        })
      : new NoopContextScanner(),
    decisionAgent: params.openaiApiKey
      ? new OpenAIDecisionAgent({
          apiKey: params.openaiApiKey,
          model: params.openaiModel,
          baseURL: params.openaiBaseUrl,
        })
      : new NoopDecisionAgent(),
    doneAssessor: params.openaiApiKey
      ? new OpenAIDoneAssessor({
          apiKey: params.openaiApiKey,
          model: params.openaiModel,
          baseURL: params.openaiBaseUrl,
        })
      : new NoopDoneAssessor(),
    riskAgent: params.openaiApiKey
      ? new OpenAIRiskAgent({
          apiKey: params.openaiApiKey,
          model: params.openaiModel,
          baseURL: params.openaiBaseUrl,
        })
      : new NoopRiskAgent(),
    candidateRepository: params.repositories.candidateRepository,
    decisionLogRepository: params.repositories.decisionLogRepository,
    adminExecRequestRepository: params.repositories.adminExecRequestRepository,
    adminExecService: params.adminExecService,
    adminTokenRepository: params.includeAdminTokens ? params.repositories.adminTokenRepository : undefined,
    executorService,
  });
};

export interface SlackSocketAppContext {
  service: ObligationService;
  signingSecret: string;
  botToken: string;
  appToken: string;
  adminApiBaseUrl: string;
}

export const createSlackSocketAppContext = (): SlackSocketAppContext => {
  loadEnv();
  const signingSecret = requireEnv("SLACK_SIGNING_SECRET");
  const botToken = requireEnv("SLACK_BOT_TOKEN");
  const appToken = requireEnv("SLACK_APP_TOKEN");
  const databaseUrl = requireEnv("DATABASE_URL");
  const adminApiBaseUrl = requireEnv("ADMIN_API_BASE_URL");
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-5.2";
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;

  const repositories = createRepositories(databaseUrl);
  const adminExecService =
    openaiApiKey
      ? new AdminExecService(
          {
            adminApiBaseUrl,
            openaiApiKey,
            openaiModel,
            openaiBaseUrl,
          },
          {
            requestRepository: repositories.adminExecRequestRepository,
            decisionLogRepository: repositories.decisionLogRepository,
          },
        )
      : undefined;

  const service = createService({
    repositories,
    openaiApiKey,
    openaiModel,
    openaiBaseUrl,
    adminExecService,
    includeAdminTokens: true,
  });

  return {
    service,
    signingSecret,
    botToken,
    appToken,
    adminApiBaseUrl,
  };
};
