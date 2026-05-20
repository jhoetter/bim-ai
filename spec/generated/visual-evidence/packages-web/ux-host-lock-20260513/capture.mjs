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
  const body = route.request().postDataJSON?.() ?? null;
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

await page.click('[data-testid="ribbon-command-door"]');
const xA = box.x + box.width * 0.62;
const yA = box.y + box.height * 0.64;
const xB = box.x + box.width * 0.46;
const yB = box.y + box.height * 0.57;

await page.mouse.move(xA, yA);
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}01-host-preview-unlocked.png`, fullPage: true });

await page.keyboard.press('l');
await page.waitForTimeout(200);
await page.screenshot({ path: `${outDir}02-host-preview-locked.png`, fullPage: true });

await page.mouse.click(xA, yA);
await page.waitForTimeout(120);
await page.mouse.click(xA, yA);
await page.waitForTimeout(600);

await page.mouse.move(xB, yB);
await page.waitForTimeout(250);
await page.mouse.click(xB, yB);
await page.waitForTimeout(350);

const countAfterLockedAttempt = commands.length;

await page.keyboard.press('l');
await page.waitForTimeout(150);
await page.mouse.click(xB, yB);
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}03-host-unlocked-second-place.png`, fullPage: true });

const summary = {
  commandCount: commands.length,
  countAfterLockedAttempt,
  commandTypes: commands.map((c) => c?.type ?? null),
  commands,
};
await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await browser.close();
