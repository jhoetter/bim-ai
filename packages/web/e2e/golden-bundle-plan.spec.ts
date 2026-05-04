import { test, expect } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-000000000001';

/** Mocked golden-like snapshot: two levels, stair shaft id, longitudinal section id. */

test.describe('golden bundle affordances', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.workspaceLayout', 'split_plan_section');
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
              models: [{ id: MODEL_ID, slug: 'golden-mock', revision: 3 }],
            },
          ],
        }),
      });
    });

    await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelId: MODEL_ID,
          revision: 3,
          elements: {
            'hf-lvl-1': { kind: 'level', id: 'hf-lvl-1', name: 'EG', elevationMm: 0 },
            'hf-lvl-2': { kind: 'level', id: 'hf-lvl-2', name: 'OG', elevationMm: 2800 },
            'hf-stair-main': {
              kind: 'stair',
              id: 'hf-stair-main',
              name: 'Main stair',
              baseLevelId: 'hf-lvl-1',
              topLevelId: 'hf-lvl-2',
              runStartMm: { xMm: 12000, yMm: 8000 },
              runEndMm: { xMm: 12000, yMm: 10000 },
              widthMm: 1100,
              riserMm: 175,
              treadMm: 280,
            },
            'hf-sec-longitudinal': {
              kind: 'section_cut',
              id: 'hf-sec-longitudinal',
              name: 'Hall + stair longitudinal',
              lineStartMm: { xMm: 11200, yMm: 6000 },
              lineEndMm: { xMm: 11200, yMm: 11800 },
              cropDepthMm: 14000,
            },
            'hf-sheet-ga01': {
              kind: 'sheet',
              id: 'hf-sheet-ga01',
              name: 'GA-01 — Golden evidence',
              titleBlock: 'A1-Golden',
              viewportsMm: [],
            },
            rm: {
              kind: 'room',
              id: 'rm',
              name: 'Loft west',
              levelId: 'hf-lvl-2',
              outlineMm: [
                { xMm: 0, yMm: 0 },
                { xMm: 4000, yMm: 0 },
                { xMm: 4000, yMm: 3000 },
                { xMm: 0, yMm: 3000 },
              ],
            },
          },
          violations: [],
        }),
      });
    });

    await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/validate`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelId: MODEL_ID,
          revision: 3,
          violations: [],
          summary: {},
          checks: { errorViolationCount: 0, blockingViolationCount: 0 },
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

  test('lists longitudinal section cuts and exposes plan style presets', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });

    await expect(
      page.locator('.font-medium').filter({ hasText: /^Hall \+ stair longitudinal$/ }),
    ).toBeVisible();
    await expect(page.getByText('hf-sec-longitudinal')).toBeVisible();

    await expect(page.getByRole('combobox', { name: /plan style/i })).toBeVisible();
    await page.getByRole('combobox', { name: /plan style/i }).selectOption('room_scheme');

    await expect(page.getByText('Schedules', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /^Sheets$/ }).click();
    await expect(page.getByText('GA-01 — Golden evidence').first()).toBeVisible();
  });
});
