#!/usr/bin/env node
// Iter-10 quick visual capture — opens each testhouse model in headless
// Chromium, waits for the 3D viewport to settle, and screenshots the
// canvas. Output: tmp/reverse-bim/iter-10-captures/{house}-3d.png.
//
// This is the minimum viable feedback loop for visual-fidelity scoring.
// It uses the workspace's default 3D viewpoint (no view-template plumbing).

import { chromium } from '/home/jhoetter/repos/bim-ai/node_modules/.pnpm/playwright@1.55.1/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tmp/reverse-bim/iter-10-captures');

const HOUSES = ['alpha', 'beta', 'gamma'];

async function loadModelId(house) {
  const manifestPath = path.join(
    REPO_ROOT,
    `tmp/reverse-bim/house-${house}/iter-5-canonical-model.json`,
  );
  const text = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(text).modelId;
}

async function captureHouse(browser, house, modelId) {
  const url = `http://127.0.0.1:22000/?modelId=${modelId}`;
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
  await page.waitForTimeout(8000);

  // Whole-page capture (preserves context for cropping)
  const fullPath = path.join(OUT_DIR, `${house}-3d-full.png`);
  await page.screenshot({ path: fullPath, fullPage: false });

  // Tight crop on the LARGEST canvas — the navigation cube is also a
  // canvas but tiny; pick the one with the largest bounding box.
  const canvasPath = path.join(OUT_DIR, `${house}-3d.png`);
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
  if (best) {
    await page.screenshot({
      path: canvasPath,
      clip: { x: best.x, y: best.y, width: best.width, height: best.height },
    });
  } else {
    await page.screenshot({ path: canvasPath, fullPage: false });
  }

  await context.close();
  return { house, url, fullPath, canvasPath, errors: errors.slice(0, 10) };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const house of HOUSES) {
    const modelId = await loadModelId(house);
    process.stdout.write(`capturing ${house} (${modelId})... `);
    try {
      const r = await captureHouse(browser, house, modelId);
      results.push(r);
      console.log(`→ ${path.relative(REPO_ROOT, r.canvasPath)} (errors: ${r.errors.length})`);
      if (r.errors.length) {
        for (const e of r.errors) console.log(`    ! ${e.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ house, error: err.message });
    }
  }
  await browser.close();
  await fs.writeFile(
    path.join(OUT_DIR, 'capture-summary.json'),
    JSON.stringify(results, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
