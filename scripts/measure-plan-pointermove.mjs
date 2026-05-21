#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd().endsWith(`${path.sep}packages${path.sep}web`)
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();
const requireFromWeb = createRequire(path.join(workspaceRoot, 'packages/web/package.json'));
const { chromium } = requireFromWeb('@playwright/test');

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples) {
  const byScenario = new Map();
  for (const sample of samples) {
    const scenario = String(sample.scenario ?? 'unknown');
    const row = byScenario.get(scenario) ?? [];
    row.push(Number(sample.durationMs ?? 0));
    byScenario.set(scenario, row);
  }
  return Object.fromEntries(
    [...byScenario.entries()].map(([scenario, durations]) => [
      scenario,
      {
        count: durations.length,
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        maxMs: Math.max(...durations),
      },
    ]),
  );
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
      [
        'Usage: pnpm performance:plan-pointermove [--url=http://127.0.0.1:5173] [--moves=80] [--out=spec/generated/plan-pointermove-performance-current.json]',
        '',
        'Requires a running web app with a visible plan canvas.',
      ].join('\n'),
    );
    return;
  }
  const url = argValue('--url', process.env.BIM_AI_WEB_URL ?? 'http://127.0.0.1:5173');
  const out = argValue('--out', 'spec/generated/plan-pointermove-performance-current.json');
  const moves = Number(argValue('--moves', '80'));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__ = true;
    window.__BIM_AI_PLAN_POINTERMOVE_PERF__ = [];
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  const plan = page.locator('[data-testid="plan-canvas"]').first();
  await plan.waitFor({ timeout: 30_000 });
  const box = await plan.boundingBox();
  if (!box) throw new Error('Plan canvas is not visible.');

  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.25, y);
  for (let i = 0; i < moves; i += 1) {
    const t = i / Math.max(1, moves - 1);
    await page.mouse.move(box.x + box.width * (0.25 + 0.5 * t), y + Math.sin(t * Math.PI * 4) * 80);
  }

  await page.mouse.down({ button: 'middle' });
  for (let i = 0; i < Math.min(40, moves); i += 1) {
    await page.mouse.move(box.x + box.width * 0.55 + i * 2, y + i);
  }
  await page.mouse.up({ button: 'middle' });

  const samples = await page.evaluate(() => window.__BIM_AI_PLAN_POINTERMOVE_PERF__ ?? []);
  await browser.close();

  const report = {
    format: 'planPointerMovePerformance_v1',
    url,
    sampleCount: samples.length,
    summary: summarize(samples),
    samples,
  };
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ out, sampleCount: samples.length, summary: report.summary }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
