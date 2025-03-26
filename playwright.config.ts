import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from ".env" file.
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: 'src/test/integration',

  globalSetup: require.resolve('./src/test/integration/global.setup.ts'),
  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: process.env.VITE_OBP_API_EXPLORER_HOST,

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',
  },
  // Configure projects for major browsers.
  projects: [
    {
        name: 'setup',
        testMatch: /.*\.setup\.ts/
    },
    {
        name: 'chromium',
        use: { 
            ...devices['Desktop Chrome'],
            },
        dependencies: ['setup'],
    },
  ],
  // Run your local dev server before starting the tests.
  webServer: {
    command: 'vite',
    url: process.env.VITE_OBP_API_EXPLORER_HOST,
    reuseExistingServer: !process.env.CI,
  },
});