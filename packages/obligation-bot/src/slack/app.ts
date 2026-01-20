import { loadEnv } from "./env";
import { NoopContextScanner, NoopDecisionAgent, NoopDoneAssessor, NoopRiskAgent } from "../agents/noop";
import { OpenAIContextScanner, OpenAIDecisionAgent, OpenAIDoneAssessor, OpenAIRiskAgent } from "../agents/openai";
import { PostgresCandidateRepository, PostgresClient, PostgresDecisionLogRepository } from "../storage/postgres";
import { ObligationService } from "../service";
import { runSlackServer } from "./http-server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function startSlackApp(): void {
  loadEnv();
  const signingSecret = requireEnv("SLACK_SIGNING_SECRET");
  const botToken = requireEnv("SLACK_BOT_TOKEN");
  const databaseUrl = requireEnv("DATABASE_URL");
  const port = Number(process.env.PORT ?? "3000");
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-5.2";
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;

  const client = new PostgresClient({ connectionString: databaseUrl });
  const candidateRepository = new PostgresCandidateRepository(client);
  const decisionLogRepository = new PostgresDecisionLogRepository(client);

  const service = new ObligationService({
    contextScanner: openaiApiKey
      ? new OpenAIContextScanner({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopContextScanner(),
    decisionAgent: openaiApiKey
      ? new OpenAIDecisionAgent({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopDecisionAgent(),
    doneAssessor: openaiApiKey
      ? new OpenAIDoneAssessor({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopDoneAssessor(),
    riskAgent: openaiApiKey
      ? new OpenAIRiskAgent({ model: openaiModel, baseURL: openaiBaseUrl })
      : new NoopRiskAgent(),
    candidateRepository,
    decisionLogRepository,
  });

  runSlackServer(
    {
      signingSecret,
      botToken,
      port,
    },
    service,
  );
}

if (require.main === module) {
  startSlackApp();
}
