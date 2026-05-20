import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const commands = [];
const commandResponses = [];
const consoleMessages = [];
const previewChecks = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 2000, height: 1400 } });

await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('bim.onboarding-completed', 'true');
  localStorage.setItem('bim.debug.3dWall', 'true');
  window.__BIM_AI_3D_WALL_DEBUG__ = [];
});

await context.route('**/api/models/*/commands', async (route) => {
  const body = route.request().postDataJSON?.() ?? null;
  commands.push(body?.command ?? null);
  await route.continue();
});

const page = await context.newPage();
page.on('console', (message) => {
  consoleMessages.push({ type: message.type(), text: message.text() });
});
page.on('response', async (response) => {
  if (!response.url().includes('/commands')) return;
  const entry = { status: response.status(), ok: response.ok() };
  if (!response.ok()) {
    try {
      entry.body = await response.text();
    } catch {
      entry.body = '<unreadable>';
    }
  }
  commandResponses.push(entry);
});

async function selectSeedProject() {
  await page.click('[data-testid="primary-project-selector"]');
  await page.click('[data-testid="project-menu-seed-target-house-3"]');
  await page
    .locator('[data-testid="primary-project-selector"]', { hasText: 'target-house-3' })
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function activate3dView(viewpointId) {
  await page.click(`[data-testid="left-rail-row-${viewpointId}"]`);
  await page.waitForTimeout(500);
  const tab = page.getByTestId(`tab-activate-3d:${viewpointId}`);
  if ((await tab.count()) > 0) await tab.first().click();
  await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function rotateViewCube(label) {
  const cube = await page.getByTestId('view-cube-stage').boundingBox();
  if (!cube) throw new Error('no ViewCube stage');
  await page.mouse.move(cube.x + cube.width * 0.6, cube.y + cube.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(cube.x + cube.width * 0.22, cube.y + cube.height * 0.68, { steps: 14 });
  await page.mouse.move(cube.x + cube.width * 0.76, cube.y + cube.height * 0.58, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}${label}.png`, fullPage: true });
}

async function placeWallWithPreview(label, box, start, end) {
  await page.getByTestId('ribbon-command-wall').click();
  await page.waitForTimeout(250);
  const sx = box.x + box.width * start.x;
  const sy = box.y + box.height * start.y;
  const ex = box.x + box.width * end.x;
  const ey = box.y + box.height * end.y;
  const beforeCommands = commands.length;
  await page.mouse.click(sx, sy);
  await page.mouse.move(ex, ey, { steps: 18 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}${label}-preview.png`, fullPage: true });
  const cursorPath = page.getByTestId('wall-cursor-path');
  const cursorEnd = page.getByTestId('wall-cursor-end');
  const previewTrace = await page.evaluate(() =>
    (window.__BIM_AI_3D_WALL_DEBUG__ ?? []).filter((entry) => entry.phase === 'wall-preview'),
  );
  previewChecks.push({
    label,
    cursorPathRendered: (await cursorPath.count()) > 0,
    cursorPathVisible: (await cursorPath.count()) > 0 ? await cursorPath.isVisible() : false,
    cursorEndVisible: (await cursorEnd.count()) > 0 ? await cursorEnd.isVisible() : false,
    previewMeshTraceCount: previewTrace.filter((entry) => entry.previewMesh === true).length,
    commandsBeforeCommit: commands.length - beforeCommands,
  });
  await page.mouse.click(ex, ey);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}${label}-commit.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
await page.waitForTimeout(1200);
await selectSeedProject();

await activate3dView('vp-front-elev');
await page.screenshot({ path: `${outDir}01-front-elevation-initial.png`, fullPage: true });

const viewport = page.locator('[data-testid="orbit-3d-viewport"]');
const box = await viewport.boundingBox();
if (!box) throw new Error('no 3D viewport');

await placeWallWithPreview(
  '02-front-grid-mesh-preview',
  box,
  { x: 0.1, y: 0.76 },
  { x: 0.26, y: 0.76 },
);
await rotateViewCube('03-after-viewcube-rotate');
await placeWallWithPreview(
  '04-rotated-grid-mesh-preview',
  box,
  { x: 0.08, y: 0.66 },
  { x: 0.22, y: 0.74 },
);

await page.keyboard.press('Escape');
await page.waitForTimeout(250);
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.74, box.y + box.height * 0.48, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}05-after-escape-navigation-drag.png`, fullPage: true });

const wallTrace = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);
const wallCommands = commands.filter((command) => command?.type === 'createWall');
const commits = wallTrace.filter((entry) => entry.phase === 'wall-commit');
const previews = wallTrace.filter((entry) => entry.phase === 'wall-preview');
const summary = {
  commandTypes: commands.map((command) => command?.type ?? null),
  commandResponses,
  createWallCount: wallCommands.length,
  previewChecks,
  previewMeshCount: previews.filter((entry) => entry.previewMesh === true).length,
  previewCount: previews.length,
  commitCount: commits.length,
  projectionModes: [...new Set(wallTrace.map((entry) => entry.projection?.mode).filter(Boolean))],
  wallVectors: wallCommands.map((command) => ({
    start: command.start,
    end: command.end,
    locationLine: command.locationLine,
    dxMm: command.end.xMm - command.start.xMm,
    dyMm: command.end.yMm - command.start.yMm,
    lengthMm: Math.hypot(command.end.xMm - command.start.xMm, command.end.yMm - command.start.yMm),
  })),
  commitDeltas: commits.map((entry) => ({
    screenDelta: entry.screenDelta,
    modelDelta: entry.modelDelta,
    lengthMm: entry.lengthMm,
  })),
  tracePhases: wallTrace.map((entry) => entry.phase),
  console3dWallCount: consoleMessages.filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .length,
  consoleWarnings: consoleMessages.filter((entry) => ['warning', 'error'].includes(entry.type)),
};

await fs.writeFile(`${outDir}trace.json`, JSON.stringify(wallTrace, null, 2));
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
