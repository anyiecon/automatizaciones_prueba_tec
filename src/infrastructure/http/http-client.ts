import { HttpStatusError, NetworkError, TimeoutError } from '../../domain/errors.js';
import { withRetry, type RetryOptions } from './retry.js';

export type HttpClientOptions = {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly retry?: Partial<RetryOptions>;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly logger?: { warn: (msg: string, ctx?: Record<string, unknown>) => void };
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpStatusError) return RETRYABLE_STATUS.has(error.status);
  if (error instanceof TimeoutError || error instanceof NetworkError) return true;
  return false;
}

/**
 * Cliente HTTP minimalista basado en `fetch` nativo.
 * Aporta: timeout via AbortController, retry con backoff y clasificacion tipada de errores.
 */
export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  /**
   * GET sobre `path` (resuelto contra `baseUrl`) y parsea JSON.
   * @throws {TimeoutError} si la request excede `timeoutMs`.
   * @throws {NetworkError} ante fallos de transporte o body no-JSON.
   * @throws {HttpStatusError} si el status no es 2xx (4xx no transitorios no se reintentan).
   * @throws {RetryExhaustedError} si se agotan los reintentos sobre errores transitorios.
   */
  async getJson<T>(path: string): Promise<T> {
    const url = new URL(path, this.options.baseUrl).toString();

    return withRetry(
      async (attempt) => this.executeGet<T>(url, attempt),
      {
        ...this.options.retry,
        isRetryable: isRetryableError,
        onRetry: ({ attempt, error, delayMs }) => {
          this.options.logger?.warn('http retry', {
            url,
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
    );
  }

  private async executeGet<T>(url: string, attempt: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json', ...this.options.defaultHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpStatusError(
          response.status,
          `GET ${url} failed with status ${response.status} on attempt ${attempt}`,
        );
      }

      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new NetworkError(`Invalid JSON body from ${url}`, { cause: error });
      }
    } catch (error) {
      if (error instanceof HttpStatusError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`GET ${url} timed out after ${this.options.timeoutMs}ms`, { cause: error });
      }
      if (error instanceof NetworkError) throw error;
      throw new NetworkError(`Network failure on GET ${url}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
