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

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
await page.waitForTimeout(1200);

await page.click('[data-testid="primary-project-selector"]');
await page.click('[data-testid="project-menu-seed-target-house-3"]');
await page
  .locator('[data-testid="primary-project-selector"]', { hasText: 'target-house-3' })
  .waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);

await page.click('[data-testid="left-rail-row-vp-front-elev"]');
await page.waitForTimeout(500);
await page.click('[data-testid="tab-activate-3d:vp-front-elev"]');
await page.waitForTimeout(1800);

const vp = page.locator('[data-testid="orbit-3d-viewport"]');
await vp.waitFor({ timeout: 30000 });
const box = await vp.boundingBox();
if (!box) throw new Error('no 3D viewport');

await page.click('[data-testid="ribbon-command-wall"]');
await page.waitForTimeout(250);

const start = { x: box.x + box.width * 0.48, y: box.y + box.height * 0.42 };
const end = { x: box.x + box.width * 0.62, y: box.y + box.height * 0.58 };
await page.mouse.move(start.x, start.y);
await page.mouse.down();
await page.mouse.move(end.x, end.y, { steps: 14 });
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}01-drag-preview-console-debug.png`, fullPage: true });
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}02-drag-release-wall-commit.png`, fullPage: true });

await page.click('[data-testid="ribbon-command-wall"]');
await page.waitForTimeout(250);
await page.mouse.click(box.x + box.width * 0.12, box.y + box.height * 0.15);
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}03-sky-start-blocked.png`, fullPage: true });

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.54);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.47, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}04-after-escape-navigation-drag.png`, fullPage: true });

const wallTrace = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);
const wallCommand = commands.find((command) => command?.type === 'createWall') ?? null;
const wallLengthMm = wallCommand
  ? Math.hypot(
      wallCommand.end.xMm - wallCommand.start.xMm,
      wallCommand.end.yMm - wallCommand.start.yMm,
    )
  : null;
const summary = {
  commandTypes: commands.map((command) => command?.type ?? null),
  createWallCount: commands.filter((command) => command?.type === 'createWall').length,
  wallLengthMm,
  projectionModes: [...new Set(wallTrace.map((entry) => entry.projection?.mode).filter(Boolean))],
  tracePhases: wallTrace.map((entry) => entry.phase),
  blockedNoVisibleAnchorCount: wallTrace.filter(
    (entry) => entry.phase === 'wall-blocked-no-visible-anchor',
  ).length,
  blockedNoDraftPlaneCount: wallTrace.filter(
    (entry) => entry.phase === 'wall-blocked-no-draft-plane',
  ).length,
  console3dWallCount: consoleMessages.filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .length,
  consoleSamples: consoleMessages
    .filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .slice(0, 3),
  firstTrace: wallTrace[0] ?? null,
  lastTrace: wallTrace.at(-1) ?? null,
};

await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
