#!/usr/bin/env node
/**
 * PERF-H01: drive plan canvas pointermove against a running dev server,
 * collect the in-app `__BIM_AI_PLAN_POINTERMOVE_PERF__` samples, and write
 * a summary report to spec/generated/plan-pointermove-perf.json.
 *
 * Prerequisite: dev server must be running (default `make dev-forwarded`,
 * web on http://localhost:22000). Override with PERF_WEB_URL=...
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const SCHEMA_VERSION = 'plan-pointermove-perf.v1';
const DEFAULT_URL = process.env.PERF_WEB_URL ?? 'http://localhost:22000';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_PATH = path.join(REPO_ROOT, 'spec', 'generated', 'plan-pointermove-perf.json');

const PROBE_SAMPLES = 240; // ~4s worth of moves at 60fps cadence
const PROBE_STEP_DELAY_MS = 12;

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

function summariseByScenario(samples) {
  const grouped = new Map();
  for (const s of samples) {
    const list = grouped.get(s.scenario) ?? [];
    list.push(s.durationMs);
    grouped.set(s.scenario, list);
  }
  const out = {};
  for (const [scenario, list] of grouped) {
    list.sort((a, b) => a - b);
    out[scenario] = {
      count: list.length,
      p50Ms: Number(quantile(list, 0.5).toFixed(3)),
      p95Ms: Number(quantile(list, 0.95).toFixed(3)),
      maxMs: Number(list[list.length - 1].toFixed(3)),
    };
  }
  return out;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (err) {
    await browser.close();
    process.stderr.write(`error: could not reach ${DEFAULT_URL} (is dev server running?)\n`);
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }

  await page.addInitScript(() => {
    window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__ = true;
  });
  await page.evaluate(() => {
    window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__ = true;
    window.__BIM_AI_PLAN_POINTERMOVE_PERF__ = [];
  });

  const canvas = await page.locator('canvas').first();
  let canvasBox = null;
  try {
    await canvas.waitFor({ state: 'visible', timeout: 8000 });
    canvasBox = await canvas.boundingBox();
  } catch {
    /* fall back to viewport-center sweeping below */
  }
  const cx = canvasBox ? canvasBox.x + canvasBox.width / 2 : 800;
  const cy = canvasBox ? canvasBox.y + canvasBox.height / 2 : 500;
  const radius = canvasBox ? Math.min(canvasBox.width, canvasBox.height) / 3 : 240;

  for (let i = 0; i < PROBE_SAMPLES; i++) {
    const t = (i / PROBE_SAMPLES) * Math.PI * 2;
    const x = cx + Math.cos(t) * radius;
    const y = cy + Math.sin(t) * radius;
    await page.mouse.move(x, y);
    await page.waitForTimeout(PROBE_STEP_DELAY_MS);
  }

  const samples = await page.evaluate(() => window.__BIM_AI_PLAN_POINTERMOVE_PERF__ ?? []);
  await browser.close();

  const summary = {
    schemaVersion: SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    url: DEFAULT_URL,
    sampleCount: samples.length,
    byScenario: summariseByScenario(samples),
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  process.stdout.write(`wrote ${path.relative(REPO_ROOT, OUT_PATH)} (${samples.length} samples)\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});
