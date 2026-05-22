#!/usr/bin/env node
// Iter-11 capture — for each testhouse, capture the default 3D view plus
// the four orthographic elevations (east / north / south / west). Output:
// tmp/reverse-bim/iter-11-captures/{house}-{view}-{cropped,full}.png.
//
// Methodology cues honored (see spec/trackers/testhouse-visual-fidelity-tracker.md
// "Iter-10 methodology learnings" #11):
//   - largest-canvas selector for the cropped capture (skip the nav-cube widget)
//   - always also save the full-page screenshot for context
//   - elevation activation via `?activeElevationView=<id>` URL param
//     (re-added in Workspace.tsx for the iter-11 capture toolchain — the
//     iter-3 equivalent had been dropped in a refactor)

import { chromium } from '/home/jhoetter/repos/bim-ai/node_modules/.pnpm/playwright@1.55.1/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tmp/reverse-bim/iter-11-captures');

const HOUSES = ['alpha', 'beta', 'gamma'];
// 'default-3d' uses the model's default viewpoint, no store call needed.
// The 'elevation-*' ids are stable across all three iter-10 testhouses
// (authored by scripts/testhouse_iter5_canonical_rebuild.py).
const VIEWS = [
  { key: '3d', elevationViewId: null },
  { key: 'elev-east', elevationViewId: 'elevation-east' },
  { key: 'elev-north', elevationViewId: 'elevation-north' },
  { key: 'elev-south', elevationViewId: 'elevation-south' },
  { key: 'elev-west', elevationViewId: 'elevation-west' },
];

async function loadModelId(house) {
  const manifestPath = path.join(
    REPO_ROOT,
    `tmp/reverse-bim/house-${house}/iter-5-canonical-model.json`,
  );
  const text = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(text).modelId;
}

async function waitForLargestCanvasStable(page, minTimeoutMs = 8000) {
  // Heuristic: just give it a fixed budget. Future work: probe an
  // isReady hook from the renderer.
  await page.waitForTimeout(minTimeoutMs);
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
  const url = view.elevationViewId
    ? `${baseUrl}&activeElevationView=${view.elevationViewId}`
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
  // Allow the URL-driven activation effect to fire and the new tab + view
  // to render. Empirically this needs more than just a frame.
  await waitForLargestCanvasStable(page, view.elevationViewId ? 8000 : 5000);

  const activeMode = await page.evaluate(() => {
    const s = window.__bimStore?.getState?.();
    return {
      viewerMode: s?.viewerMode,
      activeElevationViewId: s?.activeElevationViewId,
      activeViewpointId: s?.activeViewpointId,
    };
  });

  const prefix = path.join(OUT_DIR, `${house}-${view.key}`);
  const r = await captureLargestCanvasAndFull(page, prefix);
  await context.close();
  return {
    view: view.key,
    elevationViewId: view.elevationViewId,
    url,
    activeMode,
    ...r,
    errors: errors.slice(0, 5),
  };
}

async function captureHouse(browser, house, modelId) {
  const captures = [];
  for (const view of VIEWS) {
    try {
      const r = await captureOneView(browser, house, modelId, view);
      captures.push(r);
      console.log(
        `    ${house}/${view.key} → crop=${path.basename(r.cropPath)} mode=${r.activeMode.viewerMode} activeElev=${r.activeMode.activeElevationViewId ?? '-'}`,
      );
    } catch (err) {
      captures.push({ view: view.key, error: err.message });
      console.log(`    ${house}/${view.key} FAILED: ${err.message}`);
    }
  }
  return { house, modelId, captures };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const house of HOUSES) {
    const modelId = await loadModelId(house);
    console.log(`capturing ${house} (${modelId})...`);
    try {
      const r = await captureHouse(browser, house, modelId);
      results.push(r);
      for (const cap of r.captures ?? []) {
        for (const e of cap.errors ?? []) {
          console.log(`    ! ${house}/${cap.view} ${e.slice(0, 200)}`);
        }
      }
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      results.push({ house, error: err.message });
    }
  }
  await browser.close();
  await fs.writeFile(
    path.join(OUT_DIR, 'capture-summary.json'),
    JSON.stringify(results, null, 2),
  );
  console.log(`wrote ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'capture-summary.json'))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
