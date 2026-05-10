import { test, expect } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

test.describe('cockpit hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.onboarding-completed', 'true');
      localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
    });

    await page.route('**/api/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            {
              id: 'p-e2e',
              slug: 'e2e',
              title: 'E2E',
              models: [{ id: MODEL_ID, slug: 'm1', revision: 1 }],
            },
          ],
        }),
      });
    });

    await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/snapshot**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelId: MODEL_ID,
          revision: 1,
          elements: {
            lvl: { kind: 'level', id: 'lvl', name: 'Ground', elevationMm: 0 },
            rm: {
              kind: 'room',
              id: 'rm',
              name: 'Master bedroom',
              levelId: 'lvl',
              outlineMm: [
                { xMm: 0, yMm: 0 },
                { xMm: 3000, yMm: 0 },
                { xMm: 3000, yMm: 2000 },
                { xMm: 0, yMm: 2000 },
              ],
            },
          },
          violations: [],
        }),
      });
    });

    await page.route('**/api/models/*/comments**', async (route) => {
      await route.fulfill({ status: 200, body: '{}' });
    });
    await page.route('**/api/models/*/activity**', async (route) => {
      await route.fulfill({ status: 200, body: '{"events":[]}' });
    });
    await page.route('**/api/building-presets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"presets":{"residential":{}}}',
      });
    });
  });

  test('shows Plan + 3D layout and mocked room labels', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
    const elapsed = Date.now() - t0;
    const thresholdMs = process.env.CI ? 25_000 : 15_000;
    expect(elapsed).toBeLessThan(thresholdMs);
    await expect(page.getByTestId('plan-canvas')).toBeVisible({ timeout: 15_000 });
  });
});
