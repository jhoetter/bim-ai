import { defineConfig } from '@playwright/test';

const apiPort = 8787;
const webPort = 5741;

export default defineConfig({
  testDir: './e2e',
  testMatch: /real-backend-proxy\.spec\.ts/,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-real-backend' }]],
  outputDir: 'test-results-real-backend',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
  },
  webServer: [
    {
      command: `cd ../../app && env PYTHONPATH=. BIM_AI_SKIP_DB_INIT=1 uv run uvicorn bim_ai.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `env API_PORT=${apiPort} WEB_PORT=${webPort} VITE_E2E_DISABLE_WS=true pnpm exec vite dev --host 127.0.0.1 --strictPort --port ${webPort}`,
      env: {
        API_PORT: String(apiPort),
        WEB_PORT: String(webPort),
        VITE_E2E_DISABLE_WS: 'true',
      },
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
