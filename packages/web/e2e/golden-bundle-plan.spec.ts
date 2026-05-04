import { test, expect } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-000000000001';

/** Mocked golden-like snapshot: two levels, stair shaft id, longitudinal section id. */

test.describe('golden bundle affordances', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.workspaceLayout', 'split_plan_section');
    });

    await page.route('**/api/models/*/projection/plan**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          format: 'planProjectionWire_v1',
          primitives: {
            format: 'planProjectionPrimitives_v1',
            walls: [],
            floors: [],
            rooms: [],
            doors: [],
            windows: [],
            stairs: [],
            roofs: [],
            gridLines: [],
            dimensions: [],
          },
        }),
      });
    });

    await page.route('**/api/models/*/projection/section/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          format: 'sectionProjectionWire_v1',
          primitives: {
            format: 'sectionProjectionPrimitives_v1',
            walls: [{ uStartMm: 600, uEndMm: 7200, zBottomMm: 0, zTopMm: 5600 }],
            floors: [{ uStartMm: 500, uEndMm: 7300, zBottomMm: -200, zTopMm: 0 }],
          },
        }),
      });
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
              viewportsMm: [
                {
                  viewportId: 'vp-golden-sec',
                  label: 'Long section',
                  viewRef: 'section:hf-sec-longitudinal',
                  xMm: 2000,
                  yMm: 2000,
                  widthMm: 12000,
                  heightMm: 8000,
                },
              ],
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
            'hf-pv-eg': {
              kind: 'plan_view',
              id: 'hf-pv-eg',
              name: 'EG working',
              levelId: 'hf-lvl-1',
              discipline: 'architecture',
            },
            'vp-3d-mock': {
              kind: 'viewpoint',
              id: 'vp-3d-mock',
              name: 'Corner 3D',
              mode: 'orbit_3d',
              camera: {
                position: { xMm: 0, yMm: 0, zMm: 1500 },
                target: { xMm: 5000, yMm: 0, zMm: 1500 },
                up: { xMm: 0, yMm: 0, zMm: 1000 },
              },
            },
            'vp-plan-mock': {
              kind: 'viewpoint',
              id: 'vp-plan-mock',
              name: 'Plan advisory',
              mode: 'plan_2d',
              camera: {
                position: { xMm: 0, yMm: 0, zMm: 1400 },
                target: { xMm: 1, yMm: 0, zMm: 1400 },
                up: { xMm: 0, yMm: 0, zMm: 1000 },
              },
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

  test('project browser lists floor plans, section cuts, and split viewpoint groups', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText('Floor plans', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('EG working').first()).toBeVisible();
    await expect(page.getByText('Section cuts', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('3D saved views', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Corner 3D').first()).toBeVisible();
    await expect(page.getByText('Plan / canvas viewpoints', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Plan advisory').first()).toBeVisible();
  });

  test('sheet canvas renders section viewport from replayed viewportsMm', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.workspaceLayout', 'coordination');
    });
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });

    const canvas = page.getByTestId('sheet-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas.getByText('Hall + stair longitudinal').first()).toBeVisible();

    // Nested `SectionViewportSvg`: wall mass uses hatch fill (async projection fetch).
    await expect(canvas.locator('svg svg path[fill^="url(#"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('applies evidence3d clip query params on 3D section box controls', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
    });
    await page.goto('/?evidence3dClipCapMm=5600&evidence3dClipFloorMm=2000');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByLabel(/Section box — cap Y/i)).toHaveValue('5600');
    await expect(page.getByLabel(/Section box — floor Y/i)).toHaveValue('2000');
  });
});
