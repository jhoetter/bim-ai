import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const SNAPSHOT_PATH = process.env.SKB_SNAPSHOT_PATH;
const VIEWPOINT_ID = process.env.SKB_VIEWPOINT_ID;
const SCREENSHOT_OUT = process.env.SKB_SCREENSHOT_OUT ?? 'checkpoint-actual.png';

if (!SNAPSHOT_PATH || !fs.existsSync(SNAPSHOT_PATH)) {
  throw new Error(`SKB_SNAPSHOT_PATH missing or invalid: ${SNAPSHOT_PATH}`);
}

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
  await page.route('**/api/models/*/comments**', async (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/models/*/activity**', async (route) => route.fulfill({ status: 200, body: '{"events":[]}' }));
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

async function hydrateStore(page: Page, snapshot: any) {
  await page.evaluate((snap) => {
    const win = window as any;
    if (!win.__bimStore) throw new Error('window.__bimStore not exposed');
    win.__bimStore.getState().hydrateFromSnapshot(snap);
  }, snapshot);
  // Allow Three.js to build meshes
  await page.waitForTimeout(1500);
}

async function activateViewpoint(page: Page, vpId: string, snapshot: any) {
  const vpEl = Object.values(snapshot.elements).find((el: any) => el?.kind === 'viewpoint' && el?.id === vpId) as any;
  if (!vpEl || !vpEl.camera) return false;
  
  await page.evaluate(([id, cam]) => {
    const win = window as any;
    const state = win.__bimStore?.getState();
    state?.setActiveViewpointId?.(id);
    state?.setOrbitCameraFromViewpointMm?.(cam);
  }, [vpId, vpEl.camera]);
  
  await page.waitForTimeout(2000);
  return true;
}

test('SKB-03 checkpoint render', async ({ page }) => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH!, 'utf8'));
  
  await bootWorkspace(page);
  await ensure3dMode(page);
  await hydrateStore(page, snapshot);
  
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
