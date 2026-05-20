import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = scriptDir;
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1365 } });
const baseUrl = 'http://127.0.0.1:2000/';

async function seed3dTab() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem(
      'bim-ai:tabs-v1',
      JSON.stringify({
        v: 1,
        tabs: [
          {
            id: '3d:vp-main-iso',
            kind: '3d',
            label: '3D Main front-left',
            targetId: 'vp-main-iso',
          },
        ],
        activeId: '3d:vp-main-iso',
      }),
    );
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
}

await seed3dTab();
await page.getByTestId('ribbon-tab-create').click();
await page.screenshot({ path: path.join(outDir, '01-3d-ribbon-model-tools.png'), fullPage: true });

const modelToolsPresent =
  (await page.getByTestId('ribbon-command-wall').count()) > 0 &&
  (await page.getByTestId('ribbon-command-floor').count()) > 0 &&
  (await page.getByTestId('ribbon-command-roof').count()) > 0 &&
  (await page.getByTestId('ribbon-command-ceiling').count()) > 0 &&
  (await page.getByTestId('ribbon-command-door').count()) > 0;

const bridgeBadgePlanPresent = (await page.getByTestId('ribbon-bridge-wall').count()) > 0;

await page.getByTestId('ribbon-command-wall').click();
await page.waitForTimeout(100);
await page.screenshot({
  path: path.join(outDir, '02-3d-wall-bridges-to-plan.png'),
  fullPage: true,
});

const modeIdentity = await page.getByTestId('ribbon-mode-identity').innerText();
const wallPressed = await page
  .getByTestId('ribbon-command-wall')
  .evaluate((el) => el.getAttribute('aria-pressed'));

await fs.writeFile(
  path.join(outDir, 'summary.json'),
  JSON.stringify(
    {
      modelToolsPresent,
      bridgeBadgePlanPresent,
      modeIdentityAfterWallClick: modeIdentity,
      wallPressedAfterBridge: wallPressed,
    },
    null,
    2,
  ),
);

await browser.close();
