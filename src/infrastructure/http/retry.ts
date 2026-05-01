import { RetryExhaustedError } from '../../domain/errors.js';

export type RetryOptions = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
  readonly isRetryable: (error: unknown) => boolean;
  readonly onRetry?: (info: { attempt: number; error: unknown; delayMs: number }) => void;
};

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 5_000,
  jitter: true,
  isRetryable: () => true,
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function computeDelay(attempt: number, opts: RetryOptions): number {
  const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  return opts.jitter ? Math.floor(Math.random() * exp) : exp;
}

/**
 * Ejecuta `task` con reintentos y backoff exponencial con jitter opcional.
 * Solo reintenta los errores donde `isRetryable(error)` es `true`.
 *
 * @throws {RetryExhaustedError} si todos los intentos fallan; encadena el ultimo error en `cause`.
 */
export async function withRetry<T>(
  task: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  if (opts.maxAttempts < 1) {
    throw new RangeError('maxAttempts must be >= 1');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt === opts.maxAttempts;
      if (isLast || !opts.isRetryable(error)) break;
      const delayMs = computeDelay(attempt, opts);
      opts.onRetry?.({ attempt, error, delayMs });
      await sleep(delayMs);
    }
  }
  throw new RetryExhaustedError(
    opts.maxAttempts,
    `All ${opts.maxAttempts} attempts failed`,
    { cause: lastError },
  );
}
