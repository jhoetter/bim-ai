import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = scriptDir;
const baseUrl = 'http://127.0.0.1:2000/#theme=light';
const modelId = '9bb9a145-d9ce-5a2f-a748-bb5be3301b30';
const proofPrefix = `wp44-${Date.now().toString(36)}`;
const floorId = `${proofPrefix}-floor`;
const roomId = `${proofPrefix}-room`;
const levelId = 'hf-lvl-ground';
const floorBoundary = [
  { xMm: 52000, yMm: 52000 },
  { xMm: 60000, yMm: 52000 },
  { xMm: 60000, yMm: 58000 },
  { xMm: 52000, yMm: 58000 },
];
const roomBoundary = [
  { xMm: 64000, yMm: 52000 },
  { xMm: 70000, yMm: 52000 },
  { xMm: 70000, yMm: 57000 },
  { xMm: 64000, yMm: 57000 },
];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
await context.addInitScript(() => {
  localStorage.setItem('bim.onboarding-completed', 'true');
  localStorage.removeItem('bim-ai:pane-layout-v1');
  localStorage.setItem(
    'bim-ai:tabs-v1',
    JSON.stringify({
      v: 1,
      tabs: [
        {
          id: '3d:vp-rear-axo',
          kind: '3d',
          targetId: 'vp-rear-axo',
          label: '3D · Rear/right axonometric',
        },
      ],
      activeId: '3d:vp-rear-axo',
    }),
  );
});
const page = await context.newPage();
const consoleWarningsAndErrors = [];
const pageErrors = [];
const mainFrameNavigations = [];
page.on('console', (msg) => {
  if (msg.type() === 'warning' || msg.type() === 'error') {
    const text = msg.text();
    if (!text.includes('favicon.ico')) consoleWarningsAndErrors.push({ type: msg.type(), text });
  }
});
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) mainFrameNavigations.push(frame.url());
});

async function waitForStoreReady() {
  await page.waitForFunction(
    () => {
      const store = window.__bimStore;
      if (!store) return false;
      const state = store.getState();
      return Boolean(state.modelId && Object.keys(state.elementsById ?? {}).length > 0);
    },
    null,
    { timeout: 20000 },
  );
}

async function waitForModelReady(expectedModelId) {
  await page.waitForFunction(
    (expectedModelId) => {
      const store = window.__bimStore;
      if (!store) return false;
      const state = store.getState();
      return state.modelId === expectedModelId && Object.keys(state.elementsById ?? {}).length > 0;
    },
    expectedModelId,
    { timeout: 20000 },
  );
}

