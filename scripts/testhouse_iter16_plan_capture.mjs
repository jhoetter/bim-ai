#!/usr/bin/env node
// Iter-16 plan-view capture — captures the per-level plan views so the
// inside-out methodology can be visually verified (room outlines + labels
// visible in plan view).
//
// Uses `?activePlanView=<id>` URL routing (supported in Workspace.tsx).
// Outputs: tmp/reverse-bim/iter-16-captures/{house}-plan-{lvl}-{crop,full}.png

import { chromium } from '/home/jhoetter/repos/bim-ai/node_modules/.pnpm/playwright@1.55.1/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tmp/reverse-bim/iter-16-captures');
const API = 'http://127.0.0.1:28500';

const HOUSES = ['alpha', 'beta', 'gamma'];

async function loadModelId(house) {
  const text = await fs.readFile(
    path.join(REPO_ROOT, `tmp/reverse-bim/house-${house}/iter-5-canonical-model.json`),
    'utf8',
  );
  return JSON.parse(text).modelId;
}

async function snapshotPlanViews(modelId) {
  // Use Node's built-in fetch
  const r = await fetch(`${API}/api/models/${modelId}/snapshot`);
  const s = await r.json();
  const out = [];
  for (const e of Object.values(s.elements ?? {})) {
    if (e && e.kind === 'plan_view') {
      out.push({ id: e.id, name: e.name, levelId: e.levelId });
    }
  }
  return out;
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
  return { fullPath, cropPath };
}

async function capturePlanView(browser, house, modelId, plan) {
  const lvl = (plan.levelId || '').replace(/^lvl-/, '');
  const url = `http://127.0.0.1:22000/?modelId=${modelId}&activePlanView=${plan.id}`;
  const context = await browser.newContext({
    viewport: { width: 2400, height: 1500, deviceScaleFactor: 2 },
  });
  await context.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const s = window.__bimStore?.getState?.();
      return !!s && !!s.modelId && Object.keys(s.elementsById ?? {}).length > 0;
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(7000);
  const prefix = path.join(OUT_DIR, `${house}-plan-${lvl}`);
  const r = await captureLargestCanvasAndFull(page, prefix);
  await context.close();
  return { ...r, lvl, planId: plan.id };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const summary = [];
  for (const house of HOUSES) {
    console.log(`\n=== ${house} ===`);
    const modelId = await loadModelId(house);
    const planViews = await snapshotPlanViews(modelId);
    console.log(`  ${planViews.length} plan views`);
    for (const pv of planViews) {
      try {
        const r = await capturePlanView(browser, house, modelId, pv);
        console.log(`  ${house}/plan-${r.lvl} → ${path.basename(r.cropPath)}`);
        summary.push({ house, ...r });
      } catch (err) {
        console.log(`  ${house}/${pv.name} FAILED: ${err.message}`);
        summary.push({ house, planId: pv.id, error: err.message });
      }
    }
  }
  await browser.close();
  await fs.writeFile(
    path.join(OUT_DIR, 'plan-capture-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );
  console.log(`\nDone. Plan captures: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
