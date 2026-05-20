import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const commands = [];
const consoleMessages = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 2000, height: 1400 } });
await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('bim.onboarding-completed', 'true');
  window.__BIM_AI_3D_WALL_DEBUG__ = [];
});
await context.route('**/api/models/*/commands', async (route) => {
  const body = route.request().postDataJSON?.() ?? null;
  commands.push(body?.command ?? null);
  await route.continue();
});

const page = await context.newPage();
page.on('console', (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text(),
  });
});

async function activate3dView(viewpointId) {
  await page.click(`[data-testid="left-rail-row-${viewpointId}"]`);
  await page.waitForTimeout(500);
  const tab = page.getByTestId(`tab-activate-3d:${viewpointId}`);
  if ((await tab.count()) > 0) await tab.first().click();
  await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function dragWall(box, start, end) {
  await page.click('[data-testid="ribbon-command-wall"]');
  await page.waitForTimeout(250);
  await page.mouse.move(box.x + box.width * start.x, box.y + box.height * start.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * end.x, box.y + box.height * end.y, { steps: 14 });
  await page.waitForTimeout(250);
}

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
await page.waitForTimeout(1200);

await page.click('[data-testid="primary-project-selector"]');
await page.click('[data-testid="project-menu-seed-target-house-3"]');
await page
  .locator('[data-testid="primary-project-selector"]', { hasText: 'target-house-3' })
  .waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);

await activate3dView('vp-front-elev');
let vp = page.locator('[data-testid="orbit-3d-viewport"]');
let box = await vp.boundingBox();
if (!box) throw new Error('no front 3D viewport');

await dragWall(box, { x: 0.58, y: 0.62 }, { x: 0.7, y: 0.66 });
await page.screenshot({ path: `${outDir}01-front-elevation-exact-preview.png`, fullPage: true });
const frontCursorPathVisible = await page.getByTestId('wall-cursor-path').isVisible();
const frontCursorEndVisible = await page.getByTestId('wall-cursor-end').isVisible();
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}02-front-elevation-exact-commit.png`, fullPage: true });
const commandsAfterFront = commands.filter((command) => command?.type === 'createWall').length;
const traceAfterFront = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await activate3dView('vp-roof-court');
vp = page.locator('[data-testid="orbit-3d-viewport"]');
box = await vp.boundingBox();
if (!box) throw new Error('no oblique 3D viewport');

await dragWall(box, { x: 0.34, y: 0.58 }, { x: 0.54, y: 0.62 });
await page.screenshot({ path: `${outDir}03-oblique-wall-preview.png`, fullPage: true });
const obliqueCursorPathVisible = await page.getByTestId('wall-cursor-path').isVisible();
const obliqueCursorEndVisible = await page.getByTestId('wall-cursor-end').isVisible();
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}04-oblique-wall-commit.png`, fullPage: true });

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.54);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.47, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}05-after-escape-navigation-drag.png`, fullPage: true });

const wallTrace = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);
const wallCommands = commands.filter((command) => command?.type === 'createWall');
const summary = {
  commandTypes: commands.map((command) => command?.type ?? null),
  commandsAfterFront,
  createWallCount: wallCommands.length,
  wallLengthsMm: wallCommands.map((command) =>
    Math.hypot(command.end.xMm - command.start.xMm, command.end.yMm - command.start.yMm),
  ),
  projectionModes: [...new Set(wallTrace.map((entry) => entry.projection?.mode).filter(Boolean))],
  frontProjectionModes: [
    ...new Set(traceAfterFront.map((entry) => entry.projection?.mode).filter(Boolean)),
  ],
  tracePhases: wallTrace.map((entry) => entry.phase),
  blockedUnreadablePlaneCount: wallTrace.filter(
    (entry) => entry.phase === 'wall-blocked-unreadable-plane',
  ).length,
  blockedNoDraftPlaneCount: wallTrace.filter(
    (entry) => entry.phase === 'wall-blocked-no-draft-plane',
  ).length,
  frontCursorPathVisible,
  frontCursorEndVisible,
  obliqueCursorPathVisible,
  obliqueCursorEndVisible,
  console3dWallCount: consoleMessages.filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .length,
  consoleSamples: consoleMessages
    .filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .slice(0, 4),
  firstTrace: wallTrace[0] ?? null,
  lastTrace: wallTrace.at(-1) ?? null,
};

await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
