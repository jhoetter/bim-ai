import { expect, type Page } from '@playwright/test';

/**
 * Shared workspace bootstrap helper for TEST-CQ-12 e2e expansion.
 *
 * Mirrors the inline pattern in `cockpit-smoke.spec.ts` and
 * `render-status-supported.spec.ts`, factored out so each new spec
 * stays narrow. The seeded snapshot covers the common element kinds
 * (level, plan view, 3D viewpoint, wall, door, room, schedule, sheet,
 * grid line, view template) so the new specs can target real
 * interactions without each one re-declaring the entire mock surface.
 */

export const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

export type SeedTab = {
  id: string;
  kind: 'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent';
  targetId?: string;
  label: string;
};

export const DEFAULT_TABS: SeedTab[] = [
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
];

export type WorkspaceBootOptions = {
  activeTabId?: string;
  tabs?: SeedTab[];
  /** Extra elements merged into the default snapshot. */
  extraElements?: Record<string, unknown>;
  /** Extra violations merged into the default snapshot. */
  extraViolations?: unknown[];
};

function defaultSnapshotElements(): Record<string, unknown> {
  return {
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
      mode: 'orbit_3d',
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
        projectName: 'TEST-CQ-12',
        drawnBy: 'AI',
        checkedBy: 'QA',
        issueDate: '2026-05-29',
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
    'vt-plan-default': {
      kind: 'view_template',
      id: 'vt-plan-default',
      name: 'Architectural plan',
      detailLevel: 'medium',
    },
  };
}

export async function installWorkspaceRoutes(
  page: Page,
  opts: WorkspaceBootOptions = {},
): Promise<void> {
  const tabs = opts.tabs ?? DEFAULT_TABS;
  const activeTabId = opts.activeTabId ?? tabs[0]?.id ?? 'plan:pv-ground';
  const extraElements = opts.extraElements ?? {};
  const extraViolations = opts.extraViolations ?? [];

  await page.addInitScript(
    ({ tabs: seedTabs, activeId }: { tabs: SeedTab[]; activeId: string }) => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.onboarding-completed', 'true');
      localStorage.setItem('bim.workspaceLayout', 'plan');
      localStorage.setItem('bim-ai:tabs-v1', JSON.stringify({ v: 1, tabs: seedTabs, activeId }));
    },
    { tabs, activeId: activeTabId },
  );

  await page.route('**/api/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: 'p-test-cq-12',
            seedLibrary: true,
            slug: 'test-cq-12',
            title: 'TEST-CQ-12',
            models: [{ id: MODEL_ID, slug: 'canonical', revision: 1 }],
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
        elements: { ...defaultSnapshotElements(), ...extraElements },
        violations: extraViolations,
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
          walls: [],
          levelMarkers: [{ id: 'lvl-ground', name: 'Ground', elevationMm: 0 }],
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

  await page.route('**/api/models/*/comments**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"comments":[]}' }),
  );
  await page.route('**/api/models/*/activity**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"events":[]}' }),
  );
  await page.route('**/api/building-presets**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"presets":{"residential":{}}}',
    }),
  );
  await page.route('**/api/family-catalogs**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"catalogs":[]}' }),
  );
  await page.route('**/api/models/*/presentations', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"presentations":[]}' }),
  );
  await page.route('**/api/models/*/evidence-package', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        format: 'evidencePackage_v1',
        modelId: MODEL_ID,
        revision: 1,
        elementCount: 0,
        countsByKind: {},
        validate: { violations: [] },
        exportLinks: {},
        deterministicSheetEvidence: [],
      }),
    }),
  );
}

export async function bootWorkspace(page: Page, opts: WorkspaceBootOptions = {}): Promise<void> {
  await installWorkspaceRoutes(page, opts);
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('workspace-header')).toBeVisible();
  await expect(page.getByTestId('ribbon-bar')).toBeVisible();
}

/**
 * Open a project-browser left-rail row (e.g. `pv-ground`, `vp-main`,
 * `sched-doors`, `sheet-a101`, `sec-south`). The active composition's
 * focused pane switches to this view.
 */
export async function openLeftRailRow(page: Page, elementId: string): Promise<void> {
  await page.getByTestId(`left-rail-row-${elementId}`).click();
}

/** Wait until the BIM store has hydrated and exposes the seeded elements. */
export async function waitForStore(page: Page, requiredElementIds: string[] = []): Promise<void> {
  await page.waitForFunction(
    (ids) => {
      const store = (
        window as unknown as { __bimStore?: { getState: () => { elementsById?: unknown } } }
      ).__bimStore;
      if (!store) return false;
      const map = store.getState().elementsById as Record<string, unknown> | undefined;
      if (!map) return false;
      return ids.every((id) => map[id] != null);
    },
    requiredElementIds,
    { timeout: 30_000 },
  );
}

/** Select a single element in the store (drives inspector mount). */
export async function selectElement(page: Page, id: string): Promise<void> {
  await page.evaluate((elementId) => {
    const store = (
      window as unknown as {
        __bimStore?: { getState: () => { select?: (id?: string) => void } };
      }
    ).__bimStore;
    store?.getState().select?.(elementId);
  }, id);
}
