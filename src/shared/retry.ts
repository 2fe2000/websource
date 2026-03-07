import { createChildLogger } from './logger.js';

const log = createChildLogger('retry');

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs = 1000, maxDelayMs = 30000, shouldRetry } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;
      if (shouldRetry && !shouldRetry(error)) break;

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);

      log.warn({ attempt: attempt + 1, maxRetries, delayMs: Math.round(jitter) }, 'Retrying after error');
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  throw lastError;
}
