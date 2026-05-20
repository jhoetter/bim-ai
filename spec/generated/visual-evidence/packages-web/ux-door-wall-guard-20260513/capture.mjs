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

await page.screenshot({ path: `${outDir}01-before.png`, fullPage: true });

await page.click('[data-testid="ribbon-command-door"]');
const doorX = box.x + box.width * 0.62;
const doorY = box.y + box.height * 0.64;
await page.mouse.click(doorX, doorY);
await page.waitForTimeout(120);
await page.mouse.click(doorX, doorY);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}02-after-door-double-click.png`, fullPage: true });

await page.click('[data-testid="ribbon-command-wall"]');
await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.62);
await page.waitForTimeout(240);
await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.62);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}03-after-wall-segment.png`, fullPage: true });

const summary = {
  commandCount: commands.length,
  commandTypes: commands.map((c) => c?.type ?? null),
  commands,
};
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
