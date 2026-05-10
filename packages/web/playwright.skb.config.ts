import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:2000',
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
  },
  // Disable webServer for faster checkpoints when make dev is already running
});
