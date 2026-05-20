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

let createWallCommandCount = 0;

page.on('request', (req) => {
  if (req.method() !== 'POST') return;
  if (!req.url().includes('/api/models/') || !req.url().includes('/commands')) return;
  const body = req.postData();
  if (!body) return;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.command?.type === 'createWall') createWallCommandCount += 1;
  } catch {
    // ignore malformed payloads
  }
});

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
await page.getByTestId('ribbon-command-wall').click();
await page.waitForTimeout(120);
await page.screenshot({
  path: path.join(outDir, '01-3d-wall-pick-start-prompt.png'),
  fullPage: true,
});

const viewport = page.getByTestId('orbit-3d-viewport');
const box = await viewport.boundingBox();
if (!box) throw new Error('3D viewport bounding box missing');

const startX = box.x + box.width * 0.36;
const startY = box.y + box.height * 0.57;
const previewX = box.x + box.width * 0.53;
const previewY = box.y + box.height * 0.63;

await page.mouse.click(startX, startY);
await page.mouse.move(previewX, previewY);
await page.waitForTimeout(80);
await page.screenshot({
  path: path.join(outDir, '02-3d-wall-pick-end-preview.png'),
  fullPage: true,
});

await page.mouse.click(previewX, previewY);
await page.waitForTimeout(600);
await page.screenshot({
  path: path.join(outDir, '03-3d-wall-commit-stays-3d.png'),
  fullPage: true,
});

const modeIdentity = await page.getByTestId('ribbon-mode-identity').innerText();
const promptText = await page.locator('text=Wall placement').first().innerText();
const startPromptVisible =
  (await page.locator('text=Click start point. Alt+drag or middle mouse to orbit/pan.').count()) >
  0;

await fs.writeFile(
  path.join(outDir, 'summary.json'),
  JSON.stringify(
    {
      modeIdentity,
      promptText,
      startPromptVisible,
      createWallCommandCount,
    },
    null,
    2,
  ),
);

await browser.close();
