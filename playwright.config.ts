import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.cache/browsers');
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3007',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/mobile.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: ['**/mobile.spec.ts', '**/profile.spec.ts'],
      use: {
        ...devices['Pixel 7'],
        defaultBrowserType: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'node dist/server/src/index.js',
    url: 'http://127.0.0.1:3007/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3007',
      HOST: '127.0.0.1',
      DATABASE_PATH: resolve('.cache/e2e.sqlite'),
      DEMO_MODE: 'false',
    },
  },
});
