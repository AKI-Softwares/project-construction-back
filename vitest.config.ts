import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['src/tests/setup.ts'],
  },
});
