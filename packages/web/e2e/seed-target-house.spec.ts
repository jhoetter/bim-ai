/**
 * Visual checkpoint harness for `nightshift/seed-target-house/`.
 *
 * Loads the materialised seed fixture (regen via
 *   node scripts/build-seed-snapshot.mjs
 * after every bundle change), drives the workspace to 3D mode,
 * hydrates the Zustand store directly via the `__bimStore` window
 * hook (skips the bootstrap → snapshot fetch path; cleaner for the
 * agent's checkpoint loop), optionally activates a SKB-16 viewpoint,
 * and saves the rendered viewport to
 *   packages/web/test-results/seed-target-house-<viewpoint>-actual.png
 * for side-by-side comparison with `spec/target-house-vis-colored.png`.
 *
 * Per `claude-skills/sketch-to-bim/SKILL.md` § "The refine loop", the
 * agent reads the rendered PNG with its own multimodal vision after
 * each phase commit. Each phase:
 *   1. node scripts/build-seed-snapshot.mjs    # regenerate fixture
 *   2. pnpm --filter @bim-ai/web exec playwright test seed-target-house
 *   3. open the four PNGs in test-results/, compare to the colour study.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '__fixtures__', 'seed-target-house-snapshot.json');

if (!fs.existsSync(FIXTURE_PATH)) {
  throw new Error(
    `Fixture missing: ${FIXTURE_PATH}\nRun: node scripts/build-seed-snapshot.mjs from repo root.`,
  );
}

type SnapshotShape = {
  modelId: string;
  revision: number;
  elements: Record<string, { kind?: string; id?: string }>;
  violations: unknown[];
};

function loadSnapshot(): SnapshotShape {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as SnapshotShape;
}

async function bootWorkspace(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
  });
  // The store hydration path bypasses the API entirely, but the workspace
  // still pings these endpoints during boot — stub with empty payloads to
  // avoid uncaught fetch rejections in the console.
  await page.route('**/api/bootstrap', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"projects":[]}' });
  });
  await page.route('**/api/models/*/comments**', async (route) =>
    route.fulfill({ status: 200, body: '{}' }),
  );
  await page.route('**/api/models/*/activity**', async (route) =>
    route.fulfill({ status: 200, body: '{"events":[]}' }),
  );
  await page.route('**/api/building-presets**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"presets":{"residential":{}}}',
    }),
  );
  await page.goto('/');
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
}

async function ensure3dMode(page: Page) {
  const viewport = page.getByTestId('orbit-3d-viewport');
  if (await viewport.isVisible({ timeout: 1_000 }).catch(() => false)) return;

  const splitTab = page.getByRole('tab', { name: /Plan \+ 3D|3D/i }).first();
  if (await splitTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await splitTab.click();
  } else {
    await page.keyboard.press('2');
  }
  await expect(viewport).toBeVisible({ timeout: 30_000 });
}

async function hydrateStore(page: Page, snapshot: SnapshotShape) {
  await page.evaluate((snap) => {
    type StoreShape = {
      getState: () => {
        hydrateFromSnapshot: (s: SnapshotShape) => void;
      };
    };
    const win = window as unknown as { __bimStore?: StoreShape };
    if (!win.__bimStore) throw new Error('window.__bimStore not exposed');
    win.__bimStore.getState().hydrateFromSnapshot(snap);
  }, snapshot);
  // Allow React to commit the new elements + Three.js to build meshes.
  await page.waitForTimeout(800);
  // Hide the idle canvas hint so checkpoint PNGs contain only model evidence.
  await page.mouse.move(20, 20);
  await page.waitForTimeout(350);
}

type ViewpointId =
  | 'fit'
  | 'vp-main-iso'
  | 'vp-front-elev'
  | 'vp-side-elev-east'
  | 'vp-rear-axo'
  | 'vp-terrace-se';

