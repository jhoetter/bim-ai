#!/usr/bin/env node
/**
 * view-capture-run — thin Playwright driver for the `view-capture-run` MCP tool.
 *
 * Phase A.1 + E.2 of mcp-native-bim-agent-tracker. The Python route at
 * POST /api/v3/models/{model_id}/capture-views shells out to this script,
 * reads the PNGs it writes, base64-encodes them, returns inline bytes, and
 * deletes the tempdir. No filesystem coupling crosses the MCP boundary.
 *
 * Why a fresh small script instead of the existing
 * `reverse-bim-view-capture-runner.mjs`:
 *   - that runner takes a heavyweight `reverseBimViewCapturePlan_v1` document
 *     and writes a manifest + evidence rows for the reverse-BIM gates;
 *   - the MCP tool wants the dumbest possible shape: model id + view list
 *     (e.g. ["north-shaded", "south-wireframe"]) → PNGs.
 *
 * Cardinal cameras are computed from the live model's bounding box using
 * `window.__bimStore.setOrbitCameraFromViewpointMm` — this works for ANY
 * loaded model, not just those that have the seeded `view-3d-ortho-{n,s,e,w}`
 * viewpoint elements.
 *
 * Usage:
 *   node packages/web/scripts/view-capture-run.mjs \
 *     --model-id <uuid> \
 *     --views north-shaded,north-wireframe,south-shaded,... \
 *     --out-dir /tmp/captures \
 *     [--web-url http://127.0.0.1:2000] \
 *     [--width 1024] [--height 768] \
 *     [--timeout-ms 60000]
 *
 * Output files: `<out-dir>/<view>.png` (one per view).
 * Exit 0 on full success, 1 otherwise. Last stdout line is JSON summary.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const DEFAULT_WEB_URL = 'http://127.0.0.1:2000';
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const DEFAULT_TIMEOUT_MS = 60_000;
const SUPPORTED_DIRECTIONS = new Set(['north', 'south', 'east', 'west']);
const SUPPORTED_STYLES = new Set(['shaded', 'wireframe']);

/** Cardinal camera direction unit vectors (model-space).
 *
 * The viewer's world frame is X=east, Y=north, Z=up (matches the
 * `iter-14_author_ortho_viewpoints.py` archive script). A camera "north of
 * the building looking south" has +Y offset from the centroid. The slight
 * +0.05 Z tilt mirrors the archive script so the roof plane stays visible.
 */
const DIRECTION_VECTORS = {
  north: [0.0, 1.0, 0.05],
  south: [0.0, -1.0, 0.05],
  east: [1.0, 0.0, 0.05],
  west: [-1.0, 0.0, 0.05],
};

function parseArgs(argv) {
  const args = {
    modelId: null,
    views: null,
    outDir: null,
    webUrl: DEFAULT_WEB_URL,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--model-id' && argv[i + 1]) args.modelId = argv[++i];
    else if (arg === '--views' && argv[i + 1]) args.views = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = argv[++i];
    else if (arg === '--web-url' && argv[i + 1]) args.webUrl = argv[++i];
    else if (arg === '--width' && argv[i + 1]) args.width = Number(argv[++i]);
    else if (arg === '--height' && argv[i + 1]) args.height = Number(argv[++i]);
    else if (arg === '--timeout-ms' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  if (!args.modelId || !args.views || !args.outDir) {
    console.error('Required: --model-id, --views, --out-dir');
    process.exit(2);
  }
  return args;
}

function parseViewToken(token) {
  // Accept "north-shaded", "n-shaded" not supported — keep token surface tight.
  const idx = token.indexOf('-');
  if (idx <= 0) throw new Error(`Bad view token: '${token}' (expected '<dir>-<style>')`);
  const direction = token.slice(0, idx);
  const style = token.slice(idx + 1);
  if (!SUPPORTED_DIRECTIONS.has(direction)) {
    throw new Error(`Unsupported direction '${direction}' in '${token}'`);
  }
  if (!SUPPORTED_STYLES.has(style)) {
    throw new Error(`Unsupported style '${style}' in '${token}'`);
  }
  return { token, direction, style };
}

async function waitForModelLoaded(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window;
      const state = w.__bimStore?.getState?.();
      if (!state || !state.modelId) return false;
      const elements = state.elementsById ?? {};
      return Object.keys(elements).length > 0;
    },
    null,
    { timeout: timeoutMs },
  );
}

