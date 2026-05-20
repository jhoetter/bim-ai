import { test, expect, type Page } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

type SeedTab = {
  id: string;
  kind: 'plan' | '3d' | 'sheet' | 'schedule';
  targetId?: string;
  label: string;
};

const VIEW_TABS: SeedTab[] = [
  { id: 'plan:pv-ground', kind: 'plan', targetId: 'pv-ground', label: 'Ground plan' },
  { id: '3d:vp-main', kind: '3d', targetId: 'vp-main', label: 'Main 3D' },
  { id: 'sheet:sheet-a101', kind: 'sheet', targetId: 'sheet-a101', label: 'A101' },
  { id: 'schedule:sched-doors', kind: 'schedule', targetId: 'sched-doors', label: 'Doors' },
];

const UI_BUDGET_MS = {
  initialWorkspaceLoad: process.env.CI ? 25_000 : 15_000,
  planCanvasReady: process.env.CI ? 12_000 : 7_000,
  threeDViewportReady: process.env.CI ? 12_000 : 7_000,
  tabSwitchReady: process.env.CI ? 8_000 : 5_000,
};

const PROJECT_BROWSER_LABELS: Record<string, RegExp> = {
  '3d:vp-main': /Main 3D/i,
  'sheet:sheet-a101': /A101 - Plans/i,
  'schedule:sched-doors': /Door schedule/i,
};

test.describe('cockpit hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ tabs }: { tabs: SeedTab[] }) => {
        localStorage.setItem('bim.welcome.dismissed', '1');
        localStorage.setItem('bim.onboarding-completed', 'true');
        localStorage.setItem('bim.workspaceLayout', 'plan');
        localStorage.setItem(
          'bim-ai:tabs-v1',
          JSON.stringify({ v: 1, tabs, activeId: 'plan:pv-ground' }),
        );
      },
      { tabs: VIEW_TABS },
    );

    await page.route('**/api/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            {
              id: 'p-e2e',
              seedLibrary: true,
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
            'lvl-ground': { kind: 'level', id: 'lvl-ground', name: 'Ground', elevationMm: 0 },
            'lvl-upper': { kind: 'level', id: 'lvl-upper', name: 'Upper', elevationMm: 3000 },
            'pv-ground': {
              kind: 'plan_view',
              id: 'pv-ground',
              name: 'Ground plan',
              levelId: 'lvl-ground',
            },
            'vp-main': {
              kind: 'viewpoint',
              id: 'vp-main',
              name: 'Main 3D',
              mode: 'orbit_3d',
              camera: {
                position: { xMm: 9000, yMm: -8500, zMm: 6200 },
                target: { xMm: 2500, yMm: 1800, zMm: 1400 },
                up: { xMm: 0, yMm: 0, zMm: 1 },
              },
            },
            'sheet-a101': {
              kind: 'sheet',
              id: 'sheet-a101',
              name: 'A101 - Plans',
              titleBlock: 'A1',
              paperWidthMm: 42000,
              paperHeightMm: 29700,
              titleblockParameters: {
                sheetNumber: 'A101',
                revision: 'P01',
                projectName: 'E2E',
                drawnBy: 'AI',
                checkedBy: 'QA',
                issueDate: '2026-05-20',
              },
              viewportsMm: [
                {
                  viewportId: 'vp-plan',
                  label: 'Ground plan',
                  viewRef: 'plan:pv-ground',
                  xMm: 1800,
                  yMm: 1800,
                  widthMm: 9000,
                  heightMm: 6800,
                },
              ],
            },
            'sched-doors': {
              kind: 'schedule',
              id: 'sched-doors',
              name: 'Door schedule',
              sheetId: 'sheet-a101',
              filters: { category: 'door' },
            },
            'wall-main': {
              kind: 'wall',
              id: 'wall-main',
              name: 'South wall',
              levelId: 'lvl-ground',
              start: { xMm: 0, yMm: 0 },
              end: { xMm: 7200, yMm: 0 },
              thicknessMm: 240,
              heightMm: 3000,
              topConstraintLevelId: 'lvl-upper',
            },
            'door-main': {
              kind: 'door',
              id: 'door-main',
              name: 'Entry door',
              wallId: 'wall-main',
              alongT: 0.5,
              widthMm: 1000,
            },
            rm: {
              kind: 'room',
              id: 'rm',
              name: 'Master bedroom',
              levelId: 'lvl-ground',
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
    await page.route('**/api/models/*/schedules/*/table', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduleId: 'sched-doors',
          name: 'Door schedule',
          category: 'door',
          rows: [
            {
              elementId: 'door-main',
              name: 'Entry door',
              level: 'Ground',
              widthMm: 1000,
              familyTypeId: 'door-single',
            },
          ],
          totals: { kind: 'door', rowCount: 1 },
        }),
      });
    });
    await page.route('**/api/building-presets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"presets":{"residential":{}}}',
      });
    });
    await page.route('**/api/family-catalogs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"catalogs":[]}',
      });
    });
    await page.route('**/api/models/*/presentations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"presentations":[]}',
      });
    });
  });

  test('keeps primary workspace UI inside automated quality budgets', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(UI_BUDGET_MS.initialWorkspaceLoad);

    await expect(page.getByRole('banner', { name: 'Workspace header' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Canvas' })).toBeVisible();

    const planT0 = Date.now();
    await expect(page.getByTestId('plan-canvas')).toBeVisible({
      timeout: UI_BUDGET_MS.planCanvasReady,
    });
    expect(Date.now() - planT0).toBeLessThan(UI_BUDGET_MS.planCanvasReady);

    await page.keyboard.press('Control+K');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await expect(page.getByLabel('Command palette search')).toBeFocused();
    await page.keyboard.press('Escape');

    await selectSeededWall(page);
    await expect(page.getByTestId('inspector')).toBeVisible();
    await expect(page.getByTestId('inspector-wall-base-offset')).toBeVisible();
    await page.getByTestId('inspector-wall-base-offset').fill('25');

    await activateTab(page, '3d:vp-main', 'orbit-3d-viewport', UI_BUDGET_MS.threeDViewportReady);
    await expect(page.getByTestId('orbit-3d-canvas')).toBeVisible();
    expect(await hasLiveViewportCanvas(page)).toBe(true);

    await activateTab(page, 'sheet:sheet-a101', 'sheet-mode-shell', UI_BUDGET_MS.tabSwitchReady);
    await activateTab(
      page,
      'schedule:sched-doors',
      'schedule-mode-shell',
      UI_BUDGET_MS.tabSwitchReady,
    );
  });
});

