import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url);
const summary = {};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } });
await page.addInitScript(() => {
  window.localStorage.setItem('bim.onboarding-completed', 'true');
});

try {
  await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="workspace-header"]', { timeout: 20000 });

  // Ensure a plan tab is active then activate ceiling from ribbon.
  const planTab = page.locator('[data-testid="tab-plan"]');
  if (await planTab.count()) {
    await planTab.first().click();
  }
  const ribbonCreate = page.locator('[data-testid="ribbon-tab-create"]');
  if (await ribbonCreate.count()) await ribbonCreate.click();

  const ceilingButton = page.locator('[data-testid="ribbon-command-ceiling"]');
  await ceilingButton.click();
  summary.ceilingPressed = (await ceilingButton.getAttribute('aria-pressed')) === 'true';
  await page.screenshot({
    path: new URL('01-ribbon-ceiling-active.png', outDir).pathname,
    fullPage: true,
  });

  const primaryLens = page.locator(
    '[data-testid="primary-lens-dropdown"] [data-testid="lens-dropdown-trigger"]',
  );
  await primaryLens.click();
  const lensMenu = page.locator('[data-testid="lens-menu"]');
  await lensMenu.waitFor({ state: 'visible' });

  const menuBox = await lensMenu.boundingBox();
  const sidebarBox = await page.locator('[data-testid="app-shell-primary-sidebar"]').boundingBox();
  summary.lensMenuVisible = Boolean(menuBox);
  summary.lensMenuNotClippedTop = Boolean(menuBox && menuBox.y >= 0);
  summary.lensMenuWithinSidebarBand = Boolean(
    menuBox && sidebarBox && menuBox.x >= sidebarBox.x - 2,
  );

  await page.screenshot({
    path: new URL('02-primary-lens-dropdown-open.png', outDir).pathname,
    fullPage: true,
  });

  const secondaryLensCount = await page.locator('[data-testid="secondary-lens-filter"]').count();
  summary.secondaryLensAbsent = secondaryLensCount === 0;
  await page.screenshot({
    path: new URL('03-secondary-no-lens-block.png', outDir).pathname,
    fullPage: true,
  });

  await fs.writeFile(new URL('summary.json', outDir), JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
