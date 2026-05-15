import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('packages/web/tmp/ux-next-wp44-picklines-20260515');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1728, height: 1080 },
  deviceScaleFactor: 1,
});

const consoleErrors = [];
const pageErrors = [];
const navigations = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !text.includes('favicon.ico')) consoleErrors.push(text);
});
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});

await page.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('bim.onboarding-completed', 'true');
  sessionStorage.clear();
});

async function waitForStore() {
  await page.waitForFunction(() => Boolean(window.__bimStore?.getState?.().modelId), null, {
    timeout: 20_000,
  });
}

async function openGroundPlan() {
  await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
  await waitForStore();
  const groundPlan = page.getByText('Ground Floor — Plan', { exact: true }).first();
  if (await groundPlan.isVisible().catch(() => false)) {
    await groundPlan.click();
  } else {
    await page
      .getByText(/Ground floor plan|Ground Floor plan/i)
      .first()
      .click();
  }
  await page.waitForSelector('[data-testid="plan-canvas"]', { timeout: 20_000 });
}

async function applyCommand(command) {
  return page.evaluate(async (command) => {
    const store = window.__bimStore;
    const state = store.getState();
    const modelId = state.modelId;
    if (!modelId) throw new Error('No model id in store');
    const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command, userId: 'wp44-picklines-capture' }),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(`Command failed ${response.status}: ${JSON.stringify(payload)}`);
    }
    const snapshotResponse = await fetch(
      `/api/models/${encodeURIComponent(modelId)}/snapshot?expandLinks=true`,
    );
    const snapshot = await snapshotResponse.json();
    if (!snapshotResponse.ok) {
      throw new Error(`Snapshot failed ${snapshotResponse.status}: ${JSON.stringify(snapshot)}`);
    }
    state.hydrateFromSnapshot(snapshot);
    return payload;
  }, command);
}

async function stateEval(fn, arg) {
  return page.evaluate(fn, arg);
}

async function activeLevelId() {
  return stateEval(() => {
    const state = window.__bimStore.getState();
    return (
      state.activeLevelId ||
      Object.values(state.elementsById).find(
        (e) => e.kind === 'level' && /ground/i.test(e.name || ''),
      )?.id ||
      Object.values(state.elementsById).find((e) => e.kind === 'level')?.id
    );
  });
}

async function setWallTool() {
  await stateEval(() => window.__bimStore.getState().setPlanTool('wall'));
  const wallButton = page.getByRole('button', { name: /^Wall$/i }).first();
  if (await wallButton.isVisible().catch(() => false)) await wallButton.click();
  await page.waitForFunction(() => window.__bimStore.getState().planTool === 'wall', null, {
    timeout: 5_000,
  });
}

async function canvasBox() {
  const box = await page.locator('[data-testid="plan-canvas"]').boundingBox();
  if (!box) throw new Error('plan canvas has no bounding box');
  return box;
}

async function pointAt(screen) {
  await page.mouse.move(screen.x, screen.y);
  await page.waitForFunction(() => Boolean(window.__bimStore.getState().planHudMm), null, {
    timeout: 5_000,
  });
  return stateEval(() => window.__bimStore.getState().planHudMm);
}

async function screenForWorld(target, seedScreen) {
  const sample = async (screen) => {
    await page.mouse.move(screen.x, screen.y);
    await page.waitForTimeout(80);
    const hud = await stateEval(() => window.__bimStore.getState().planHudMm);
    if (!hud) throw new Error('No plan HUD while calibrating screen point');
    return hud;
  };
  const s0 = { ...seedScreen };
  const sx = { x: seedScreen.x + 220, y: seedScreen.y };
  const sy = { x: seedScreen.x, y: seedScreen.y + 220 };
  const h0 = await sample(s0);
  const hx = await sample(sx);
  const hy = await sample(sy);
  const ax = { xMm: (hx.xMm - h0.xMm) / 220, yMm: (hx.yMm - h0.yMm) / 220 };
  const ay = { xMm: (hy.xMm - h0.xMm) / 220, yMm: (hy.yMm - h0.yMm) / 220 };
  const det = ax.xMm * ay.yMm - ay.xMm * ax.yMm;
  if (Math.abs(det) < 1e-6) {
    throw new Error(`Cannot calibrate plan screen transform: ${JSON.stringify({ h0, hx, hy })}`);
  }
  const dx = target.xMm - h0.xMm;
  const dy = target.yMm - h0.yMm;
  const screenDx = (dx * ay.yMm - ay.xMm * dy) / det;
  const screenDy = (ax.xMm * dy - dx * ax.yMm) / det;
  return { x: s0.x + screenDx, y: s0.y + screenDy };
}

