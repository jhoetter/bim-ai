import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const commands = [];

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
await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
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
await page.waitForTimeout(200);

const start = { x: box.x + box.width * 0.48, y: box.y + box.height * 0.42 };
const end = { x: box.x + box.width * 0.62, y: box.y + box.height * 0.58 };
await page.mouse.click(start.x, start.y);
await page.mouse.move(end.x, end.y, { steps: 12 });
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}01-front-elevation-preview.png`, fullPage: true });
await page.mouse.click(end.x, end.y);
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}02-front-elevation-after-commit.png`, fullPage: true });

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
  tracePhases: wallTrace.map((entry) => entry.phase),
  projectionModes: [...new Set(wallTrace.map((entry) => entry.projection?.mode).filter(Boolean))],
  firstTrace: wallTrace[0] ?? null,
  lastTrace: wallTrace.at(-1) ?? null,
  commands,
};

await fs.writeFile(`${outDir}trace.json`, JSON.stringify(wallTrace, null, 2));
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
