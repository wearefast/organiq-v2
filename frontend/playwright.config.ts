import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../server && node dist/main.js',
      port: 3002,
      reuseExistingServer: !process.env.CI,
      env: { PORT: '3002' },
    },
    {
      command: 'npx next dev --port 3001',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
