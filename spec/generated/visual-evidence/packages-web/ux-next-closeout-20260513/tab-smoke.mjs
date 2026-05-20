import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const base = 'http://127.0.0.1:2000/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1720, height: 1080 } });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.localStorage.setItem('bim.onboarding-completed', 'true');
});
const page = await context.newPage();

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="view-tabs"]');
await page.waitForTimeout(1200);

const initialTabCount = await page.locator('[data-testid^="tab-activate-"]').count();
await page.screenshot({ path: `${outDir}01-initial.png`, fullPage: true });

const rows = await page.locator('[data-testid^="left-rail-row-"]').all();
let planClicked = null;
for (const row of rows) {
  const text = ((await row.innerText()) || '').toLowerCase();
  if (text.includes('plan') && !text.includes('floor plans')) {
    await row.click();
    planClicked = text;
    break;
  }
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}02-after-plan-click.png`, fullPage: true });

const tabsAfterPlan = await page.locator('[data-testid^="tab-activate-"]').count();
const activePlanTab = await page
  .locator('[data-testid^="tab-badge-active-"]')
  .first()
  .getAttribute('data-testid')
  .catch(() => null);

const rowsAfter = await page.locator('[data-testid^="left-rail-row-"]').all();
let view3dClicked = null;
for (const row of rowsAfter) {
  const text = ((await row.innerText()) || '').toLowerCase();
  if (text.includes('axonometric') || text.includes('3d') || text.includes('elevation')) {
    await row.click();
    view3dClicked = text;
    break;
  }
}
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}03-after-3d-click.png`, fullPage: true });

const tabsAfter3d = await page.locator('[data-testid^="tab-activate-"]').count();
const active3dTab = await page
  .locator('[data-testid^="tab-badge-active-"]')
  .first()
  .getAttribute('data-testid')
  .catch(() => null);

const summary = {
  base,
  initialTabCount,
  tabsAfterPlan,
  tabsAfter3d,
  activePlanTab,
  active3dTab,
  planClicked,
  view3dClicked,
};

await fs.writeFile(`${outDir}summary.json`, JSON.stringify(summary, null, 2));
await browser.close();
console.log(JSON.stringify(summary, null, 2));
