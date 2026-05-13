import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 2000, height: 1400 } });
await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('bim.onboarding-completed', 'true');
});
const commands = [];
await context.route('**/api/models/*/commands', async (route) => {
  const body = route.request().postDataJSON?.() ?? null;
  commands.push(body?.command ?? null);
  await route.continue();
});

const page = await context.newPage();
await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]', { timeout: 30000 });
await page.waitForTimeout(1200);
await page.click('[data-testid="tab-add-button"]');
await page.click('[data-testid="tab-add-3d"]');
await page.waitForTimeout(1000);

const vp = page.locator('[data-testid="orbit-3d-viewport"]');
await vp.waitFor({ timeout: 30000 });
const box = await vp.boundingBox();
if (!box) throw new Error('no viewport');

// Force an edge-on/front-elevation-like camera for level-plane drafting.
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.55, { steps: 24 });
await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.08, { steps: 18 });
await page.mouse.up();
await page.waitForTimeout(400);

await page.click('[data-testid="ribbon-command-wall"]');
await page.waitForTimeout(200);

const start = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.52 };
const end = { x: box.x + box.width * 0.62, y: box.y + box.height * 0.58 };
await page.mouse.click(start.x, start.y);
await page.mouse.move(end.x, end.y, { steps: 8 });
await page.waitForTimeout(250);
const wallVolumePreviewVisible = (await page.locator('svg polygon').count()) > 0;
await page.screenshot({
  path: 'tmp/ux-wall-edgeon-repro-20260513/01-before-commit.png',
  fullPage: true,
});
await page.mouse.click(end.x, end.y);
await page.waitForTimeout(700);
await page.screenshot({
  path: 'tmp/ux-wall-edgeon-repro-20260513/02-after-commit-attempt.png',
  fullPage: true,
});

const summary = {
  createWallCount: commands.filter((c) => c?.type === 'createWall').length,
  commandTypes: commands.map((c) => c?.type ?? null),
  screenDrag: { start, end },
  wallVolumePreviewVisible,
  commands,
};
await fs.writeFile(
  'tmp/ux-wall-edgeon-repro-20260513/summary.json',
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));

await browser.close();
