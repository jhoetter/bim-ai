import { defineConfig } from '@playwright/test';

/** Browser smoke runs against Vite preview; API is mocked via `page.route`. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:5739',
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --strictPort --port 5739',
    url: 'http://127.0.0.1:5739',
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 120_000,
  },
});
