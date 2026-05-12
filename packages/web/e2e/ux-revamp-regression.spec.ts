import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

type SeedTab = {
  id: string;
  kind: 'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent' | 'concept';
  targetId?: string;
  label: string;
};

const VIEW_TABS: SeedTab[] = [
  { id: 'plan:pv-ground', kind: 'plan', targetId: 'pv-ground', label: 'Ground plan' },
  { id: '3d:vp-main', kind: '3d', targetId: 'vp-main', label: 'Main 3D' },
  {
    id: 'section:sec-south',
    kind: 'section',
    targetId: 'sec-south',
    label: 'South section',
  },
  { id: 'sheet:sheet-a101', kind: 'sheet', targetId: 'sheet-a101', label: 'A101' },
  { id: 'schedule:sched-doors', kind: 'schedule', targetId: 'sched-doors', label: 'Doors' },
  { id: 'concept', kind: 'concept', label: 'Concept board' },
  { id: 'agent', kind: 'agent', label: 'Advisor review' },
];

const VIEW_SCENARIOS = [
  {
    name: 'plan',
    tabId: 'plan:pv-ground',
    secondaryId: 'secondary-sidebar-plan',
    canvasId: 'plan-canvas',
    screenshot: '01-plan.png',
  },
  {
    name: '3d',
    tabId: '3d:vp-main',
    secondaryId: 'secondary-sidebar-3d',
    canvasId: 'orbit-3d-viewport',
    screenshot: '02-3d.png',
  },
  {
    name: 'section',
    tabId: 'section:sec-south',
    secondaryId: 'secondary-sidebar-section',
    canvasId: 'section-mode-shell',
    screenshot: '03-section.png',
  },
  {
    name: 'sheet',
    tabId: 'sheet:sheet-a101',
    secondaryId: 'secondary-sidebar-sheet',
    canvasId: 'sheet-mode-shell',
    screenshot: '04-sheet.png',
  },
  {
    name: 'schedule',
    tabId: 'schedule:sched-doors',
    secondaryId: 'secondary-sidebar-schedule',
    canvasId: 'schedule-mode-shell',
    screenshot: '05-schedule.png',
  },
  {
    name: 'concept',
    tabId: 'concept',
    secondaryId: 'secondary-sidebar-concept',
    canvasId: 'concept-mode-shell',
    screenshot: '06-concept.png',
  },
  {
    name: 'agent',
    tabId: 'agent',
    secondaryId: 'secondary-sidebar-agent',
    canvasId: 'agent-review-mode-shell',
    screenshot: '07-agent.png',
  },
];

