import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const commands = [];
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

async function activate3dView(viewpointId) {
  await page.click(`[data-testid="left-rail-row-${viewpointId}"]`);
  await page.waitForTimeout(500);
  const tab = page.getByTestId(`tab-activate-3d:${viewpointId}`);
  if ((await tab.count()) > 0) await tab.first().click();
  await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function dragWall(label, box, start, end) {
  await page.click('[data-testid="ribbon-command-wall"]');
  await page.waitForTimeout(250);
  const sx = box.x + box.width * start.x;
  const sy = box.y + box.height * start.y;
  const ex = box.x + box.width * end.x;
  const ey = box.y + box.height * end.y;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 16 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}${label}-preview.png`, fullPage: true });
  previewChecks.push({
    label,
    cursorPathVisible: await page.getByTestId('wall-cursor-path').isVisible(),
    cursorEndVisible: await page.getByTestId('wall-cursor-end').isVisible(),
  });
  await page.mouse.up();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}${label}-commit.png`, fullPage: true });
  await page.keyboard.press('Escape');
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
const vp = page.locator('[data-testid="orbit-3d-viewport"]');
const box = await vp.boundingBox();
if (!box) throw new Error('no 3D viewport');

await dragWall('01-left-edge-diagonal', box, { x: 0.035, y: 0.52 }, { x: 0.14, y: 0.61 });
await dragWall('02-left-edge-steep', box, { x: 0.045, y: 0.61 }, { x: 0.085, y: 0.68 });

const wallTrace = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);
const wallCommands = commands.filter((command) => command?.type === 'createWall');
const commits = wallTrace.filter((entry) => entry.phase === 'wall-commit');
const summary = {
  commandTypes: commands.map((command) => command?.type ?? null),
  createWallCount: wallCommands.length,
  projectionModes: [...new Set(wallTrace.map((entry) => entry.projection?.mode).filter(Boolean))],
  starts: wallTrace.filter((entry) => entry.phase === 'wall-start'),
  commits,
  previewChecks,
  wallVectors: wallCommands.map((command) => ({
    dxMm: command.end.xMm - command.start.xMm,
    dyMm: command.end.yMm - command.start.yMm,
    lengthMm: Math.hypot(command.end.xMm - command.start.xMm, command.end.yMm - command.start.yMm),
  })),
  console3dWallCount: consoleMessages.filter((entry) => entry.text.includes('[bim:3d-wall]'))
    .length,
};
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