async function activateViewpoint(
  page: Page,
  vp: ViewpointId,
  snapshot: SnapshotShape,
): Promise<boolean> {
  if (vp === 'fit') return false;
  const vpEl = Object.values(snapshot.elements).find(
    (el) => el?.kind === 'viewpoint' && el?.id === vp,
  ) as undefined | { camera?: { position: Vec3; target: Vec3; up: Vec3 } };
  if (!vpEl) return false;
  type Vec3 = { xMm: number; yMm: number; zMm: number };
  const camera = vpEl.camera;
  if (!camera) return false;
  await page.evaluate(
    ([vpId, cam]) => {
      type StoreActions = {
        setActiveViewpointId?: (id: string) => void;
        setOrbitCameraFromViewpointMm?: (pose: {
          position: { xMm: number; yMm: number; zMm: number };
          target: { xMm: number; yMm: number; zMm: number };
          up: { xMm: number; yMm: number; zMm: number };
        }) => void;
      };
      const win = window as unknown as { __bimStore?: { getState: () => StoreActions } };
      const state = win.__bimStore?.getState();
      state?.setActiveViewpointId?.(vpId as string);
      state?.setOrbitCameraFromViewpointMm?.(
        cam as {
          position: { xMm: number; yMm: number; zMm: number };
          target: { xMm: number; yMm: number; zMm: number };
          up: { xMm: number; yMm: number; zMm: number };
        },
      );
    },
    [vp, camera] as const,
  );
  await page.waitForTimeout(1_500);
  return true;
}

async function captureViewpoint(page: Page, label: string, useFit: boolean) {
  const viewport = page.locator('[data-testid="orbit-3d-viewport"]');
  await expect(viewport).toBeVisible({ timeout: 30_000 });
  if (useFit) {
    // No authored viewpoint — frame the model with F-key fit-to-screen.
    await viewport.click({ position: { x: 100, y: 100 } });
    await page.keyboard.press('f');
    await page.waitForTimeout(2_500);
  } else {
    // Authored viewpoint — let the saved camera settle.
    await page.waitForTimeout(2_000);
  }
  const outPath = `test-results/seed-target-house-${label}-actual.png`;
  await viewport.screenshot({ path: outPath });
  return outPath;
}

test.describe('seed-target-house', () => {
  test.beforeEach(async ({ page }) => {
    await bootWorkspace(page);
    await ensure3dMode(page);
    const snapshot = loadSnapshot();
    await hydrateStore(page, snapshot);
    await ensure3dMode(page);
  });

  test('main iso', async ({ page }) => {
    const snapshot = loadSnapshot();
    const activated = await activateViewpoint(page, 'vp-main-iso', snapshot);
    const out = await captureViewpoint(page, 'main-iso', !activated);
    expect(fs.existsSync(out)).toBe(true);
  });

  test('front elevation', async ({ page }) => {
    const snapshot = loadSnapshot();
    const activated = await activateViewpoint(page, 'vp-front-elev', snapshot);
    const out = await captureViewpoint(page, 'front-elev', !activated);
    expect(fs.existsSync(out)).toBe(true);
  });

  test('east side elevation', async ({ page }) => {
    const snapshot = loadSnapshot();
    const activated = await activateViewpoint(page, 'vp-side-elev-east', snapshot);
    const out = await captureViewpoint(page, 'side-elev-east', !activated);
    expect(fs.existsSync(out)).toBe(true);
  });

  test('rear axonometric', async ({ page }) => {
    const snapshot = loadSnapshot();
    const activated = await activateViewpoint(page, 'vp-rear-axo', snapshot);
    const out = await captureViewpoint(page, 'rear-axo', !activated);
    expect(fs.existsSync(out)).toBe(true);
  });

  test('terrace roof cutout', async ({ page }) => {
    const snapshot = loadSnapshot();
    const activated = await activateViewpoint(page, 'vp-terrace-se', snapshot);
    const out = await captureViewpoint(page, 'terrace-cutout', !activated);
    expect(fs.existsSync(out)).toBe(true);
  });
});
