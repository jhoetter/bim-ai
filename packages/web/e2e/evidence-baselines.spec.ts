import { expect, test, type Page } from '@playwright/test';

/** Visual baselines for Revit-parity Phase A evidence (sheet + schedules + split plan / 3D regions). */

const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

async function sharedRoutes(page: Page, layoutPreset: string) {
  await page.addInitScript((preset: string) => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.workspaceLayout', preset);
  }, layoutPreset);

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
            models: [{ id: MODEL_ID, slug: 'm1', revision: 3 }],
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
          'hf-wall-main': {
            kind: 'wall',
            id: 'hf-wall-main',
            name: 'Party wall',
            levelId: 'hf-lvl-1',
            start: { xMm: 0, yMm: 4000 },
            end: { xMm: 8000, yMm: 4000 },
            thicknessMm: 240,
            heightMm: 2800,
          },
          rm: {
            kind: 'room',
            id: 'rm',
            name: 'Living',
            levelId: 'hf-lvl-1',
            outlineMm: [
              { xMm: 0, yMm: 0 },
              { xMm: 5000, yMm: 0 },
              { xMm: 5000, yMm: 4000 },
              { xMm: 0, yMm: 4000 },
            ],
          },
          'hf-sheet-ga01': {
            kind: 'sheet',
            id: 'hf-sheet-ga01',
            name: 'GA-01 — Evidence',
            titleBlock: 'A1-Golden',
            viewportsMm: [{ xMm: 5200, yMm: 8200, widthMm: 12000, heightMm: 9800, label: 'Plan' }],
          },
          'pv-eg': {
            kind: 'plan_view',
            id: 'pv-eg',
            name: 'EG — openings',
            levelId: 'hf-lvl-1',
            planPresentation: 'opening_focus',
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

  await page.route(
    `**/api/models/${encodeURIComponent(MODEL_ID)}/evidence-package`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          modelId: MODEL_ID,
          revision: 3,
          elementCount: 7,
          countsByKind: { level: 2, wall: 1, room: 1, sheet: 1, plan_view: 1 },
          validate: {
            violations: [],
            checks: { errorViolationCount: 0, blockingViolationCount: 0 },
          },
          recommendedCapture: [],
          scheduleIds: [],
        }),
      });
    },
  );

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
}

test.describe('evidence PNG baselines', () => {
  test('coordination layout: sheet + schedules panel', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sheet-canvas')).toBeVisible();
    await expect(page.getByTestId('schedule-panel')).toBeVisible();
    await expect(page.getByTestId('sheet-canvas')).toHaveScreenshot('coordination-sheet.png');
    await expect(page.getByTestId('schedule-panel')).toHaveScreenshot('coordination-schedules.png');
  });

  test('split plan + 3D: canvases visible', async ({ page }) => {
    await sharedRoutes(page, 'split_plan_3d');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('plan-canvas')).toBeVisible();
    await expect(page.getByTestId('orbit-3d-viewport')).toBeVisible();
  });
});
