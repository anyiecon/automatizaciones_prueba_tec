import { describe, expect, it, vi } from 'vitest';
import { RetryExhaustedError } from '../src/domain/errors.js';
import { withRetry } from '../src/infrastructure/http/retry.js';

describe('withRetry', () => {
  it('returns the value on the first successful attempt', async () => {
    const task = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(task, { maxAttempts: 3, baseDelayMs: 1, jitter: false });
    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors and succeeds eventually', async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok');

    const result = await withRetry(task, {
      maxAttempts: 3,
      baseDelayMs: 1,
      jitter: false,
      isRetryable: () => true,
    });
    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('throws RetryExhaustedError after maxAttempts', async () => {
    const task = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      withRetry(task, { maxAttempts: 2, baseDelayMs: 1, jitter: false, isRetryable: () => true }),
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not retry when error is non-retryable', async () => {
    const task = vi.fn().mockRejectedValue(new Error('fatal'));
    await expect(
      withRetry(task, { maxAttempts: 5, baseDelayMs: 1, jitter: false, isRetryable: () => false }),
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff (without jitter)', async () => {
    const onRetry = vi.fn();
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');

    await withRetry(task, {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 10_000,
      jitter: false,
      isRetryable: () => true,
      onRetry,
    });

    expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({ attempt: 1, delayMs: 100 }));
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ attempt: 2, delayMs: 200 }));
  });
});