async function getModelBboxMm(page) {
  // Compute axis-aligned bbox from every element with a `mm` position bag.
  // Falls back to a unit bbox if the model has no positioned elements (so we
  // still produce screenshots rather than crashing).
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window;
    const elements = w.__bimStore?.getState?.()?.elementsById ?? {};
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    let zmin = Infinity;
    let zmax = -Infinity;
    let count = 0;
    for (const el of Object.values(elements)) {
      const candidates = [];
      if (el?.positionMm) candidates.push(el.positionMm);
      if (el?.startMm) candidates.push(el.startMm);
      if (el?.endMm) candidates.push(el.endMm);
      if (Array.isArray(el?.verticesMm)) candidates.push(...el.verticesMm);
      if (Array.isArray(el?.points)) {
        for (const pt of el.points) if (pt?.mm) candidates.push(pt.mm);
      }
      for (const p of candidates) {
        const x = Number(p?.xMm ?? p?.x);
        const y = Number(p?.yMm ?? p?.y);
        const z = Number(p?.zMm ?? p?.z);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          xmin = Math.min(xmin, x);
          xmax = Math.max(xmax, x);
          ymin = Math.min(ymin, y);
          ymax = Math.max(ymax, y);
          zmin = Math.min(zmin, z);
          zmax = Math.max(zmax, z);
          count += 1;
        }
      }
    }
    if (count === 0) {
      return { xmin: -10000, xmax: 10000, ymin: -10000, ymax: 10000, zmin: 0, zmax: 6000, count };
    }
    return { xmin, xmax, ymin, ymax, zmin, zmax, count };
  });
}

function cameraForDirection(bbox, direction) {
  const cx = (bbox.xmin + bbox.xmax) / 2;
  const cy = (bbox.ymin + bbox.ymax) / 2;
  const cz = (bbox.zmin + bbox.zmax) / 2;
  const dx = bbox.xmax - bbox.xmin;
  const dy = bbox.ymax - bbox.ymin;
  const dz = bbox.zmax - bbox.zmin;
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const radius = 2.5 * Math.max(diag, 1000);
  const [ux, uy, uz] = DIRECTION_VECTORS[direction];
  const norm = Math.sqrt(ux * ux + uy * uy + uz * uz);
  return {
    position: {
      xMm: cx + (radius * ux) / norm,
      yMm: cy + (radius * uy) / norm,
      zMm: cz + (radius * uz) / norm,
    },
    target: { xMm: cx, yMm: cy, zMm: cz },
    up: { xMm: 0.0, yMm: 0.0, zMm: 1.0 },
  };
}

async function applyCameraAndStyle(page, camera, style) {
  await page.evaluate(
    ({ camera: cam, style: st }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window;
      const state = w.__bimStore?.getState?.();
      if (!state) return;
      // Force 3D mode — seed models often boot into a 2D plan tab and the
      // wireframe/shaded toggle + ortho camera only apply to the orbit_3d
      // viewport. Without this, MCP callers get a screenshot of the plan canvas.
      state.setViewerMode?.('orbit_3d');
      // Force orthographic projection so cardinal facades read as elevations.
      state.setViewerProjection?.('orthographic');
      state.setViewerRenderStyle?.(st);
      state.setOrbitCameraFromViewpointMm?.(cam);
    },
    { camera, style },
  );
}

async function captureOne(page, view, bbox, outDir, timeoutMs) {
  const camera = cameraForDirection(bbox, view.direction);
  await applyCameraAndStyle(page, camera, view.style);
  // Let the camera tween + frame compositing settle.
  await page.waitForTimeout(1500);
  const outPath = path.join(outDir, `${view.token}.png`);
  await page.screenshot({ path: outPath, fullPage: false, timeout: timeoutMs });
  const stat = await fs.stat(outPath);
  return { view: view.token, path: outPath, bytes: stat.size };
}

export async function runViewCapture(opts) {
  const {
    modelId,
    views,
    outDir,
    webUrl = DEFAULT_WEB_URL,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;
  await fs.mkdir(outDir, { recursive: true });

  const parsedViews = views.map(parseViewToken);
  // Issue #132 — MF-render-12: `&captureMode=1` tells the workspace to
  // open a 3D tab as the default for this model, even when the model has
  // no `viewpoint` element (typical for MCP-authored models). Without
  // this, the default tab is a plan tab → CanvasMount renders
  // <PlanCanvas/> → every cardinal capture is a 2D-plan UI screenshot
  // (7-of-8 byte-identical), not a 3D ortho render.
  const url =
    `${webUrl}/?modelId=${encodeURIComponent(modelId)}` +
    `&projection=orthographic&captureMode=1`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height, deviceScaleFactor: 1 },
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

  const results = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForModelLoaded(page, timeoutMs);
    // Initial paint settle.
    await page.waitForTimeout(1000);
    const bbox = await getModelBboxMm(page);
    for (const view of parsedViews) {
      results.push(await captureOne(page, view, bbox, outDir, timeoutMs));
    }
    return { ok: true, modelId, outDir, bbox, captures: results, errors: errors.slice(0, 10) };
  } catch (err) {
    return {
      ok: false,
      modelId,
      outDir,
      error: err instanceof Error ? err.message : String(err),
      captures: results,
      errors: errors.slice(0, 10),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const views = args.views
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (views.length === 0) {
    console.error('--views must be a non-empty comma-separated list');
    process.exit(2);
  }
  const result = await runViewCapture({
    modelId: args.modelId,
    views,
    outDir: args.outDir,
    webUrl: args.webUrl,
    width: args.width,
    height: args.height,
    timeoutMs: args.timeoutMs,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
  });
}
