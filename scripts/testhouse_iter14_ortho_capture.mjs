#!/usr/bin/env node
// Iter-14 step 1b — capture pipeline using orthographic-style 3D viewpoints
// instead of the wireframe-stub elevation views (methodology #13 fix).
//
// Loads `?modelId=<id>&activeViewpoint=view-3d-ortho-<dir>` per house+direction.
// Output: tmp/reverse-bim/iter-14-captures/{house}-ortho-{dir}-{crop,full}.png
// Plus the default 3D capture as `{house}-3d-{crop,full}.png` for compatibility
// with prior scoring scripts.

import { chromium } from '/home/jhoetter/repos/bim-ai/node_modules/.pnpm/playwright@1.55.1/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tmp/reverse-bim/iter-14-captures');

const HOUSES = ['alpha', 'beta', 'gamma'];
const VIEWS = [
  { key: '3d', viewpointId: null },
  { key: 'ortho-north', viewpointId: 'view-3d-ortho-north' },
  { key: 'ortho-east', viewpointId: 'view-3d-ortho-east' },
  { key: 'ortho-south', viewpointId: 'view-3d-ortho-south' },
  { key: 'ortho-west', viewpointId: 'view-3d-ortho-west' },
];

async function loadModelId(house) {
  const manifestPath = path.join(
    REPO_ROOT,
    `tmp/reverse-bim/house-${house}/iter-5-canonical-model.json`,
  );
  return JSON.parse(await fs.readFile(manifestPath, 'utf8')).modelId;
}

async function captureLargestCanvasAndFull(page, prefix) {
  const fullPath = `${prefix}-full.png`;
  await page.screenshot({ path: fullPath, fullPage: false });

  const canvases = await page.$$('canvas');
  let best = null;
  let bestArea = 0;
  for (const c of canvases) {
    const box = await c.boundingBox();
    if (!box) continue;
    const area = box.width * box.height;
    if (area > bestArea) {
      bestArea = area;
      best = box;
    }
  }
  const cropPath = `${prefix}-crop.png`;
  if (best) {
    await page.screenshot({
      path: cropPath,
      clip: { x: best.x, y: best.y, width: best.width, height: best.height },
    });
  } else {
    await page.screenshot({ path: cropPath, fullPage: false });
  }
  return { fullPath, cropPath, canvasArea: bestArea };
}

async function captureOneView(browser, house, modelId, view) {
  const baseUrl = `http://127.0.0.1:22000/?modelId=${modelId}`;
  const url = view.viewpointId
    ? `${baseUrl}&activeViewpoint=${view.viewpointId}`
    : baseUrl;
  const context = await browser.newContext({
    viewport: { width: 2400, height: 1500, deviceScaleFactor: 2 },
  });
  await context.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const s = window.__bimStore?.getState?.();
      return !!s && !!s.modelId && Object.keys(s.elementsById ?? {}).length > 0;
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(view.viewpointId ? 8000 : 5000);

  const activeMode = await page.evaluate(() => {
    const s = window.__bimStore?.getState?.();
    return {
      viewerMode: s?.viewerMode,
      activeViewpointId: s?.activeViewpointId,
    };
  });

  const prefix = path.join(OUT_DIR, `${house}-${view.key}`);
  const r = await captureLargestCanvasAndFull(page, prefix);
  await context.close();
  return {
    view: view.key,
    viewpointId: view.viewpointId,
    url,
    activeMode,
    ...r,
    errors: errors.slice(0, 5),
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const summary = [];
  for (const house of HOUSES) {
    console.log(`\n=== ${house} ===`);
    const modelId = await loadModelId(house);
    const captures = [];
    for (const view of VIEWS) {
      try {
        const r = await captureOneView(browser, house, modelId, view);
        captures.push(r);
        console.log(
          `    ${house}/${view.key} → crop=${path.basename(r.cropPath)} mode=${r.activeMode.viewerMode} activeVp=${r.activeMode.activeViewpointId ?? '-'}`,
        );
      } catch (err) {
        captures.push({ view: view.key, error: err.message });
        console.log(`    ${house}/${view.key} FAILED: ${err.message}`);
      }
    }
    summary.push({ house, modelId, captures });
  }
  await browser.close();
  await fs.writeFile(
    path.join(OUT_DIR, 'capture-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );
  console.log(`\nDone. Captures: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