async function applyCommandInPage(command) {
  return page.evaluate(
    async ({ command, modelId }) => {
      const store = window.__bimStore;
      if (!store) throw new Error('Missing __bimStore');
      const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'wp44-playwright',
          clientOpId: `wp44-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          command,
        }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      const data = await response.json();
      store.getState().hydrateFromSnapshot({
        modelId,
        revision: data.revision,
        elements: data.elements ?? {},
        violations: data.violations ?? [],
      });
      return data;
    },
    { command, modelId },
  );
}

async function selectElement(elementId) {
  await page.evaluate(
    ({ elementId, levelId }) => {
      const store = window.__bimStore;
      store.getState().select(elementId);
      store.getState().setActiveLevelId(levelId);
      store.getState().setPlanTool('select');
    },
    { elementId, levelId },
  );
}

async function wallIdsForPrefix(prefix) {
  return page.evaluate((prefix) => {
    const elements = window.__bimStore.getState().elementsById;
    return Object.values(elements)
      .filter((element) => element?.kind === 'wall' && String(element.id).startsWith(prefix))
      .map((element) => element.id)
      .sort();
  }, prefix);
}

async function elementCount(kind) {
  return page.evaluate((kind) => {
    const elements = window.__bimStore.getState().elementsById;
    return Object.values(elements).filter((element) => element?.kind === kind).length;
  }, kind);
}

async function boot() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForStoreReady();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  if ((await page.getByText('Skip tour').count()) > 0) {
    await page.getByText('Skip tour').click();
    await page.waitForTimeout(200);
  }
  await page.getByTestId('primary-project-selector').waitFor({ state: 'visible', timeout: 15000 });
  const activeProject = await page.getByTestId('primary-project-selector').innerText();
  if (!activeProject.includes('target-house-3')) {
    await page.getByTestId('primary-project-selector').click();
    await page.getByTestId('project-menu-seed-target-house-3').click();
    await page
      .getByTestId('primary-project-selector')
      .filter({ hasText: /target-house-3/ })
      .waitFor({ state: 'visible', timeout: 15000 });
  }
  await waitForModelReady(modelId);
  mainFrameNavigations.length = 0;
}

await boot();

await applyCommandInPage({
  type: 'createFloor',
  id: floorId,
  name: 'WP44 boundary wall proof floor',
  levelId,
  boundaryMm: floorBoundary,
  thicknessMm: 250,
});
await applyCommandInPage({
  type: 'createRoomOutline',
  id: roomId,
  name: 'WP44 boundary wall proof room',
  levelId,
  outlineMm: roomBoundary,
});

await selectElement(floorId);
await page
  .getByTestId('boundary-wall-preview-button')
  .waitFor({ state: 'visible', timeout: 10000 });
await page.getByTestId('boundary-wall-preview-button').click();
await page.getByTestId('boundary-wall-preview').waitFor({ state: 'visible', timeout: 5000 });
await expect(page.getByTestId('boundary-wall-preview-row-0')).toHaveAttribute(
  'data-status',
  'create',
);
await page.screenshot({
  path: path.join(outDir, '01-floor-boundary-wall-preview.png'),
  fullPage: true,
});

await page.getByTestId('boundary-wall-generate-commit').click();
await page.waitForFunction(
  (prefix) => {
    const elements = window.__bimStore.getState().elementsById;
    return (
      Object.values(elements).filter(
        (element) => element?.kind === 'wall' && String(element.id).startsWith(prefix),
      ).length === 4
    );
  },
  `wall-from-floor-${floorId}`,
  { timeout: 10000 },
);
await page.screenshot({
  path: path.join(outDir, '02-floor-boundary-walls-created.png'),
  fullPage: true,
});

await selectElement(floorId);
await page.getByTestId('boundary-wall-preview-button').click();
await page.getByTestId('boundary-wall-preview').waitFor({ state: 'visible', timeout: 5000 });
await expect(page.getByTestId('boundary-wall-preview-row-0')).toHaveAttribute(
  'data-status',
  'conflict',
);
await expect(page.getByTestId('boundary-wall-generate-commit')).toBeDisabled();
await page.screenshot({
  path: path.join(outDir, '03-duplicate-overlap-conflict-preview.png'),
  fullPage: true,
});

await selectElement(roomId);
await page.getByTestId('boundary-wall-preview-button').click();
await page.getByTestId('boundary-wall-preview').waitFor({ state: 'visible', timeout: 5000 });
await page.screenshot({
  path: path.join(outDir, '04-room-boundary-wall-preview.png'),
  fullPage: true,
});

const beforeDoorCount = await elementCount('door');
const beforeWindowCount = await elementCount('window');
const generatedWallIds = await wallIdsForPrefix(`wall-from-floor-${floorId}`);
if (generatedWallIds.length !== 4)
  throw new Error(`Expected 4 generated walls, got ${generatedWallIds.length}`);
await selectElement(generatedWallIds[0]);
await page.getByTestId('selected-wall-3d-actions').waitFor({ state: 'visible', timeout: 5000 });
await page.getByTestId('3d-action-insert-door').click();
await page.waitForFunction((count) => {
  const elements = window.__bimStore.getState().elementsById;
  return Object.values(elements).filter((element) => element?.kind === 'door').length === count + 1;
}, beforeDoorCount);
await selectElement(generatedWallIds[1]);
await page.getByTestId('selected-wall-3d-actions').waitFor({ state: 'visible', timeout: 5000 });
await page.getByTestId('3d-action-insert-window').click();
await page.waitForFunction((count) => {
  const elements = window.__bimStore.getState().elementsById;
  return (
    Object.values(elements).filter((element) => element?.kind === 'window').length === count + 1
  );
}, beforeWindowCount);
await page.screenshot({
  path: path.join(outDir, '05-generated-wall-hosted-door-window.png'),
  fullPage: true,
});

await selectElement(floorId);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
await page.getByTestId('cmd-palette-v3').waitFor({ state: 'visible', timeout: 5000 });
await page.getByLabel('Command palette search').fill('Create Walls from Boundary');
await page.getByTestId('palette-entry-generate.walls-from-boundary').waitFor({
  state: 'visible',
  timeout: 5000,
});
await page.screenshot({
  path: path.join(outDir, '06-cmd-k-boundary-wall-command.png'),
  fullPage: true,
});

const finalWallIds = await wallIdsForPrefix(`wall-from-floor-${floorId}`);
const activeProjectLabel = await page.getByTestId('primary-project-selector').innerText();
const summary = {
  modelId,
  activeProjectLabel,
  proofPrefix,
  floorId,
  roomId,
  generatedWallIds: finalWallIds,
  generatedWallCount: finalWallIds.length,
  doorInserted: (await elementCount('door')) === beforeDoorCount + 1,
  windowInserted: (await elementCount('window')) === beforeWindowCount + 1,
  noMainFrameNavigationsAfterBoot: mainFrameNavigations.length === 0,
  mainFrameNavigations,
  consoleWarningsAndErrors,
  pageErrors,
};
await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
