import { EvaluateCampaignsUseCase } from './application/evaluate-campaigns.js';
import { loadEnv } from './config/env.js';
import { DummyJsonDataSource } from './infrastructure/datasources/dummyjson-data-source.js';
import { HttpClient } from './infrastructure/http/http-client.js';
import { consoleLogger } from './infrastructure/logger.js';
import { JsonFileRepository } from './infrastructure/storage/json-file-repository.js';

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
  const repository = new JsonFileRepository({
    filePath: env.OUTPUT_PATH,
    source: dataSource.name,
  });

  const useCase = new EvaluateCampaignsUseCase({
    dataSource,
    repository,
    thresholds: { warning: env.THRESHOLD_WARNING, critical: env.THRESHOLD_CRITICAL },
    logger: consoleLogger,
  });

  const { summary } = await useCase.execute();
  consoleLogger.info('done', { output: env.OUTPUT_PATH, ...summary });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
  consoleLogger.error('pipeline failed', { message, ...(cause ? { cause } : {}) });
  process.exitCode = 1;
});
