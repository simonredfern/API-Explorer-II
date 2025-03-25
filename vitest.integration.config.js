import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // Integration tests need more time
    hookTimeout: 60000,
    include: ['src/test/integration/**/*.integration.test.ts'],
    setupFiles: ['src/test/integration/setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
});
