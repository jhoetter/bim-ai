import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const commands = [];
const commandResponses = [];
const consoleMessages = [];

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
page.on('console', (message) =>
  consoleMessages.push({ type: message.type(), text: message.text() }),
);
page.on('response', async (response) => {
  if (!response.url().includes('/commands')) return;
  commandResponses.push({ status: response.status(), ok: response.ok() });
});

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
await page.click('[data-testid="primary-project-selector"]');
await page.click('[data-testid="project-menu-seed-target-house-3"]');
await page
  .locator('[data-testid="primary-project-selector"]', { hasText: 'target-house-3' })
  .waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);
await page.click('[data-testid="left-rail-row-vp-rear-axo"]');
await page.waitForTimeout(700);
const rearTab = page.getByTestId('tab-activate-3d:vp-rear-axo');
if ((await rearTab.count()) > 0) await rearTab.first().click();
await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}01-rear-axo-initial.png`, fullPage: true });

await page.getByTestId('ribbon-command-wall').click();
await page.waitForTimeout(300);
const box = await page.getByTestId('orbit-3d-viewport').boundingBox();
if (!box) throw new Error('no 3D viewport');
const start = { x: box.x + box.width * 0.085, y: box.y + box.height * 0.72 };
const end = { x: box.x + box.width * 0.285, y: box.y + box.height * 0.81 };
await page.mouse.click(start.x, start.y);
await page.mouse.move(end.x, end.y, { steps: 28 });
await page.waitForTimeout(500);
const cursorPathVisible = await page.getByTestId('wall-cursor-path').isVisible();
const cursorEndVisible = await page.getByTestId('wall-cursor-end').isVisible();
await page.screenshot({ path: `${outDir}02-diagonal-wall-preview.png`, fullPage: true });
await page.mouse.click(end.x, end.y);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}03-diagonal-wall-commit.png`, fullPage: true });

const trace = await page.evaluate(() => window.__BIM_AI_3D_WALL_DEBUG__ ?? []);
const wallCommands = commands.filter((command) => command?.type === 'createWall');
const commits = trace.filter((entry) => entry.phase === 'wall-commit');
const previews = trace.filter((entry) => entry.phase === 'wall-preview');
const summary = {
  health: await fetch('http://127.0.0.1:8500/api/health').then((r) => ({
    ok: r.ok,
    status: r.status,
  })),
  commandResponses,
  createWallCount: wallCommands.length,
  previewCount: previews.length,
  previewMeshCount: previews.filter((entry) => entry.previewMesh === true).length,
  commitCount: commits.length,
  cursorPathVisible,
  cursorEndVisible,
  consoleErrors: consoleMessages.filter((entry) => entry.type === 'error'),
  wallVectors: wallCommands.map((command) => ({
    start: command.start,
    end: command.end,
    dxMm: command.end.xMm - command.start.xMm,
    dyMm: command.end.yMm - command.start.yMm,
    lengthMm: Math.hypot(command.end.xMm - command.start.xMm, command.end.yMm - command.start.yMm),
    locationLine: command.locationLine,
  })),
  commitDeltas: commits.map((entry) => ({
    screenDelta: entry.screenDelta,
    modelDelta: entry.modelDelta,
    lengthMm: entry.lengthMm,
    projectionMode: entry.projection?.mode,
  })),
};
await fs.writeFile(`${outDir}trace.json`, JSON.stringify(trace, null, 2));
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
