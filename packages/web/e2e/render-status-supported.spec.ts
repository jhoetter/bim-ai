import { test, expect, type Page } from '@playwright/test';

/**
 * Real-browser verification for the realistic-3d partial-status tracker.
 *
 * Each of the five element kinds below was previously blanket-tagged as
 * `partial` by static skip flags in `elementRenderFeatureStatus.ts`. After
 * the fixes landed in dc1bf544, the right-rail inspector's `Render status`
 * chip should read `supported` for each one in a real browser DOM.
 */

const MODEL_ID = '00000000-0000-4000-a000-render-status';

const TAB_ID = '3d:vp-main';

type ExpectedCase = {
  elementId: string;
  label: string;
};

const CASES: ExpectedCase[] = [
  { elementId: 'door-hosted', label: 'hosted door (CSG cut)' },
  { elementId: 'roof-gable', label: 'gable_pitched_rectangle roof' },
  { elementId: 'stair-straight', label: 'straight stair' },
  { elementId: 'rail-regular', label: 'regular-baluster railing with host edge' },
  { elementId: 'placed-bed', label: 'placed asset with renderProxyKind' },
];

test.describe('realistic-3d render-status chip', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.onboarding-completed', 'true');
      localStorage.setItem('bim.workspaceLayout', 'plan');
      localStorage.setItem(
        'bim-ai:tabs-v1',
        JSON.stringify({
          v: 1,
          tabs: [
            { id: 'plan:pv-ground', kind: 'plan', targetId: 'pv-ground', label: 'Ground plan' },
            { id: '3d:vp-main', kind: '3d', targetId: 'vp-main', label: 'Main 3D' },
          ],
          activeId: 'plan:pv-ground',
        }),
      );
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    await page.route('**/api/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            {
              id: 'p-render-status',
              seedLibrary: true,
              slug: 'render-status',
              title: 'Render status',
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
        body: JSON.stringify(snapshotBody()),
      });
    });

    await page.route('**/api/models/*/comments**', (r) => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/models/*/activity**', (r) =>
      r.fulfill({ status: 200, body: '{"events":[]}' }),
    );
    await page.route('**/api/building-presets**', (r) =>
      r.fulfill({ status: 200, body: '{"presets":{"residential":{}}}' }),
    );
    await page.route('**/api/family-catalogs**', (r) =>
      r.fulfill({ status: 200, body: '{"catalogs":[]}' }),
    );
    await page.route('**/api/models/*/presentations', (r) =>
      r.fulfill({ status: 200, body: '{"presentations":[]}' }),
    );
  });

  test('reports "supported" for hosted opening, gable roof, stair, railing, and placed asset', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
    await waitForStoreElements(page, [
      'door-hosted',
      'roof-gable',
      'stair-straight',
      'rail-regular',
      'placed-bed',
    ]);

    const observed: Array<ExpectedCase & { actual: string }> = [];
    for (const c of CASES) {
      await selectElement(page, c.elementId);
      const chip = await readRenderStatusChip(page);
      observed.push({ ...c, actual: chip });
    }

    for (const row of observed) {
      expect(
        row.actual,
        `expected "Render status" chip = "supported" for ${row.label} (id=${row.elementId}), got "${row.actual}"`,
      ).toBe('supported');
    }
  });
});

async function waitForStoreElements(page: Page, ids: string[]): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const store = (
        window as unknown as { __bimStore?: { getState: () => { elementsById?: unknown } } }
      ).__bimStore;
      const elementsById = store?.getState().elementsById;
      if (typeof elementsById !== 'object' || elementsById === null) return false;
      const map = elementsById as Record<string, unknown>;
      return expected.every((id) => map[id] != null);
    },
    ids,
    { timeout: 30_000 },
  );
}

async function selectElement(page: Page, id: string): Promise<void> {
  await page.evaluate((elementId) => {
    const store = (
      window as unknown as { __bimStore?: { getState: () => { select?: (id?: string) => void } } }
    ).__bimStore;
    store?.getState().select?.(elementId);
  }, id);
  // Wait for the right-rail inspector to mount its Render status section
  // for the newly selected element.
  await page.waitForFunction(() => {
    const headings = Array.from(document.querySelectorAll('*')).filter(
      (n) => (n.textContent ?? '').trim() === 'Render status',
    );
    if (!headings.length) return false;
    for (const h of headings) {
      const sib = h.nextElementSibling;
      const txt = sib instanceof HTMLElement ? sib.textContent?.trim() : '';
      if (txt && /^(supported|partial|unsupported|not_applicable)$/.test(txt)) return true;
    }
    return false;
  });
}