async function waitForPreview() {
  await page.waitForSelector('[data-testid="wall-pick-line-preview"]', { timeout: 5_000 });
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

await openGroundPlan();
const levelId = await activeLevelId();
if (!levelId) throw new Error('Could not resolve active level id');
await setWallTool();

let box = await canvasBox();
const floorScreen = { x: box.x + box.width * 0.82, y: box.y + box.height * 0.68 };
const floorHud = await pointAt(floorScreen);
if (!floorHud) throw new Error('No floor HUD point');

const floorId = `wp44-pick-floor-${Date.now().toString(36)}`;
const floorEdgeY = floorHud.yMm;
await applyCommand({
  type: 'createFloor',
  id: floorId,
  name: 'WP44 Pick Edge Proof Floor',
  levelId,
  boundaryMm: [
    { xMm: floorHud.xMm - 3000, yMm: floorEdgeY },
    { xMm: floorHud.xMm + 3000, yMm: floorEdgeY },
    { xMm: floorHud.xMm + 3000, yMm: floorEdgeY + 2400 },
    { xMm: floorHud.xMm - 3000, yMm: floorEdgeY + 2400 },
  ],
  thicknessMm: 180,
  structureThicknessMm: 140,
  finishThicknessMm: 40,
});
await page.waitForFunction(
  (floorId) => Boolean(window.__bimStore.getState().elementsById[floorId]),
  floorId,
);
await setWallTool();
const floorPickScreen = await screenForWorld({ xMm: floorHud.xMm, yMm: floorEdgeY }, floorScreen);
await page.mouse.move(floorPickScreen.x, floorPickScreen.y);
await waitForPreview();
await screenshot('01-wall-tool-pick-floor-edge-preview.png');

const wallCountBeforeFloor = await stateEval(
  () =>
    Object.values(window.__bimStore.getState().elementsById).filter((e) => e.kind === 'wall')
      .length,
);
await page.mouse.click(floorPickScreen.x, floorPickScreen.y);
await page.waitForFunction(
  (count) =>
    Object.values(window.__bimStore.getState().elementsById).filter((e) => e.kind === 'wall')
      .length > count,
  wallCountBeforeFloor,
  { timeout: 10_000 },
);
await screenshot('02-wall-tool-pick-floor-edge-created.png');

await setWallTool();
await page.mouse.move(floorPickScreen.x, floorPickScreen.y);
await waitForPreview();
await page.mouse.click(floorPickScreen.x, floorPickScreen.y);
await page.waitForSelector('[data-testid="wall-draft-notice"]', { timeout: 5_000 });
await screenshot('03-wall-tool-pick-floor-edge-duplicate-blocked.png');

box = await canvasBox();
const dxfScreen = { x: box.x + box.width * 0.68, y: box.y + box.height * 0.82 };
const dxfHud = await pointAt(dxfScreen);
if (!dxfHud) throw new Error('No DXF HUD point');
const dxfId = `wp44-pick-dxf-${Date.now().toString(36)}`;
await applyCommand({
  type: 'createLinkDxf',
  id: dxfId,
  name: 'WP44 Pick Lines DXF',
  levelId,
  originMm: { xMm: dxfHud.xMm, yMm: dxfHud.yMm },
  originAlignmentMode: 'origin_to_origin',
  rotationDeg: 0,
  scaleFactor: 1,
  linework: [
    {
      kind: 'line',
      layerName: 'A-WALL-PICK',
      start: { xMm: -3200, yMm: 0 },
      end: { xMm: 3200, yMm: 0 },
    },
  ],
  dxfLayers: [{ name: 'A-WALL-PICK', color: '#2563eb', entityCount: 1 }],
  colorMode: 'custom',
  customColor: '#2563eb',
  overlayOpacity: 0.8,
  loaded: true,
});
await page.waitForFunction(
  (dxfId) => Boolean(window.__bimStore.getState().elementsById[dxfId]),
  dxfId,
);
await setWallTool();
// The DXF is created with its origin exactly under this sampled cursor point.
// Reusing the sampled screen coordinate avoids calibration drift after command hydration.
const dxfPickScreen = dxfScreen;
await page.mouse.move(dxfPickScreen.x, dxfPickScreen.y);
await waitForPreview();
await screenshot('04-wall-tool-pick-dxf-line-preview.png');

const wallCountBeforeDxf = await stateEval(
  () =>
    Object.values(window.__bimStore.getState().elementsById).filter((e) => e.kind === 'wall')
      .length,
);
await page.mouse.click(dxfPickScreen.x, dxfPickScreen.y);
await page.waitForFunction(
  (count) =>
    Object.values(window.__bimStore.getState().elementsById).filter((e) => e.kind === 'wall')
      .length > count,
  wallCountBeforeDxf,
  { timeout: 10_000 },
);
await screenshot('05-wall-tool-pick-dxf-line-created.png');

const summary = await stateEval(
  ({
    floorId,
    dxfId,
    wallCountBeforeFloor,
    wallCountBeforeDxf,
    navigations,
    consoleErrors,
    pageErrors,
  }) => {
    const state = window.__bimStore.getState();
    const walls = Object.values(state.elementsById).filter((e) => e.kind === 'wall');
    return {
      modelId: state.modelId,
      revision: state.revision,
      floorId,
      dxfId,
      floorEdgeWallCreated: walls.length > wallCountBeforeFloor,
      dxfLineWallCreated: walls.length > wallCountBeforeDxf,
      wallCountBeforeFloor,
      wallCountBeforeDxf,
      wallCountAfter: walls.length,
      duplicateNotice:
        document.querySelector('[data-testid="wall-draft-notice"]')?.textContent ?? '',
      activeTool: state.planTool,
      noMainFrameNavigationsAfterBoot: navigations.length <= 1,
      navigations,
      consoleErrors,
      pageErrors,
    };
  },
  {
    floorId,
    dxfId,
    wallCountBeforeFloor,
    wallCountBeforeDxf,
    navigations,
    consoleErrors,
    pageErrors,
  },
);
await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