async function activateTab(
  page: Page,
  tabId: string,
  expectedSurfaceTestId: string,
  budgetMs: number,
): Promise<void> {
  const started = Date.now();
  const tabActivator = page.getByTestId(`tab-activate-${tabId}`);
  if ((await tabActivator.count()) > 0) {
    await tabActivator.click();
    await expect(page.locator(`[data-tab-id="${tabId}"]`)).toHaveAttribute('data-active', 'true');
  } else {
    const label = PROJECT_BROWSER_LABELS[tabId];
    if (!label) throw new Error(`No cockpit navigation label configured for ${tabId}`);
    await page.getByRole('treeitem', { name: label }).click();
  }
  await expect(page.getByTestId(expectedSurfaceTestId)).toBeVisible({ timeout: budgetMs });
  expect(Date.now() - started).toBeLessThan(budgetMs);
}

async function selectSeededWall(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const store = (
      window as unknown as { __bimStore?: { getState: () => { elementsById?: unknown } } }
    ).__bimStore;
    const elementsById = store?.getState().elementsById;
    return typeof elementsById === 'object' && elementsById !== null && 'wall-main' in elementsById;
  });
  await page.evaluate(() => {
    const store = (
      window as unknown as { __bimStore?: { getState: () => { select?: (id?: string) => void } } }
    ).__bimStore;
    store?.getState().select?.('wall-main');
  });
}

async function hasLiveViewportCanvas(page: Page): Promise<boolean> {
  return page.getByTestId('orbit-3d-canvas').evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) return false;
    const rect = node.getBoundingClientRect();
    const gl = node.getContext('webgl2') ?? node.getContext('webgl');
    return node.width > 0 && node.height > 0 && rect.width > 300 && rect.height > 200 && !!gl;
  });
}
