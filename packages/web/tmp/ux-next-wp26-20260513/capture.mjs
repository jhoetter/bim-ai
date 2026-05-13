import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(scriptDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1365 } });
const baseUrl = 'http://127.0.0.1:2000/';

const commandCounts = {
  createFloor: 0,
  createRoof: 0,
  createSlabOpening: 0,
  createStair: 0,
  createRailing: 0,
  createGridLine: 0,
  createReferencePlane: 0,
};

page.on('request', (req) => {
  if (req.method() !== 'POST') return;
  if (!req.url().includes('/api/models/') || !req.url().includes('/commands')) return;
  const body = req.postData();
  if (!body) return;
  try {
    const parsed = JSON.parse(body);
    const type = parsed?.command?.type;
    if (type && Object.prototype.hasOwnProperty.call(commandCounts, type)) {
      commandCounts[type] += 1;
    }
  } catch {
    // ignore
  }
});

async function seed3dTab() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem('bim.onboarding-tour-v2-dismissed', 'true');
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

async function clickCreateTool(id) {
  await page.getByTestId('ribbon-tab-create').click();
  await page.getByTestId(`ribbon-command-${id}`).click();
  await page.waitForTimeout(120);
}

async function clickAnnotateTool(id) {
  await page.getByTestId('ribbon-tab-annotate').click();
  await page.getByTestId(`ribbon-command-${id}`).click();
  await page.waitForTimeout(120);
}

await seed3dTab();

const viewport = page.getByTestId('orbit-3d-viewport');
const box = await viewport.boundingBox();
if (!box) throw new Error('Viewport bounding box missing');

const x1 = box.x + box.width * 0.4;
const x2 = box.x + box.width * 0.5;
const x3 = box.x + box.width * 0.58;
const y1 = box.y + box.height * 0.53;
const y2 = box.y + box.height * 0.61;
const y3 = box.y + box.height * 0.67;

await clickCreateTool('floor');
await page.mouse.click(x1, y1);
await page.mouse.click(x2, y1);
await page.mouse.click(x2, y2);
await page.mouse.move(x1, y1);
await page.waitForTimeout(80);
await page.screenshot({
  path: path.join(scriptDir, '01-3d-floor-boundary-preview.png'),
  fullPage: true,
});
await page.mouse.click(x1, y1);
await page.waitForTimeout(200);

await clickCreateTool('roof');
await page.mouse.click(x1, y1 - 90);
await page.mouse.click(x2, y1 - 90);
await page.mouse.click(x2, y2 - 90);
await page.mouse.move(x1, y1 - 90);
await page.waitForTimeout(80);
await page.screenshot({
  path: path.join(scriptDir, '02-3d-roof-footprint-preview.png'),
  fullPage: true,
});
await page.mouse.click(x1, y1 - 90);
await page.waitForTimeout(220);

await clickCreateTool('shaft');
await page.mouse.click(x2 - 30, y2 - 20);
await page.mouse.click(x2 + 35, y2 - 20);
await page.mouse.click(x2 + 35, y2 + 35);
await page.mouse.move(x2 - 30, y2 - 20);
await page.waitForTimeout(70);
await page.screenshot({ path: path.join(scriptDir, '03-3d-shaft-preview.png'), fullPage: true });
await page.mouse.click(x2 - 30, y2 - 20);
await page.waitForTimeout(220);

await clickCreateTool('stair');
await page.mouse.click(x1 + 10, y3 - 30);
await page.mouse.move(x3, y3 + 35);
await page.waitForTimeout(80);
await page.screenshot({
  path: path.join(scriptDir, '04-3d-stair-run-preview.png'),
  fullPage: true,
});
await page.mouse.click(x3, y3 + 35);
await page.waitForTimeout(220);

await clickCreateTool('railing');
await page.mouse.click(x1 - 40, y3 - 30);
await page.mouse.move(x3 - 70, y3 + 50);
await page.waitForTimeout(80);
await page.screenshot({
  path: path.join(scriptDir, '05-3d-railing-path-preview.png'),
  fullPage: true,
});
await page.mouse.click(x3 - 70, y3 + 50);
await page.waitForTimeout(220);

await clickAnnotateTool('grid');
await page.mouse.click(x1 - 120, y1 - 90);
await page.mouse.move(x3 + 20, y1 - 90);
await page.waitForTimeout(70);
await page.screenshot({
  path: path.join(scriptDir, '06-3d-grid-reference-preview.png'),
  fullPage: true,
});
await page.mouse.click(x3 + 20, y1 - 90);
await page.waitForTimeout(150);

await clickAnnotateTool('reference-plane');
await page.mouse.click(x1 - 120, y1 - 40);
await page.mouse.click(x3 + 20, y1 - 40);
await page.waitForTimeout(220);
await page.screenshot({
  path: path.join(scriptDir, '07-3d-reference-plane-placed.png'),
  fullPage: true,
});

await page.getByTestId('ribbon-tab-create').click();
const bridgeBadgeMissing = {
  floorBridgeBadgeMissing:
    (await page.locator('[data-testid="ribbon-bridge-floor"]').count()) === 0,
  roofBridgeBadgeMissing: (await page.locator('[data-testid="ribbon-bridge-roof"]').count()) === 0,
  shaftBridgeBadgeMissing:
    (await page.locator('[data-testid="ribbon-bridge-shaft"]').count()) === 0,
  stairBridgeBadgeMissing:
    (await page.locator('[data-testid="ribbon-bridge-stair"]').count()) === 0,
  railingBridgeBadgeMissing:
    (await page.locator('[data-testid="ribbon-bridge-railing"]').count()) === 0,
};

const modeIdentity = await page.getByTestId('ribbon-mode-identity').innerText();

await fs.writeFile(
  path.join(scriptDir, 'summary.json'),
  JSON.stringify(
    {
      modeIdentity,
      commandCounts,
      ...bridgeBadgeMissing,
    },
    null,
    2,
  ),
);

await browser.close();