async function readRenderStatusChip(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('*')).filter(
      (n) => n.textContent === 'Render status',
    );
    for (const h of headings) {
      const sibling = h.nextElementSibling;
      if (sibling instanceof HTMLElement) {
        const txt = sibling.textContent?.trim();
        if (txt) return txt;
      }
    }
    return '';
  });
}

function snapshotBody(): unknown {
  return {
    modelId: MODEL_ID,
    revision: 1,
    elements: {
      'lvl-ground': { kind: 'level', id: 'lvl-ground', name: 'Ground', elevationMm: 0 },
      'lvl-upper': { kind: 'level', id: 'lvl-upper', name: 'Upper', elevationMm: 3000 },
      'vp-main': {
        kind: 'viewpoint',
        id: 'vp-main',
        name: 'Main 3D',
        mode: 'orbit_3d',
        camera: {
          position: { xMm: 12000, yMm: -9000, zMm: 6000 },
          target: { xMm: 3000, yMm: 2000, zMm: 1500 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
      },
      'pv-ground': {
        kind: 'plan_view',
        id: 'pv-ground',
        name: 'Ground plan',
        levelId: 'lvl-ground',
      },
      'wall-host': {
        kind: 'wall',
        id: 'wall-host',
        name: 'Host wall',
        levelId: 'lvl-ground',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 6000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 3000,
        discipline: 'arch',
      },
      'door-type': {
        kind: 'family_type',
        id: 'door-type',
        name: 'Single door',
        familyId: 'builtin:door:single',
        discipline: 'door',
        parameters: { leafWidthMm: 920, leafHeightMm: 2140 },
      },
      'door-hosted': {
        kind: 'door',
        id: 'door-hosted',
        name: 'Front door',
        wallId: 'wall-host',
        alongT: 0.5,
        widthMm: 900,
        familyTypeId: 'door-type',
        operationType: 'swing_single',
        materialKey: 'aluminium_dark_grey',
        materialSlots: {
          frame: 'aluminium_black',
          panel: 'cladding_warm_wood',
          threshold: 'concrete_smooth',
          hardware: 'asset_stainless_brushed',
          glass: 'asset_clear_glass_double',
        },
        discipline: 'arch',
      },
      'roof-gable': {
        kind: 'roof',
        id: 'roof-gable',
        name: 'Gable roof',
        referenceLevelId: 'lvl-upper',
        roofGeometryMode: 'gable_pitched_rectangle',
        footprintMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
          { xMm: 6000, yMm: 4000 },
          { xMm: 0, yMm: 4000 },
        ],
        materialKey: 'roof_tiles_dark',
      },
      'stair-straight': {
        kind: 'stair',
        id: 'stair-straight',
        name: 'Straight stair',
        baseLevelId: 'lvl-ground',
        topLevelId: 'lvl-upper',
        shape: 'straight',
        runStartMm: { xMm: 0, yMm: 0 },
        runEndMm: { xMm: 3000, yMm: 0 },
        widthMm: 1000,
        riserMm: 175,
        treadMm: 280,
        materialKey: 'concrete_smooth',
      },
      'floor-upper': {
        kind: 'floor',
        id: 'floor-upper',
        name: 'Upper floor',
        levelId: 'lvl-upper',
        outlineMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
          { xMm: 6000, yMm: 4000 },
          { xMm: 0, yMm: 4000 },
        ],
        thicknessMm: 200,
      },
      'rail-regular': {
        kind: 'railing',
        id: 'rail-regular',
        name: 'Regular railing',
        levelId: 'lvl-upper',
        hostFloorId: 'floor-upper',
        hostEdgeId: 'floor-upper:edge:south',
        pathMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 6000, yMm: 0 },
        ],
        balusterPattern: { rule: 'regular', spacingMm: 100 },
        heightMm: 1100,
        materialKey: 'metal_brushed',
        props: { requiresHostedEdge: true },
      },
      'asset-bed': {
        kind: 'asset_library_entry',
        id: 'asset-bed',
        assetKind: 'block_2d',
        name: 'Bed',
        tags: ['bedroom'],
        category: 'furniture',
        thumbnailKind: 'schematic_plan',
        planSymbolKind: 'bed',
        renderProxyKind: 'bed',
      },
      'placed-bed': {
        kind: 'placed_asset',
        id: 'placed-bed',
        name: 'Bed',
        assetId: 'asset-bed',
        levelId: 'lvl-upper',
        positionMm: { xMm: 1200, yMm: 1400 },
      },
    },
    violations: [],
  };
}
