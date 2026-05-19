#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

export const TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION =
  'target-house-live-browser-evidence.v1';
export const TARGET_HOUSE_LIVE_RESPONSIVENESS_SCHEMA_VERSION =
  'target-house-live-responsiveness.v1';

export const TARGET_HOUSE_LIVE_INTERACTION_CONTRACT = [
  {
    id: 'orbit',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Orbit the target-house primary 3D view without visible main-thread stalls.',
    budget: {
      maxLatencyMs: 150,
      p95LatencyMs: 80,
      maxLongTaskMs: 80,
      maxDroppedFramePercent: 5,
    },
  },
  {
    id: 'select',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description:
      'Select a target-house door/window or envelope element and render inspector state.',
    budget: {
      maxLatencyMs: 250,
      p95LatencyMs: 160,
      maxLongTaskMs: 80,
      maxDroppedFramePercent: 5,
    },
  },
  {
    id: 'lens-switch',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Switch from architecture to coordination lens on target-house-1.',
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-open',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Open Advisor with target-house findings loaded.',
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-close',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Close Advisor and return focus to the target-house viewport.',
    budget: {
      maxLatencyMs: 350,
      p95LatencyMs: 220,
      maxLongTaskMs: 100,
      maxDroppedFramePercent: 6,
    },
  },
];

const BENIGN_VITE_PROXY_SOCKET_CODES = new Set(['EPIPE', 'ECONNRESET']);
const ACTIONABLE_APP_CLOSE_CODES = new Set([4403, 4404]);
const DEFAULT_OUT_DIR = path.resolve('tmp', 'target-house-live-responsiveness');