async function installWorkspaceRoutes(page: Page, activeTabId = 'plan:pv-ground') {
  await page.addInitScript(
    ({ tabs, activeId }: { tabs: SeedTab[]; activeId: string }) => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.onboarding-completed', 'true');
      localStorage.setItem('bim.workspaceLayout', 'plan');
      localStorage.setItem('bim-ai:tabs-v1', JSON.stringify({ v: 1, tabs, activeId }));
    },
    { tabs: VIEW_TABS, activeId: activeTabId },
  );

  await page.route('**/api/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: 'p-ux-wp-10',
            slug: 'ux-wp-10',
            title: 'UX WP-10',
            models: [{ id: MODEL_ID, slug: 'canonical-shell', revision: 10 }],
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
        revision: 10,
        elements: {
          'lvl-ground': { kind: 'level', id: 'lvl-ground', name: 'Ground', elevationMm: 0 },
          'lvl-upper': { kind: 'level', id: 'lvl-upper', name: 'Upper', elevationMm: 3000 },
          'pv-ground': {
            kind: 'plan_view',
            id: 'pv-ground',
            name: 'Ground plan',
            levelId: 'lvl-ground',
            planPresentation: 'opening_focus',
          },
          'vp-main': {
            kind: 'viewpoint',
            id: 'vp-main',
            name: 'Main 3D',
            camera: {
              position: { xMm: 9000, yMm: -8500, zMm: 6200 },
              target: { xMm: 2500, yMm: 1800, zMm: 1400 },
              up: { xMm: 0, yMm: 0, zMm: 1 },
            },
          },
          'sec-south': {
            kind: 'section_cut',
            id: 'sec-south',
            name: 'South section',
            lineStartMm: { xMm: -500, yMm: 5000 },
            lineEndMm: { xMm: 8000, yMm: 5000 },
            cropDepthMm: 9000,
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
              projectName: 'UX regression',
              drawnBy: 'AI',
              checkedBy: 'UX',
              issueDate: '2026-05-11',
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
              {
                viewportId: 'vp-section',
                label: 'South section',
                viewRef: 'section:sec-south',
                xMm: 1800,
                yMm: 9400,
                widthMm: 9000,
                heightMm: 4200,
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
          },
          'door-main': {
            kind: 'door',
            id: 'door-main',
            name: 'Entry door',
            wallId: 'wall-main',
            alongT: 0.5,
            widthMm: 1000,
          },
          'room-main': {
            kind: 'room',
            id: 'room-main',
            name: 'Living',
            levelId: 'lvl-ground',
            outlineMm: [
              { xMm: 0, yMm: 0 },
              { xMm: 7200, yMm: 0 },
              { xMm: 7200, yMm: 4600 },
              { xMm: 0, yMm: 4600 },
            ],
          },
          'grid-a': {
            kind: 'grid_line',
            id: 'grid-a',
            name: 'A',
            levelId: 'lvl-ground',
            start: { xMm: 0, yMm: -1200 },
            end: { xMm: 0, yMm: 5600 },
          },
        },
        violations: [
          {
            ruleId: 'ux_wp_10_seeded_advisor',
            severity: 'warning',
            message: 'Seeded advisor warning for footer/dialog ownership regression.',
            elementId: 'wall-main',
            discipline: 'architecture',
          },
        ],
      }),
    });
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
          walls: [{ uStartMm: 600, uEndMm: 7200, zBottomMm: 0, zTopMm: 3000 }],
          levelMarkers: [
            { id: 'lvl-ground', name: 'Ground', elevationMm: 0 },
            { id: 'lvl-upper', name: 'Upper', elevationMm: 3000 },
          ],
        },
      }),
    });
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

  await page.route('**/api/models/*/comments**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    });
  });
  await page.route('**/api/models/*/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    });
  });
  await page.route('**/api/building-presets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ presets: { residential: {} } }),
    });
  });
  await page.route('**/api/family-catalogs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ catalogs: [] }),
    });
  });
  await page.route('**/api/models/*/presentations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ presentations: [] }),
    });
  });
  await page.route('**/api/models/*/evidence-package', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        format: 'evidencePackage_v1',
        modelId: MODEL_ID,
        revision: 10,
        elementCount: 10,
        countsByKind: { level: 2, wall: 1, sheet: 1, schedule: 1 },
        validate: { violations: [] },
        exportLinks: {},
        deterministicSheetEvidence: [],
      }),
    });
  });
}

async function bootWorkspace(page: Page, activeTabId = 'plan:pv-ground') {
  await installWorkspaceRoutes(page, activeTabId);
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('workspace-header')).toBeVisible();
  await expect(page.getByTestId('ribbon-bar')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, filename: string) {
  const outDir = process.env.UX_SCREENSHOT_DIR;
  if (!outDir) {
    await testInfo.attach(filename, { body: await page.screenshot(), contentType: 'image/png' });
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, filename), fullPage: false });
}

async function assertSevenRegionOwnership(page: Page) {
  const shell = page.getByTestId('app-shell');
  await expect(shell).toHaveAttribute('data-element-sidebar-present', 'false');
  await expect(shell).toHaveAttribute('data-primary-hidden', 'false');
  await expect(page.getByTestId('workspace-header')).toBeVisible();
  await expect(page.getByTestId('view-tabs')).toBeVisible();
  await expect(page.getByTestId('ribbon-bar')).toBeVisible();
  await expect(page.getByTestId('app-shell-primary-sidebar')).toBeVisible();
  await expect(page.getByTestId('app-shell-secondary-sidebar')).toBeVisible();
  await expect(page.getByTestId('app-shell-canvas')).toBeVisible();
  await expect(page.getByTestId('app-shell-footer')).toBeVisible();
  await expect(page.getByTestId('status-bar')).toBeVisible();
  await expect(page.getByTestId('app-shell-element-sidebar')).toBeHidden();
}

