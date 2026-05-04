import { defineConfig } from '@playwright/test';

/** Browser smoke runs against Vite preview; API is mocked via `page.route`. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.068,
      threshold: 0.28,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5739',
  },
  webServer: {
    command:
      'PREVIEW_NO_PROXY=1 pnpm exec vite build && PREVIEW_NO_PROXY=1 pnpm exec vite preview --host 127.0.0.1 --strictPort --port 5739',
    url: 'http://127.0.0.1:5739',
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 180_000,
  },
});
