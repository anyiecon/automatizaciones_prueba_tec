import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const OptionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const OptionalStringSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const EnvSchema = z.object({
  API_BASE_URL: z.string().url().default('https://dummyjson.com'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(300),
  CAMPAIGNS_LIMIT: z.coerce.number().int().positive().max(200).default(30),
  THRESHOLD_WARNING: z.coerce.number().default(2.5),
  THRESHOLD_CRITICAL: z.coerce.number().default(1.0),
  OUTPUT_PATH: z.string().min(1).default('./data/campaigns.json'),
  LLM_OUTPUT_PATH: z.string().min(1).default('./data/llm-summary.json'),
  N8N_WEBHOOK_URL: OptionalUrlSchema,
  OPENROUTER_API_KEY: OptionalStringSchema,
  OPENROUTER_MODEL: z.string().min(1).default('meta-llama/llama-3.3-70b-instruct:free'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Carga y valida variables de entorno con Zod.
 * @throws {Error} si alguna variable es invalida o si critical >= warning (fail-fast).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  if (parsed.data.THRESHOLD_CRITICAL >= parsed.data.THRESHOLD_WARNING) {
    throw new Error('THRESHOLD_CRITICAL must be strictly lower than THRESHOLD_WARNING');
  }
  return parsed.data;
}
