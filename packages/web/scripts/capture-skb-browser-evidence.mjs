#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

function usage() {
  console.error(`Usage:
  node packages/web/scripts/capture-skb-browser-evidence.mjs \\
    --url http://127.0.0.1:2000 \\
    --out <evidence-dir> [--model <uuid>] [--timeout-ms <n>] [--view-pattern <regex>]

Captures the running bim-ai browser state used by sketch-to-BIM review:
full-page screenshot, right-rail screenshot, and right-rail review text.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    url: process.env.BIM_AI_WEB_URL || 'http://127.0.0.1:2000',
    out: null,
    model: process.env.BIM_AI_MODEL_ID || null,
    timeoutMs: 30000,
    viewPattern: process.env.BIM_AI_VIEW_PATTERN || null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (arg === '--model' && argv[i + 1]) args.model = argv[++i];
    else if (arg === '--timeout-ms' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else if (arg === '--view-pattern' && argv[i + 1]) args.viewPattern = argv[++i];
    else usage();
  }
  if (!args.out) usage();
  return args;
}

async function maybeClick(locator) {
  if ((await locator.count()) === 0) return false;
  if (
    !(await locator
      .first()
      .isVisible()
      .catch(() => false))
  )
    return false;
  await locator.first().click();
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out);
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleRows = [];
  page.on('console', (msg) => consoleRows.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => consoleRows.push({ type: 'pageerror', text: err.message }));

  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: args.timeoutMs });

  await maybeClick(page.getByRole('button', { name: /skip tour/i }));
  await page.waitForTimeout(250);

  if (args.viewPattern) {
    const viewRegex = new RegExp(args.viewPattern, 'i');
    if (await maybeClick(page.getByText(viewRegex))) {
      await page.waitForTimeout(1500);
    }
  }

  const emptyCta = page.getByTestId('canvas-empty-cta');
  if (await maybeClick(emptyCta)) {
    await page.waitForTimeout(1500);
  }

  const reviewTab = page.getByTestId('right-rail-section-tab-review');
  await maybeClick(reviewTab);
  await page.waitForTimeout(500);

  const rightRail = page.getByTestId('app-shell-right-rail');
  const review = page.locator('#right-rail-review');
  const fullScreenshot = path.join(outDir, 'browser-full.png');
  const rightRailScreenshot = path.join(outDir, 'browser-right-rail.png');
  await page.screenshot({ path: fullScreenshot, fullPage: true });
  if ((await rightRail.count()) > 0) {
    await rightRail.first().screenshot({ path: rightRailScreenshot });
  }

  const reviewText =
    (await review.textContent({ timeout: 1000 }).catch(() => null)) ??
    (await rightRail.textContent({ timeout: 1000 }).catch(() => null)) ??
    '';
  const visibleRuleIds = [...reviewText.matchAll(/\b[a-z][a-z0-9]+(?:_[a-z0-9]+)+\b/g)].map(
    (match) => match[0],
  );

  const payload = {
    schemaVersion: 'sketch-to-bim.browser-evidence.v1',
    url: args.url,
    modelId: args.model,
    capturedAtEpochMs: Date.now(),
    screenshots: {
      fullPage: path.relative(process.cwd(), fullScreenshot),
      rightRail: path.relative(process.cwd(), rightRailScreenshot),
    },
    rightRailReviewText: reviewText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
    visibleRuleIds: [...new Set(visibleRuleIds)].sort(),
    console: consoleRows.slice(-50),
  };
  const jsonPath = path.join(outDir, 'browser-evidence.json');
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await browser.close();
  console.log(
    JSON.stringify({ ok: true, evidence: path.relative(process.cwd(), jsonPath) }, null, 2),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