async function assertSemanticRegionOwnership(page: Page) {
  const header = page.getByRole('banner', { name: 'Workspace header' });
  await expect(header).toBeVisible();
  await expect(header.getByRole('tablist', { name: 'Open views' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Open command palette' })).toBeVisible();
  await expect(header.getByRole('button', { name: /share/i })).toBeVisible();
  await expect(header.getByRole('button', { name: /wall|measure|dimension|tag/i })).toHaveCount(0);

  const primary = page.getByRole('complementary', { name: 'Project browser' });
  await expect(primary).toBeVisible();
  await expect(primary.getByRole('tree', { name: 'Project browser' })).toBeVisible();
  await expect(primary.getByRole('button', { name: /ux wp-10/i })).toBeVisible();
  for (const group of ['Concept', 'Floor Plans', '3D Views', 'Sections', 'Sheets', 'Schedules']) {
    await expect(primary.getByText(group, { exact: true })).toBeVisible();
  }
  for (const misplaced of ['Browser legend', 'Wall Types', 'Families...', 'Levels']) {
    await expect(primary.getByText(misplaced, { exact: true })).toHaveCount(0);
  }

  const secondary = page.getByRole('complementary', { name: 'Active view settings' });
  await expect(secondary).toBeVisible();
  await expect(secondary.getByText('Floor plan', { exact: true })).toBeVisible();
  await expect(secondary.getByText('View State', { exact: true })).toBeVisible();

  await expect(page.getByRole('region', { name: 'Ribbon' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByRole('contentinfo', { name: 'Global status footer' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);
}

async function activateTab(page: Page, tabId: string) {
  await page.getByTestId(`tab-activate-${tabId}`).click();
  await expect(page.locator(`[data-tab-id="${tabId}"]`)).toHaveAttribute('data-active', 'true');
}

test.describe('UX-WP-10 visual and interaction regression suite', () => {
  test('captures main view types and enforces canonical ownership', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);

    for (const scenario of VIEW_SCENARIOS) {
      await activateTab(page, scenario.tabId);
      await assertSevenRegionOwnership(page);
      await expect(page.getByTestId(scenario.secondaryId)).toBeVisible();
      await expect(page.getByTestId(scenario.canvasId)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('tool-palette')).toHaveCount(0);
      await expect(page.getByTestId('temp-visibility-chip')).toHaveCount(0);
      await expect(page.getByTestId('status-bar-advisor-entry')).toContainText('1 warning');

      if (scenario.name === '3d') {
        await expect(page.getByTestId('view-cube')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId('orbit-viewpoint-persisted-hud')).toHaveCount(0);
      }

      await capture(page, testInfo, scenario.screenshot);
    }
  });

  test('captures narrow primary-sidebar recovery interaction', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootWorkspace(page);

    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'true');
    await expect(page.getByTestId('app-shell-primary-sidebar')).toBeHidden();
    await expect(page.getByTestId('app-shell-primary-reveal')).toBeVisible();
    await capture(page, testInfo, '08-narrow-primary-hidden.png');

    await page.getByTestId('app-shell-primary-reveal').click();
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'false');
    await expect(page.getByTestId('app-shell-primary-sidebar')).toBeVisible();
    await capture(page, testInfo, '09-narrow-primary-restored.png');
  });

  test('keeps narrow footer one-line with advisor priority', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootWorkspace(page);

    const footerMetrics = await page.getByTestId('status-bar').evaluate((node) => {
      const el = node as HTMLElement;
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      };
    });
    expect(footerMetrics.scrollHeight).toBeLessThanOrEqual(footerMetrics.clientHeight + 1);
    expect(footerMetrics.scrollWidth).toBeLessThanOrEqual(footerMetrics.clientWidth + 1);
    await expect(page.getByTestId('status-bar-advisor-entry')).toBeVisible();
    await expect(page.getByTestId('status-bar-activity-entry')).toBeVisible();
    await expect(page.getByTestId('status-bar-context-cluster')).toBeHidden();
    await capture(page, testInfo, '40-narrow-footer-density.png');
  });

  test('collapses primary sidebar to zero width and restores from header', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    const handle = page.getByTestId('app-shell-primary-resize-handle');
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 12);
    await page.mouse.down();
    await page.mouse.move(0, handleBox!.y + 12);
    await page.mouse.up();

    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'true');
    await expect(page.getByRole('complementary', { name: 'Project browser' })).toHaveCount(0);
    await expect(page.getByTestId('app-shell-primary-reveal')).toBeVisible();
    await capture(page, testInfo, '36-primary-dragged-to-zero.png');

    await page.getByTestId('app-shell-primary-reveal').click();
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'false');
    await expect(page.getByRole('complementary', { name: 'Project browser' })).toBeVisible();
    await expect(page.getByTestId('app-shell-primary-reveal')).toHaveCount(0);
    await capture(page, testInfo, '37-primary-restored-from-zero.png');
  });

  test('captures tablet shell region stability', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await bootWorkspace(page);

    await assertSevenRegionOwnership(page);
    const primary = await page.getByTestId('app-shell-primary-sidebar').boundingBox();
    const secondary = await page.getByTestId('app-shell-secondary-sidebar').boundingBox();
    const canvas = await page.getByTestId('app-shell-canvas').boundingBox();
    const footer = await page.getByTestId('app-shell-footer').boundingBox();
    expect(primary?.width).toBeGreaterThan(180);
    expect(secondary?.width).toBeGreaterThan(150);
    expect(canvas?.width).toBeGreaterThan(180);
    expect(primary && secondary && primary.x + primary.width <= secondary.x + 1).toBeTruthy();
    expect(secondary && canvas && secondary.x + secondary.width <= canvas.x + 1).toBeTruthy();
    expect(footer?.y).toBeGreaterThan((canvas?.y ?? 0) + 1);
    await capture(page, testInfo, '31-tablet-responsive-shell.png');
  });

  test('captures footer advisor and Cmd+K resource dialog reachability', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    await page.getByTestId('status-bar-advisor-entry').click();
    await expect(page.getByTestId('advisor-dialog')).toBeVisible();
    await capture(page, testInfo, '10-advisor-dialog.png');
    await page.getByTestId('advisor-dialog-close').click();

    await page.getByTestId('workspace-header-cmdk').click();
    await expect(page.getByTestId('cmd-palette-v3')).toBeVisible();
    await page.getByLabel('Command palette search').fill('manage links');
    await expect(page.getByTestId('palette-entry-project.manage-links')).toBeVisible();
    await capture(page, testInfo, '11-cmdk-manage-links.png');
    await page.getByTestId('palette-entry-project.manage-links').click();
    await expect(page.getByTestId('manage-links-dialog')).toBeVisible();
    await capture(page, testInfo, '12-manage-links-dialog.png');
  });

  test('captures canonical dialog and resource triggers', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    await page.getByTestId('primary-project-selector').click();
    await expect(page.getByTestId('project-menu')).toBeVisible();
    await capture(page, testInfo, '13-project-menu.png');
    await page.keyboard.press('Escape');

    await page.getByTestId('ribbon-tab-insert').click();
    await page.getByTestId('ribbon-command-family-library').click();
    await expect(page.getByTestId('family-library-panel')).toBeVisible();
    await capture(page, testInfo, '14-family-library.png');
    await page.getByRole('button', { name: 'Close family library' }).click();

    await page.getByTestId('workspace-header-cmdk').click();
    await page.getByLabel('Command palette search').fill('plan visibility');
    await expect(page.getByTestId('palette-entry-visibility.plan.graphics')).toBeVisible();
    await page.getByTestId('palette-entry-visibility.plan.graphics').click();
    await expect(page.getByRole('dialog', { name: 'Visibility/Graphics Overrides' })).toBeVisible();
    await capture(page, testInfo, '15-visibility-graphics-dialog.png');
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('workspace-header-share')).toBeEnabled();
    await page.getByTestId('workspace-header-share').click();
    await expect(page.getByRole('dialog', { name: 'Share live presentation' })).toBeVisible();
    await capture(page, testInfo, '16-share-presentation-dialog.png');
    await page.keyboard.press('Escape');

    await page.getByTestId('status-bar-activity-entry').click();
    await expect(page.getByTestId('activity-drawer')).toBeVisible();
    await capture(page, testInfo, '17-activity-drawer.png');
  });

  test('captures element-sidebar selection and deselection behavior', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);

    await expect(page.getByTestId('app-shell')).toHaveAttribute(
      'data-element-sidebar-present',
      'false',
    );
    await page.evaluate(() => {
      const win = window as unknown as {
        __bimStore?: { getState: () => { select?: (id?: string) => void } };
      };
      win.__bimStore?.getState().select?.('wall-main');
    });
    await expect(page.getByTestId('app-shell')).toHaveAttribute(
      'data-element-sidebar-present',
      'true',
    );
    await expect(page.getByTestId('app-shell-element-sidebar')).toBeVisible();
    await expect(page.getByTestId('inspector')).toBeVisible();
    await expect(page.getByTestId('inspector-wall-move-apply')).toBeVisible();
    await capture(page, testInfo, '18-element-sidebar-selected-wall.png');

    await page.evaluate(() => {
      const win = window as unknown as {
        __bimStore?: { getState: () => { select?: (id?: string) => void } };
      };
      win.__bimStore?.getState().select?.(undefined);
    });
    await expect(page.getByTestId('app-shell')).toHaveAttribute(
      'data-element-sidebar-present',
      'false',
    );
    await expect(page.getByTestId('app-shell-element-sidebar')).toBeHidden();
    await capture(page, testInfo, '19-element-sidebar-deselected.png');
  });

  test('proves keyboard reachability for canonical regions and dialogs', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    await expect(page.getByTestId('app-shell-primary-resize-handle')).toHaveAttribute(
      'role',
      'separator',
    );

    await page.getByTestId('workspace-header-cmdk').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await expect(page.getByLabel('Command palette search')).toBeFocused();
    await capture(page, testInfo, '20-keyboard-command-palette.png');
    await page.keyboard.press('Escape');

    await page.getByTestId('primary-project-selector').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu', { name: 'Project menu' })).toBeVisible();
    await capture(page, testInfo, '21-keyboard-project-menu.png');
    await page.keyboard.press('Escape');

    await page.getByTestId('ribbon-tab-insert').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ribbon-tab-insert')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('ribbon-command-family-library').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Family library' })).toBeVisible();
    await capture(page, testInfo, '22-keyboard-family-library.png');
    await page.getByRole('button', { name: 'Close family library' }).click();

    await page.getByTestId('status-bar-advisor-entry').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('advisor-dialog')).toBeVisible();
    await capture(page, testInfo, '23-keyboard-advisor-dialog.png');
    await page.getByTestId('advisor-dialog-close').click();

    await page.getByTestId('status-bar-activity-entry').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Activity stream' })).toBeVisible();
    await capture(page, testInfo, '24-keyboard-activity-drawer.png');
  });

  test('captures primary navigation context menu ownership', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    const planRow = page.getByTestId('left-rail-row-pv-ground');
    await planRow.click({ button: 'right' });
    await expect(page.getByTestId('primary-nav-context-menu')).toBeVisible();
    await expect(page.getByTestId('primary-nav-context-open')).toBeVisible();
    await expect(page.getByTestId('primary-nav-context-rename')).toBeEnabled();
    await expect(page.getByTestId('primary-nav-context-duplicate')).toBeEnabled();
    await expect(page.getByTestId('primary-nav-context-delete')).toBeEnabled();
    await capture(page, testInfo, '25-primary-nav-context-menu.png');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('primary-nav-context-menu')).toHaveCount(0);

    await planRow.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByTestId('primary-nav-context-menu')).toBeVisible();
    await capture(page, testInfo, '26-keyboard-primary-nav-context-menu.png');

    await page.getByTestId('primary-nav-context-open').click();
    await expect(page.locator('[data-tab-id="plan:pv-ground"]')).toHaveAttribute(
      'data-active',
      'true',
    );
    await expect(page.getByTestId('primary-nav-context-menu')).toHaveCount(0);
  });

  test('proves semantic region ownership without legacy chrome IDs', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);

    await assertSemanticRegionOwnership(page);
    await capture(page, testInfo, '34-semantic-region-ownership.png');
  });
});

test.describe('UX-RISK-009 public presentation shell', () => {
  test('keeps public presentation outside authoring workspace chrome', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.route('**/api/p/public-ux-risk-009', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          modelId: MODEL_ID,
          revision: 11,
          elements: {},
          presentation: {
            id: 'presentation-risk-009',
            displayName: 'Stakeholder Review',
            openCount: 1,
          },
        }),
      });
    });

    await page.goto('/p/public-ux-risk-009');
    await expect(page.getByTestId('public-presentation-viewport')).toBeVisible();
    await expect(page.getByText('Shared by Stakeholder Review')).toBeVisible();
    await expect(page.getByText('This presentation has no visible model elements.')).toBeVisible();
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await expect(page.getByTestId('workspace-header')).toHaveCount(0);
    await expect(page.getByTestId('app-shell-primary-sidebar')).toHaveCount(0);
    await expect(page.getByTestId('ribbon-bar')).toHaveCount(0);
    await expect(page.getByTestId('app-shell-footer')).toHaveCount(0);
    await capture(page, testInfo, '29-public-presentation-shell.png');
  });
});
