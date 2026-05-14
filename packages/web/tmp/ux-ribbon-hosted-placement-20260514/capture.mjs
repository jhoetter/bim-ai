import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = 'packages/web/tmp/ux-ribbon-hosted-placement-20260514';
mkdirSync(outDir, { recursive: true });

const commands = [];
const responses = [];
const consoleErrors = [];
const navigations = [];
let trackActionNavigations = false;
const screenshots = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shot = async (page, name) => {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
  return path;
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1800, height: 1200 },
  deviceScaleFactor: 1,
});
await page.addInitScript(() => {
  localStorage.setItem('bim.onboarding-completed', 'true');
});
page.on('framenavigated', (frame) => {
  if (trackActionNavigations && frame === page.mainFrame()) navigations.push(frame.url());
});
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/commands')) {
    commands.push({ url: req.url(), body: req.postDataJSON?.() });
  }
});
page.on('response', async (res) => {
  if (res.url().includes('/commands')) {
    responses.push({
      url: res.url(),
      status: res.status(),
      body: await res.text().catch(() => ''),
    });
  }
});

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
await sleep(1400);
await page.getByTestId('left-rail-row-vp-rear-axo').click();
await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 10000 });
await sleep(1600);
await shot(page, '00-rear-axo-ready');
trackActionNavigations = true;

await page.getByRole('tab', { name: 'Insert' }).click();
await page.getByTestId('ribbon-command-family-library').click();
await page.getByTestId('family-library-panel').waitFor({ timeout: 5000 });
await page.getByLabel('Search families').fill('window');
await sleep(250);
await shot(page, '01-load-family-window-filter');
const firstPlace = page
  .locator('[data-testid^="family-row-"]')
  .filter({ hasText: /window/i })
  .getByRole('button', { name: 'Place' })
  .first();
await firstPlace.click();
await sleep(500);
await page.getByRole('tab', { name: 'Model' }).click();
await sleep(100);
const activeRibbonAfterFamily = await page
  .getByTestId('ribbon-command-window')
  .getAttribute('aria-pressed');

const vp = await page.getByTestId('orbit-3d-viewport').boundingBox();
if (!vp) throw new Error('missing 3D viewport bounds');
const point = (rx, ry) => ({ x: vp.x + vp.width * rx, y: vp.y + vp.height * ry });

// Occupied span on the front facade: should preview red and send no command.
const invalid = point(0.62, 0.67);
await page.mouse.move(invalid.x, invalid.y);
await sleep(400);
await shot(page, '02-window-occupied-span-invalid-preview');
const commandCountBeforeInvalidClick = commands.length;
await page.mouse.click(invalid.x, invalid.y);
await sleep(900);
await shot(page, '03-window-occupied-span-click-blocked');
const commandCountAfterInvalidClick = commands.length;
const invalidHudText = await page
  .locator('text=This wall span already contains')
  .first()
  .textContent()
  .catch(() => null);

// Valid free span on the existing side wall: should stay blue and commit.
await page.getByRole('tab', { name: 'Model' }).click();
await page.getByTestId('ribbon-command-window').click();
await sleep(250);
const host = point(0.26, 0.742);
await page.mouse.move(host.x, host.y);
await sleep(550);
await shot(page, '04-side-wall-window-valid-preview');
await page.mouse.click(host.x, host.y);
await sleep(2200);
await shot(page, '05-side-wall-window-placed');

const responseStatuses = responses.map((res) => res.status);
const commandTypes = commands
  .map(
    (entry) =>
      entry.body?.type ?? entry.body?.command?.type ?? entry.body?.commands?.[0]?.type ?? null,
  )
  .filter(Boolean);
const summary = {
  activeRibbonAfterFamily,
  commandCountBeforeInvalidClick,
  commandCountAfterInvalidClick,
  invalidClickSentCommand: commandCountAfterInvalidClick !== commandCountBeforeInvalidClick,
  invalidHudText,
  commandTypes,
  responseStatuses,
  commandBodies: commands.map((entry) => entry.body),
  mainFrameNavigations: navigations.length,
  mainFrameNavigationUrls: navigations,
  consoleErrors,
  screenshots,
};
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
