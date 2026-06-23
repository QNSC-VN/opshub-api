/**
 * Vitest per-file setup — runs before each test file.
 * Place vi.mock() calls and global before/afterEach hooks here.
 */
import { vi } from 'vitest';

// Silence console.error and console.warn in tests unless LOG_LEVEL is set
if (process.env['LOG_LEVEL'] === 'silent') {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}
