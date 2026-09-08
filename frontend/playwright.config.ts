import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration. Vite serves the SPA on a fixed port (see `vite.config.ts`,
 * `server.strictPort: true`), and the backend's default CORS origin matches it,
 * so both the app under test and the dev server assume `http://localhost:3000`.
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
