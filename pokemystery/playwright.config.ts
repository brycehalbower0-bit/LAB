import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8788',
    launchOptions: {
      // Pre-provisioned Chromium (avoids network downloads in CI/dev containers).
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    },
  },
  webServer: {
    command: 'npx vite dev --port 8788 --strictPort',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
