import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:2000/';
const outDir = new URL('./', import.meta.url).pathname;
const commands = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1720, height: 1080 } });
await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('bim.onboarding-completed', 'true');
});
await context.route('**/api/models/*/commands', async (route) => {
  const req = route.request();
  const body = req.postDataJSON?.() ?? null;
  commands.push(body?.command ?? null);
  await route.continue();
});

const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]');
await page.waitForTimeout(1400);

await page.click('[data-testid="tab-add-button"]');
await page.waitForSelector('[data-testid="tab-add-popover"]');
await page.click('[data-testid="tab-add-3d"]');
await page.waitForTimeout(1200);

const vp = page.locator('[data-testid="orbit-3d-viewport"]');
await vp.waitFor({ timeout: 30000 });
const box = await vp.boundingBox();
if (!box) throw new Error('no viewport');

await page.click('[data-testid="ribbon-command-wall"]');
const sx = box.x + box.width * 0.36;
const sy = box.y + box.height * 0.60;
const ex = box.x + box.width * 0.52;
const ey = box.y + box.height * 0.58;
await page.mouse.click(sx, sy);
await page.mouse.move(ex, ey);
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}01-wall-preview-default.png`, fullPage: true });

await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.mouse.move(ex + 8, ey + 2);
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}02-wall-preview-flipped.png`, fullPage: true });

await page.mouse.click(ex, ey);
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}03-wall-after-commit.png`, fullPage: true });

const summary = {
  commandCount: commands.length,
  commandTypes: commands.map((c) => c?.type ?? null),
  commands,
};
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
