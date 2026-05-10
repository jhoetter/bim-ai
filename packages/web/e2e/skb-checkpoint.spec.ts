import fs from 'node:fs';

import { expect, test, type Page } from '@playwright/test';
import type { Element, Snapshot, XYZ } from '@bim-ai/core';

const SNAPSHOT_PATH = process.env.SKB_SNAPSHOT_PATH;
const VIEWPOINT_ID = process.env.SKB_VIEWPOINT_ID;
const SCREENSHOT_OUT = process.env.SKB_SCREENSHOT_OUT ?? 'checkpoint-actual.png';
type ViewpointElement = Extract<Element, { kind: 'viewpoint' }>;
type BimStoreBridge = {
  __bimStore?: {
    getState: () => {
      hydrateFromSnapshot?: (snap: Snapshot) => void;
      setActiveViewpointId?: (id: string) => void;
      setOrbitCameraFromViewpointMm?: (camera: ViewpointElement['camera']) => void;
    };
  };
};

const HAS_SKB_SNAPSHOT = Boolean(SNAPSHOT_PATH && fs.existsSync(SNAPSHOT_PATH));
test.skip(!HAS_SKB_SNAPSHOT, `SKB_SNAPSHOT_PATH missing or invalid: ${SNAPSHOT_PATH}`);

async function bootWorkspace(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
  });
  // Stub API endpoints to avoid noise
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
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"presets":{}}' }),
  );
  await page.goto('/');
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
}

async function ensure3dMode(page: Page) {
  const viewport = page.getByTestId('orbit-3d-viewport');
  if (await viewport.isVisible({ timeout: 2_000 }).catch(() => false)) return;

  const splitTab = page.getByRole('tab', { name: /Plan \+ 3D|3D/i }).first();
  if (await splitTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await splitTab.click();
  } else {
    await page.keyboard.press('2');
  }
  await expect(viewport).toBeVisible({ timeout: 60_000 });
}

function isXyz(value: unknown): value is XYZ {
  const candidate = value as Partial<XYZ> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.xMm === 'number' &&
    typeof candidate.yMm === 'number' &&
    typeof candidate.zMm === 'number'
  );
}

function isViewpointElement(value: unknown): value is ViewpointElement {
  const candidate = value as { kind?: unknown; id?: unknown; camera?: unknown } | null;
  const camera = candidate?.camera as Partial<ViewpointElement['camera']> | null | undefined;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    candidate.kind === 'viewpoint' &&
    typeof candidate.id === 'string' &&
    typeof camera === 'object' &&
    camera !== null &&
    isXyz(camera.position) &&
    isXyz(camera.target) &&
    isXyz(camera.up)
  );
}

async function hydrateStore(page: Page, snapshot: Snapshot) {
  await page.evaluate((snap) => {
    const win = window as unknown as BimStoreBridge;
    if (!win.__bimStore) throw new Error('window.__bimStore not exposed');
    win.__bimStore.getState().hydrateFromSnapshot?.(snap);
  }, snapshot);
  // Allow Three.js to build meshes
  await page.waitForTimeout(1500);
}

async function activateViewpoint(page: Page, vpId: string, snapshot: Snapshot) {
  const vpEl = Object.values(snapshot.elements).find(
    (el): el is ViewpointElement => isViewpointElement(el) && el.id === vpId,
  );
  if (!vpEl || !vpEl.camera) return false;

  await page.evaluate(
    ([id, cam]) => {
      const win = window as unknown as BimStoreBridge;
      const state = win.__bimStore?.getState();
      state?.setActiveViewpointId?.(id);
      state?.setOrbitCameraFromViewpointMm?.(cam);
    },
    [vpId, vpEl.camera],
  );

  await page.waitForTimeout(2000);
  return true;
}

test('SKB-03 checkpoint render', async ({ page }) => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH!, 'utf8')) as Snapshot;

  await bootWorkspace(page);
  await ensure3dMode(page);
  await hydrateStore(page, snapshot);
  await ensure3dMode(page);

  if (VIEWPOINT_ID) {
    const activated = await activateViewpoint(page, VIEWPOINT_ID, snapshot);
    if (!activated) console.warn(`Viewpoint ${VIEWPOINT_ID} not found in snapshot.`);
  } else {
    // Default fit-to-screen
    const viewport = page.locator('[data-testid="orbit-3d-viewport"]');
    await viewport.click({ position: { x: 100, y: 100 } });
    await page.keyboard.press('f');
    await page.waitForTimeout(2500);
  }

  const viewport = page.locator('[data-testid="orbit-3d-viewport"]');
  await viewport.screenshot({ path: SCREENSHOT_OUT });
});
