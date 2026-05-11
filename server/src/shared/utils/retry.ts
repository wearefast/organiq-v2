import { Logger } from '@nestjs/common';

const logger = new Logger('RetryUtil');

/**
 * Retry a function with exponential backoff.
 * Useful for transient network failures in integration services.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  const { attempts = 3, delayMs = 1000, label = 'operation' } = options;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) throw error;

      const wait = delayMs * Math.pow(2, attempt - 1);
      logger.warn(
        `${label} failed (attempt ${attempt}/${attempts}), retrying in ${wait}ms: ${error instanceof Error ? error.message : error}`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  // Unreachable but TypeScript needs it
  throw new Error(`${label} failed after ${attempts} attempts`);
}
