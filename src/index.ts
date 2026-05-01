import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateCampaignSummary } from './application/generate-campaign-summary.js';
import { EvaluateCampaignsUseCase } from './application/evaluate-campaigns.js';
import { loadEnv } from './config/env.js';
import { DummyJsonDataSource } from './infrastructure/datasources/dummyjson-data-source.js';
import { HttpClient } from './infrastructure/http/http-client.js';
import { OpenRouterClient } from './infrastructure/llm/openrouter-client.js';
import { consoleLogger } from './infrastructure/logger.js';
import { JsonFileRepository } from './infrastructure/storage/json-file-repository.js';
import { N8nWebhookNotifier } from './infrastructure/workflows/n8n-webhook-notifier.js';

async function main(): Promise<void> {
  const env = loadEnv();

  const http = new HttpClient({
    baseUrl: env.API_BASE_URL,
    timeoutMs: env.HTTP_TIMEOUT_MS,
    retry: {
      maxAttempts: env.RETRY_MAX_ATTEMPTS,
      baseDelayMs: env.RETRY_BASE_DELAY_MS,
    },
    logger: consoleLogger,
  });

  const dataSource = new DummyJsonDataSource(http, { defaultLimit: env.CAMPAIGNS_LIMIT });
  const repository = new JsonFileRepository({ filePath: env.OUTPUT_PATH });
  const workflowNotifier = env.N8N_WEBHOOK_URL
    ? new N8nWebhookNotifier({ webhookUrl: env.N8N_WEBHOOK_URL, timeoutMs: env.HTTP_TIMEOUT_MS })
    : undefined;

  const useCase = new EvaluateCampaignsUseCase({
    dataSource,
    repository,
    thresholds: { warning: env.THRESHOLD_WARNING, critical: env.THRESHOLD_CRITICAL },
    ...(workflowNotifier ? { workflowNotifier } : {}),
    logger: consoleLogger,
  });

  const { reports, summary } = await useCase.execute();
  consoleLogger.info('campaigns evaluated', { output: env.OUTPUT_PATH, ...summary });

  if (env.OPENROUTER_API_KEY) {
    const llmClient = new OpenRouterClient({
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      timeoutMs: env.LLM_TIMEOUT_MS,
      siteUrl: 'https://github.com/anyiecon/automatizaciones_prueba_tec',
    });

    const llmSummary = await generateCampaignSummary(reports, {
      llmClient,
      logger: consoleLogger,
    });

    const summaryPath = resolve(env.LLM_OUTPUT_PATH);
    await writeFile(
      summaryPath,
      JSON.stringify(
        { ...llmSummary, generatedAt: llmSummary.generatedAt.toISOString() },
        null,
        2,
      ),
      'utf8',
    );
    consoleLogger.info('llm summary saved', { path: summaryPath });
  } else {
    consoleLogger.info('llm skipped — set OPENROUTER_API_KEY to enable Parte 4');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
  consoleLogger.error('pipeline failed', { message, ...(cause ? { cause } : {}) });
  process.exitCode = 1;
});
