/**
 * Vitest global test setup.
 * Runs before all test files.
 */
import { vi } from 'vitest';

// Suppress NestJS logger noise during tests
vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/common')>();
  return {
    ...actual,
    Logger: class MockLogger {
      log() {}
      error() {}
      warn() {}
      debug() {}
      verbose() {}
    },
  };
});
