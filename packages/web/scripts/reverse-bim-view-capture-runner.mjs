#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

export const REVERSE_BIM_VIEW_CAPTURE_RUN_SCHEMA_VERSION = 'reverseBimViewCaptureRun_v1';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CAPTURE_SELECTOR = '[data-evidence-capture-root], body';
const DEFAULT_MANIFEST_NAME = 'reverse-bim-view-capture-manifest.json';

function usage() {
  console.error(`Usage:
  node packages/web/scripts/reverse-bim-view-capture-runner.mjs --plan view-capture-plan.json [--out evidence-dir] [--timeout-ms 30000] [--headful] [--json]

Reads a reverseBimViewCapturePlan_v1 work order, opens each capture URL in
Chromium, writes PNG screenshots to capture.path, and writes:
  <out>/reverse-bim-view-capture-manifest.json

The manifest is evidence for reverse_bim.ui_evidence and
reverse_bim.source_overlay_evidence. UI checklist values remain pending until
an AI/human visual reviewer inspects the screenshots.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    planPath: null,
    outDir: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    headless: true,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--plan' && argv[i + 1]) args.planPath = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.outDir = argv[++i];
    else if (arg === '--timeout-ms' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else if (arg === '--headful') args.headless = false;
    else if (arg === '--json') args.json = true;
    else usage();
  }
  if (!args.planPath) usage();
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) usage();
  return args;
}

export function normalizeReverseBimViewCapturePlan(plan) {
  const captures = Array.isArray(plan?.captures)
    ? plan.captures.filter((row) => row && typeof row === 'object')
    : [];
  const blockers = [];
  if (plan?.format !== 'reverseBimViewCapturePlan_v1') {
    blockers.push({
      code: 'capture_plan_format_invalid',
      message: 'Expected reverseBimViewCapturePlan_v1.',
    });
  }
  if (captures.length === 0) {
    blockers.push({
      code: 'capture_plan_empty',
      message: 'Capture plan contains no capture rows.',
    });
  }
  captures.forEach((capture, index) => {
    if (!capture.url) {
      blockers.push({
        code: 'capture_url_missing',
        captureId: capture.captureId ?? `capture-${index}`,
        message: 'Capture row is missing a URL.',
      });
    }
    if (!capture.path) {
      blockers.push({
        code: 'capture_path_missing',
        captureId: capture.captureId ?? `capture-${index}`,
        message: 'Capture row is missing a screenshot path.',
      });
    }
  });
  return {
    ok: blockers.length === 0,
    blockers,
    plan: {
      ...plan,
      captures,
      baseUrl: plan?.baseUrl ?? 'http://127.0.0.1:2000',
      viewport: normalizeViewport(plan?.viewport),
    },
  };
}

export async function runReverseBimViewCapturePlan({
  planPath,
  outDir = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headless = true,
} = {}) {
  const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
  const normalized = normalizeReverseBimViewCapturePlan(plan);
  const outputDir = path.resolve(outDir ?? inferManifestOutDir(normalized.plan));
  await fs.mkdir(outputDir, { recursive: true });
  if (!normalized.ok) {
    const manifest = buildReverseBimViewCaptureRunManifest({
      plan: normalized.plan,
      results: [],
      blockers: normalized.blockers,
      outputDir,
    });
    await writeManifest(outputDir, manifest);
    return manifest;
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: {
      width: normalized.plan.viewport.width,
      height: normalized.plan.viewport.height,
    },
    deviceScaleFactor: normalized.plan.viewport.deviceScaleFactor,
  });
  await context.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
  });

  const page = await context.newPage();
  const results = [];
  try {
    for (const capture of normalized.plan.captures) {
      results.push(await captureOneView(page, capture, timeoutMs));
    }
  } finally {
    await browser.close();
  }

  const manifest = buildReverseBimViewCaptureRunManifest({
    plan: normalized.plan,
    results,
    blockers: [],
    outputDir,
  });
  await writeManifest(outputDir, manifest);
  return manifest;
}

export function buildReverseBimViewCaptureRunManifest({
  plan,
  results,
  blockers = [],
  outputDir = null,
  capturedAt = new Date().toISOString(),
}) {
  const captureResults = Array.isArray(results) ? results : [];
  const failed = captureResults.filter((row) => row.status !== 'captured');
  const manifest = {
    ok: blockers.length === 0 && failed.length === 0,
    format: REVERSE_BIM_VIEW_CAPTURE_RUN_SCHEMA_VERSION,
    capturedAt,
    modelId: plan?.modelId ?? null,
    runId: plan?.runId ?? null,
    outputDir,
    planDigestSha256: digest(plan ?? {}),
    summary: {
      captureCount: Array.isArray(plan?.captures) ? plan.captures.length : 0,
      capturedCount: captureResults.filter((row) => row.status === 'captured').length,
      failedCount: failed.length,
      blockerCount: blockers.length,
      pendingVisualReviewCount: captureResults.filter(
        (row) => row.status === 'captured' && row.evidenceKind === 'ui',
      ).length,
      pendingOverlayMetricCount: captureResults.filter(
        (row) => row.status === 'captured' && row.evidenceKind === 'overlay',
      ).length,
    },
    blockers,
    captures: captureResults,
    uiEvidenceRows: captureResults
      .filter((row) => row.status === 'captured' && row.evidenceKind === 'ui')
      .map((row) => uiEvidenceRow(row, capturedAt)),
    overlayEvidenceRows: captureResults
      .filter((row) => row.status === 'captured' && row.evidenceKind === 'overlay')
      .map((row) => overlayEvidenceRow(row, capturedAt)),
    reviewWorklist: captureResults
      .filter((row) => row.status === 'captured')
      .map((row) => reviewWorklistRow(row)),
    nextStep:
      blockers.length > 0 || failed.length > 0
        ? 'Fix failed captures before running UI/source-overlay evidence gates.'
        : 'Run AI visual review for UI checklist rows and overlay deviation measurement before acceptance.',
  };
  manifest.digestSha256 = digest(manifest);
  return manifest;
}

// Pixels below this PNG size on the 1920×1080 viewport are reliably blank
// canvases (the runner's been observed emitting 9441-byte all-white PNGs when
// the WebGL renderer hasn't drawn yet). 30 KB is a generous floor; real frames
// with the 3D viewer + chrome land at ~250 KB+.
const BLANK_PNG_BYTES_THRESHOLD = 30_000;
const RETRY_ON_BLANK = 2;

async function captureOneView(page, capture, timeoutMs) {
  const startedAt = new Date().toISOString();
  const screenshotPath = path.resolve(String(capture.path));
  const consoleErrors = [];
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  page.on('console', onConsole);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.goto(String(capture.url), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page
      .waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 10_000) })
      .catch(() => {});
    await waitForModelIdle(page, timeoutMs);
    const selector = screenshotSelector(capture);
    const target = page.locator(selector).first();
    const shoot = async () => {
      if ((await target.count()) > 0) {
        await target.screenshot({ path: screenshotPath, timeout: timeoutMs });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: timeoutMs });
      }
    };
    // Tail wait: give the WebGL canvas a brief moment to draw after camera move.
    await page.waitForTimeout(800);
    await shoot();
    // Retry-on-blank: the renderer occasionally drops a blank frame even after
    // model-idle returns. Detect by file size and re-shoot with a longer wait.
    let fileBuffer = await fs.readFile(screenshotPath);
    for (let attempt = 1; attempt <= RETRY_ON_BLANK; attempt++) {
      if (fileBuffer.length >= BLANK_PNG_BYTES_THRESHOLD) break;
      await page.waitForTimeout(1500 * attempt);
      await shoot();
      fileBuffer = await fs.readFile(screenshotPath);
    }
    return {
      captureId: capture.captureId,
      evidenceKind: capture.evidenceKind,
      viewId: capture.viewId,
      viewKind: capture.viewKind,
      sourcePageId: capture.sourcePageId,
      coordinateFrameId: capture.coordinateFrameId,
      status: 'captured',
      url: capture.url,
      path: screenshotPath,
      sha256: createHash('sha256').update(fileBuffer).digest('hex'),
      capturedAt: new Date().toISOString(),
      startedAt,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: consoleErrors.slice(0, 10),
      evidenceRowTemplate: capture.evidenceRowTemplate ?? {},
      visualChecklistItems: visualChecklistItems(capture),
    };
  } catch (error) {
    return {
      captureId: capture.captureId,
      evidenceKind: capture.evidenceKind,
      viewId: capture.viewId,
      viewKind: capture.viewKind,
      sourcePageId: capture.sourcePageId,
      coordinateFrameId: capture.coordinateFrameId,
      status: 'failed',
      url: capture.url,
      path: screenshotPath,
      startedAt,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      consoleErrorCount: consoleErrors.length,
      consoleErrors: consoleErrors.slice(0, 10),
      evidenceRowTemplate: capture.evidenceRowTemplate ?? {},
      visualChecklistItems: visualChecklistItems(capture),
    };
  } finally {
    page.off('console', onConsole);
  }
}

async function waitForModelIdle(page, timeoutMs) {
  await page
    .waitForFunction(
      () => {
        const root = document.querySelector('[data-evidence-capture-root]');
        const busy = document.querySelector('[aria-busy="true"], [data-bim-loading="true"]');
        return Boolean(root || document.body) && !busy;
      },
      null,
      { timeout: Math.min(timeoutMs, 10_000) },
    )
    .catch(() => {});
}

function screenshotSelector(capture) {
  const screenshotStep = Array.isArray(capture.playwrightSteps)
    ? capture.playwrightSteps.find((step) => step?.action === 'screenshot')
    : null;
  return screenshotStep?.selector ?? DEFAULT_CAPTURE_SELECTOR;
}

function uiEvidenceRow(captureResult, capturedAt) {
  const template = captureResult.evidenceRowTemplate ?? {};
  const checklistIds = visualChecklistItems(captureResult);
  return {
    ...withoutVisualChecklist(template),
    viewId: template.viewId ?? captureResult.viewId,
    kind: template.kind ?? captureResult.viewKind,
    status: 'captured',
    path: captureResult.path,
    screenshotPath: captureResult.path,
    capturedAt,
    captureId: captureResult.captureId,
    sha256: captureResult.sha256,
    visualChecklist: {},
    visualChecklistReviewRequired: checklistIds,
    reviewStatus: checklistIds.length ? 'pending_ai_visual_review' : 'not_required',
  };
}

function overlayEvidenceRow(captureResult, capturedAt) {
  const template = captureResult.evidenceRowTemplate ?? {};
  return {
    ...template,
    viewId: template.viewId ?? captureResult.viewId,
    kind: template.kind ?? captureResult.viewKind,
    status: 'captured',
    screenshotPath: captureResult.path,
    evidencePath: captureResult.path,
    capturedAt,
    captureId: captureResult.captureId,
    sha256: captureResult.sha256,
    sourcePageId: template.sourcePageId ?? captureResult.sourcePageId,
    coordinateFrameId: template.coordinateFrameId ?? captureResult.coordinateFrameId,
    maxDeviationMm: template.maxDeviationMm ?? null,
    reviewStatus: 'pending_overlay_metric',
  };
}

function reviewWorklistRow(captureResult) {
  return {
    captureId: captureResult.captureId,
    evidenceKind: captureResult.evidenceKind,
    viewId: captureResult.viewId,
    path: captureResult.path,
    reviewStatus:
      captureResult.evidenceKind === 'overlay'
        ? 'pending_overlay_metric'
        : 'pending_ai_visual_review',
    visualChecklistItems:
      captureResult.evidenceKind === 'ui' ? visualChecklistItems(captureResult) : [],
  };
}

function withoutVisualChecklist(row) {
  const { visualChecklist: _visualChecklist, ...rest } = row;
  return rest;
}

function visualChecklistItems(capture) {
  if (Array.isArray(capture.visualChecklistItems)) {
    return capture.visualChecklistItems.map((item) => String(item)).filter(Boolean);
  }
  const template = capture.evidenceRowTemplate ?? {};
  if (template.visualChecklist && typeof template.visualChecklist === 'object') {
    return Object.keys(template.visualChecklist);
  }
  return [];
}

function normalizeViewport(viewport) {
  return {
    width: Number.isFinite(Number(viewport?.width)) ? Number(viewport.width) : 1920,
    height: Number.isFinite(Number(viewport?.height)) ? Number(viewport.height) : 1200,
    deviceScaleFactor: Number.isFinite(Number(viewport?.deviceScaleFactor))
      ? Number(viewport.deviceScaleFactor)
      : 1,
  };
}

function inferManifestOutDir(plan) {
  const firstPath = plan?.captures?.find((capture) => capture?.path)?.path;
  if (firstPath) return path.dirname(path.resolve(String(firstPath)));
  return path.resolve('tmp', 'reverse-bim-view-captures');
}

async function writeManifest(outputDir, manifest) {
  await fs.mkdir(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, DEFAULT_MANIFEST_NAME);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function digest(payload) {
  return createHash('sha256').update(JSON.stringify(payload, stableReplacer)).digest('hex');
}

function stableReplacer(_key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await runReverseBimViewCapturePlan({
    planPath: args.planPath,
    outDir: args.outDir,
    timeoutMs: args.timeoutMs,
    headless: args.headless,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
  } else {
    process.stdout.write(
      `reverse-BIM capture run: ${manifest.ok ? 'ok' : 'blocked'} (${manifest.summary.capturedCount}/${manifest.summary.captureCount} captured)\n`,
    );
  }
  process.exit(manifest.ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