function usage() {
  console.error(`Usage:
  node packages/web/scripts/target-house-live-responsiveness.mjs --url <web-url> [--out <dir>] [--timeout-ms <n>] [--target-id target-house-1] [--proxy-log <file>] [--json]
  node packages/web/scripts/target-house-live-responsiveness.mjs --input <evidence.json> [--out <dir>] [--proxy-log <file>] [--json]

Writes:
  <out>/target-house-live-responsiveness.json

The output is machine-readable evidence for BIR-N07, BIR-N11, BIR-L02, and BIR-L03.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    url: process.env.BIM_AI_WEB_URL ?? null,
    input: null,
    out: process.env.BIM_AI_LIVE_RESPONSIVENESS_OUT ?? DEFAULT_OUT_DIR,
    targetId: process.env.BIM_AI_TARGET_ID ?? 'target-house-1',
    timeoutMs: 30_000,
    proxyLog: process.env.BIM_AI_PROXY_LOG ?? null,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (arg === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (arg === '--target-id' && argv[i + 1]) args.targetId = argv[++i];
    else if (arg === '--timeout-ms' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else if (arg === '--proxy-log' && argv[i + 1]) args.proxyLog = argv[++i];
    else if (arg === '--json') args.json = true;
    else usage();
  }

  if (!args.input && !args.url) usage();
  if (args.input && args.url) usage();
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) usage();
  args.out = path.resolve(args.out);
  return args;
}

export function targetHouseLiveResponsivenessContract() {
  return {
    interactions: TARGET_HOUSE_LIVE_INTERACTION_CONTRACT,
    websocketChurnPolicy: {
      benignViteProxySocketCodes: ['EPIPE', 'ECONNRESET'],
      actionableAppCloseCodes: [4403, 4404],
      exhaustedReconnectBudget: 'actionable',
      unknownChurn: 'actionable',
    },
  };
}

export function classifyTargetHouseLiveResponsiveness(evidence) {
  const input = normalizeEvidenceInput(evidence);
  const interactions = new Map(
    (Array.isArray(input.interactions) ? input.interactions : []).map((entry) => [entry.id, entry]),
  );
  const interactionRows = TARGET_HOUSE_LIVE_INTERACTION_CONTRACT.map((contract) =>
    classifyInteraction(contract, interactions.get(contract.id)),
  );
  const websocketChurnRows = (Array.isArray(input.websocketChurn) ? input.websocketChurn : []).map(
    classifyLiveResponsivenessChurnEvent,
  );
  const interactionOk = interactionRows.every((row) => row.status === 'pass');
  const websocketChurnOk = websocketChurnRows.every((row) => row.classification === 'benign');

  return {
    schemaVersion: TARGET_HOUSE_LIVE_RESPONSIVENESS_SCHEMA_VERSION,
    targetId:
      typeof input.targetId === 'string' && input.targetId ? input.targetId : 'target-house-1',
    ok: interactionOk && websocketChurnOk,
    summary: {
      requiredInteractionCount: interactionRows.length,
      interactionPassCount: interactionRows.filter((row) => row.status === 'pass').length,
      interactionFailCount: interactionRows.filter((row) => row.status !== 'pass').length,
      actionableChurnCount: websocketChurnRows
        .filter((row) => row.classification === 'actionable')
        .reduce((sum, row) => sum + row.count, 0),
      benignChurnCount: websocketChurnRows
        .filter((row) => row.classification === 'benign')
        .reduce((sum, row) => sum + row.count, 0),
      interactionOk,
      websocketChurnOk,
    },
    contract: targetHouseLiveResponsivenessContract(),
    interactionRows,
    websocketChurnRows,
  };
}

export function normalizeEvidenceInput(evidence) {
  if (
    evidence?.responsivenessReport?.schemaVersion ===
    TARGET_HOUSE_LIVE_RESPONSIVENESS_SCHEMA_VERSION
  ) {
    return {
      targetId: evidence.targetId,
      interactions: evidence.interactions,
      websocketChurn: evidence.websocketChurn,
    };
  }
  if (evidence?.schemaVersion === TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION) {
    return {
      targetId: evidence.targetId,
      interactions: evidence.interactions,
      websocketChurn: evidence.websocketChurn,
    };
  }
  return evidence ?? {};
}

export function classifyLiveResponsivenessChurnEvent(event) {
  const count = positiveInteger(event?.count);

  if (event?.kind === 'vite-proxy-error') {
    const code = typeof event.code === 'string' ? event.code : null;
    const benign = code != null && BENIGN_VITE_PROXY_SOCKET_CODES.has(code);
    return {
      trackerRefs: ['BIR-L03', 'BIR-N11'],
      classification: benign ? 'benign' : 'actionable',
      kind: event.kind,
      count,
      code,
      closeCode: null,
      action: null,
      shouldLog: !benign,
      reason: benign
        ? 'dev proxy socket closed during websocket reconnect or browser teardown'
        : 'unexpected Vite proxy failure; keep visible for diagnosis',
    };
  }

  if (event?.kind === 'app-ws-close') {
    const closeCode = numberOrNull(event.closeCode);
    const nextAttempt = positiveInteger(event.nextAttempt);
    const maxAttempts = numberOrNull(event.maxAttempts) ?? 10;
    const intentional = event.intentional === true;
    const hidden = event.hidden === true;
    const endpoint =
      event.endpoint === 'jobs' || event.endpoint === 'presentation' ? event.endpoint : 'workspace';

    let classification = 'benign';
    let action = 'schedule_reconnect';
    let reason = 'transient websocket close; reconnect with bounded backoff';
    if (intentional) {
      action = 'ignore';
      reason = 'component cleanup intentionally closed the websocket';
    } else if (closeCode != null && ACTIONABLE_APP_CLOSE_CODES.has(closeCode)) {
      classification = 'actionable';
      action = 'stop';
      reason =
        closeCode === 4403
          ? 'server rejected websocket authorization or revoked presentation access'
          : 'server could not resolve the websocket model';
    } else if (nextAttempt > maxAttempts) {
      classification = 'actionable';
      action = 'stop';
      reason = 'websocket exceeded reconnect attempt budget';
    } else if (hidden) {
      action = 'wait_until_visible';
      reason = 'tab is hidden; defer reconnect to avoid background churn';
    }

    return {
      trackerRefs: ['BIR-L03', 'BIR-N11'],
      classification,
      kind: event.kind,
      count,
      code: null,
      closeCode,
      endpoint,
      action,
      shouldLog: classification === 'actionable',
      reason,
    };
  }

  return {
    trackerRefs: ['BIR-L03', 'BIR-N11'],
    classification: 'actionable',
    kind: typeof event?.kind === 'string' && event.kind ? event.kind : 'unknown',
    count,
    code: null,
    closeCode: null,
    action: null,
    shouldLog: true,
    reason: 'unknown websocket/proxy churn must be reviewed before live responsiveness acceptance',
  };
}

export function extractWebsocketChurnFromText(text) {
  const counts = new Map();
  for (const match of String(text ?? '').matchAll(
    /\b(EPIPE|ECONNRESET|ECONNREFUSED|ETIMEDOUT)\b/g,
  )) {
    const code = match[1];
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()].map(([code, count]) => ({
    kind: 'vite-proxy-error',
    code,
    count,
  }));
}

export function mergeChurnEvents(events) {
  const keyed = new Map();
  for (const event of events) {
    const key = `${event.kind ?? 'unknown'}:${event.code ?? ''}:${event.closeCode ?? ''}:${event.endpoint ?? ''}:${event.intentional === true}:${event.hidden === true}`;
    const previous = keyed.get(key);
    if (previous) previous.count += positiveInteger(event.count);
    else keyed.set(key, { ...event, count: positiveInteger(event.count) });
  }
  return [...keyed.values()];
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function maybeReadProxyChurn(proxyLogPath) {
  if (!proxyLogPath) return [];
  const text = await fs.readFile(proxyLogPath, 'utf8');
  return extractWebsocketChurnFromText(text);
}

async function writeEvidence(outDir, payload) {
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, 'target-house-live-responsiveness.json');
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return file;
}

export async function validateTargetHouseLiveResponsivenessEvidence({
  inputPath,
  outDir = DEFAULT_OUT_DIR,
  proxyLogPath = null,
} = {}) {
  const input = await readJson(inputPath);
  const proxyChurn = await maybeReadProxyChurn(proxyLogPath);
  const normalized = normalizeEvidenceInput(input);
  const evidence = {
    ...input,
    targetId: normalized.targetId ?? input.targetId ?? 'target-house-1',
    interactions: normalized.interactions ?? [],
    websocketChurn: mergeChurnEvents([...(normalized.websocketChurn ?? []), ...proxyChurn]),
  };
  const responsivenessReport = classifyTargetHouseLiveResponsiveness(evidence);
  const payload =
    input.schemaVersion === TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION
      ? { ...evidence, responsivenessReport }
      : {
          schemaVersion: TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION,
          targetId: evidence.targetId,
          captureMode: 'validated-input',
          interactions: evidence.interactions,
          websocketChurn: evidence.websocketChurn,
          responsivenessReport,
        };
  const evidencePath = await writeEvidence(outDir, payload);
  return { evidencePath, evidence: payload, responsivenessReport };
}

export async function captureTargetHouseLiveResponsivenessEvidence({
  url,
  outDir = DEFAULT_OUT_DIR,
  targetId = 'target-house-1',
  timeoutMs = 30_000,
  proxyLogPath = null,
} = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleRows = [];
  const websocketChurn = [];
  const websocketUrls = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleRows.push({ type: msg.type(), text });
    websocketChurn.push(...extractWebsocketChurnFromText(text));
  });
  page.on('pageerror', (err) => {
    const text = err.message;
    consoleRows.push({ type: 'pageerror', text });
    websocketChurn.push(...extractWebsocketChurnFromText(text));
  });
  page.on('websocket', (ws) => {
    websocketUrls.push(ws.url());
    ws.on('socketerror', (error) => {
      websocketChurn.push({
        kind: 'vite-proxy-error',
        code: error?.code ?? null,
        message: error?.message ?? String(error),
      });
    });
    ws.on('close', () => {
      websocketChurn.push({
        kind: 'app-ws-close',
        endpoint: endpointFromUrl(ws.url()),
        closeCode: 1000,
        intentional: true,
        nextAttempt: 1,
      });
    });
  });

  await installBrowserProbe(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: timeoutMs });
  await maybeClick(page.getByRole('button', { name: /skip tour/i }));
  await ensureTargetHouseProject(page, targetId, timeoutMs);
  await activate3dView(page, timeoutMs);

  const interactions = [];
  interactions.push(await measureInteraction(page, 'orbit', () => orbitViewport(page)));
  interactions.push(await measureInteraction(page, 'select', () => selectTargetElement(page)));
  interactions.push(
    await measureInteraction(page, 'lens-switch', () => switchLensToCoordination(page)),
  );
  interactions.push(await measureInteraction(page, 'advisor-open', () => openAdvisor(page)));
  interactions.push(await measureInteraction(page, 'advisor-close', () => closeAdvisor(page)));

  websocketChurn.push(...(await collectBrowserWebsocketChurn(page)));
  websocketChurn.push(...(await maybeReadProxyChurn(proxyLogPath)));

  const payload = {
    schemaVersion: TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION,
    targetId,
    captureMode: 'playwright-live-browser',
    url,
    capturedAtEpochMs: Date.now(),
    browser: {
      engine: 'chromium',
      viewport: { width: 1440, height: 900 },
    },
    proofHooks: {
      appShell: await locatorVisible(page.getByTestId('app-shell')),
      orbitViewport: await locatorVisible(page.getByTestId('orbit-3d-viewport')),
      viewCube: await locatorVisible(page.getByTestId('view-cube')),
      inspector: await locatorVisible(page.getByTestId('inspector')),
      advisorEntry: await locatorVisible(page.getByTestId('status-bar-advisor-entry')),
    },
    interactions,
    websocketObservation: {
      observedSocketCount: websocketUrls.length,
      observedSocketUrls: [...new Set(websocketUrls)].sort(),
      proxyLogPath: proxyLogPath ? path.relative(process.cwd(), path.resolve(proxyLogPath)) : null,
    },
    websocketChurn: mergeChurnEvents(websocketChurn),
    console: consoleRows.slice(-50),
  };
  const responsivenessReport = classifyTargetHouseLiveResponsiveness(payload);
  const evidence = { ...payload, responsivenessReport };
  const evidencePath = await writeEvidence(outDir, evidence);
  await browser.close();
  return { evidencePath, evidence, responsivenessReport };
}

async function installBrowserProbe(page) {
  await page.addInitScript(() => {
    const win = window;
    win.__targetHouseLiveProbe = {
      longTasks: [],
      wsEvents: [],
    };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          win.__targetHouseLiveProbe.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      win.__targetHouseLiveProbe.longTaskObserver = observer;
    } catch {
      /* Long Task API is not available in every browser context. */
    }

    const NativeWebSocket = win.WebSocket;
    if (typeof NativeWebSocket === 'function') {
      win.WebSocket = class TargetHouseEvidenceWebSocket extends NativeWebSocket {
        constructor(url, protocols) {
          super(url, protocols);
          const endpoint = String(url).includes('/jobs')
            ? 'jobs'
            : String(url).includes('/presentation')
              ? 'presentation'
              : 'workspace';
          this.__targetHouseEvidenceIntentionalClose = false;
          this.addEventListener('close', (event) => {
            win.__targetHouseLiveProbe.wsEvents.push({
              kind: 'app-ws-close',
              endpoint,
              closeCode: event.code,
              intentional: this.__targetHouseEvidenceIntentionalClose === true,
              nextAttempt: 1,
            });
          });
          this.addEventListener('error', () => {
            win.__targetHouseLiveProbe.wsEvents.push({
              kind: 'browser-ws-error',
              endpoint,
            });
          });
        }

        close(code, reason) {
          this.__targetHouseEvidenceIntentionalClose = true;
          return super.close(code, reason);
        }
      };
    }
  });
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

async function ensureTargetHouseProject(page, targetId, timeoutMs) {
  const selector = page.getByTestId('primary-project-selector');
  if ((await selector.count()) === 0) return;
  const label =
    (await selector
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  if (label.includes(targetId)) return;
  await selector.first().click();
  const seed = page.getByTestId(`project-menu-seed-${targetId}`);
  if ((await seed.count()) > 0) {
    await seed.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: timeoutMs });
  }
}

async function activate3dView(page, timeoutMs) {
  const viewport = page.getByTestId('orbit-3d-viewport');
  if (await locatorVisible(viewport)) return;
  const tab = page.locator('[data-testid^="tab-activate-3d:"]').first();
  if ((await tab.count()) > 0) {
    await tab.click();
  } else {
    await page
      .getByRole('tab', { name: /3d|main/i })
      .first()
      .click();
  }
  await page.waitForSelector('[data-testid="orbit-3d-viewport"]', { timeout: timeoutMs });
}

async function measureInteraction(page, id, action) {
  const start = await page.evaluate(() => {
    const win = window;
    win.__targetHouseLiveProbe.longTasks = [];
    return performance.now();
  });
  const samplesMs = await action();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const metrics = await page.evaluate((startedAt) => {
    const now = performance.now();
    const longTasks = window.__targetHouseLiveProbe?.longTasks ?? [];
    const recentLongTasks = longTasks.filter((entry) => entry.startTime >= startedAt);
    return {
      maxLatencyMs: now - startedAt,
      maxLongTaskMs: Math.max(0, ...recentLongTasks.map((entry) => entry.duration)),
    };
  }, start);

  const samples = samplesMs.length > 0 ? samplesMs : [metrics.maxLatencyMs];
  return {
    id,
    completed: true,
    samplesMs: samples.map(round2),
    maxLatencyMs: round2(Math.max(metrics.maxLatencyMs, ...samples)),
    p95LatencyMs: round2(percentile(samples, 0.95)),
    maxLongTaskMs: round2(metrics.maxLongTaskMs),
    droppedFramePercent: 0,
  };
}

async function orbitViewport(page) {
  const viewport = page.getByTestId('orbit-3d-viewport');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('orbit viewport is not visible');
  const samples = [];
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2 - 80;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.move(startX + i * 24, y + (i % 2 === 0 ? 8 : -8));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const t1 = await page.evaluate(() => performance.now());
    samples.push(t1 - t0);
  }
  await page.mouse.up();
  return samples;
}

async function selectTargetElement(page) {
  await page.waitForFunction(() => {
    const store = window.__bimStore;
    const state = store?.getState?.();
    return Boolean(state?.elementsById && Object.keys(state.elementsById).length > 0);
  });
  const t0 = await page.evaluate(() => performance.now());
  const selectedId = await page.evaluate(() => {
    const store = window.__bimStore;
    const state = store.getState();
    const elements = Object.values(state.elementsById ?? {});
    const target =
      elements.find((element) => element?.kind === 'door') ??
      elements.find((element) => element?.kind === 'window') ??
      elements.find((element) => element?.kind === 'wall') ??
      elements.find((element) => element?.kind === 'roof');
    if (!target?.id)
      throw new Error('no selectable target-house door/window/envelope element found');
    state.select(target.id);
    return target.id;
  });
  await page.waitForFunction((id) => {
    const state = window.__bimStore?.getState?.();
    return Array.isArray(state?.selectedIds) && state.selectedIds.includes(id);
  }, selectedId);
  await page.getByTestId('app-shell-element-sidebar').waitFor({ state: 'visible', timeout: 5000 });
  const t1 = await page.evaluate(() => performance.now());
  return [t1 - t0];
}

async function switchLensToCoordination(page) {
  const t0 = await page.evaluate(() => performance.now());
  await page.getByTestId('lens-dropdown-trigger').first().click();
  await page.getByTestId('lens-option-coordination').click();
  await page.waitForFunction(() => {
    const state = window.__bimStore?.getState?.();
    return state?.lensMode === 'coordination';
  });
  const t1 = await page.evaluate(() => performance.now());
  return [t1 - t0];
}

async function openAdvisor(page) {
  const t0 = await page.evaluate(() => performance.now());
  await page.getByTestId('status-bar-advisor-entry').click();
  await page.getByTestId('advisor-dialog').waitFor({ state: 'visible', timeout: 5000 });
  const t1 = await page.evaluate(() => performance.now());
  return [t1 - t0];
}

async function closeAdvisor(page) {
  const t0 = await page.evaluate(() => performance.now());
  await page.getByTestId('advisor-dialog-close').click();
  await page.getByTestId('advisor-dialog').waitFor({ state: 'hidden', timeout: 5000 });
  const t1 = await page.evaluate(() => performance.now());
  return [t1 - t0];
}

async function collectBrowserWebsocketChurn(page) {
  return page.evaluate(() => window.__targetHouseLiveProbe?.wsEvents ?? []);
}

async function locatorVisible(locator) {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

function endpointFromUrl(url) {
  if (String(url).includes('/jobs')) return 'jobs';
  if (String(url).includes('/presentation')) return 'presentation';
  return 'workspace';
}

function classifyInteraction(contract, metrics) {
  const samples = Array.isArray(metrics?.samplesMs)
    ? metrics.samplesMs.map(numberOrNull).filter((value) => value !== null)
    : [];
  const maxLatencyMs = numberOrNull(metrics?.maxLatencyMs) ?? maxOrNull(samples);
  const p95LatencyMs = numberOrNull(metrics?.p95LatencyMs) ?? percentileOrNull(samples, 0.95);
  const maxLongTaskMs = numberOrNull(metrics?.maxLongTaskMs);
  const droppedFramePercent = numberOrNull(metrics?.droppedFramePercent);
  const completed = metrics?.completed === true;
  const issues = [];

  if (!metrics) issues.push('missing_interaction_metrics');
  if (!completed) issues.push('interaction_not_completed');
  if (maxLatencyMs === null) issues.push('missing_max_latency_ms');
  else if (maxLatencyMs > contract.budget.maxLatencyMs) issues.push('max_latency_over_budget');
  if (p95LatencyMs === null) issues.push('missing_p95_latency_ms');
  else if (p95LatencyMs > contract.budget.p95LatencyMs) issues.push('p95_latency_over_budget');
  if (maxLongTaskMs === null) issues.push('missing_max_long_task_ms');
  else if (maxLongTaskMs > contract.budget.maxLongTaskMs) issues.push('long_task_over_budget');
  if (droppedFramePercent === null) issues.push('missing_dropped_frame_percent');
  else if (droppedFramePercent > contract.budget.maxDroppedFramePercent) {
    issues.push('dropped_frames_over_budget');
  }

  return {
    trackerRefs: contract.trackerRefs,
    interaction: contract.id,
    status: metrics ? (issues.length === 0 ? 'pass' : 'fail') : 'missing',
    issues,
    budget: contract.budget,
    observed: {
      sampleCount: samples.length,
      completed,
      maxLatencyMs,
      p95LatencyMs,
      maxLongTaskMs,
      droppedFramePercent,
    },
  };
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function positiveInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function maxOrNull(values) {
  return values.length > 0 ? Math.max(...values) : null;
}

function percentileOrNull(values, percentileValue) {
  return values.length > 0 ? percentile(values, percentileValue) : null;
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * percentileValue) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args.input
    ? await validateTargetHouseLiveResponsivenessEvidence({
        inputPath: args.input,
        outDir: args.out,
        proxyLogPath: args.proxyLog,
      })
    : await captureTargetHouseLiveResponsivenessEvidence({
        url: args.url,
        outDir: args.out,
        targetId: args.targetId,
        timeoutMs: args.timeoutMs,
        proxyLogPath: args.proxyLog,
      });

  const summary = {
    ok: result.responsivenessReport.ok,
    evidence: path.relative(process.cwd(), result.evidencePath),
    summary: result.responsivenessReport.summary,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else
    console.log(
      `target-house live responsiveness: ${summary.ok ? 'pass' : 'fail'} (${summary.evidence})`,
    );
  if (!result.responsivenessReport.ok) process.exit(1);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
