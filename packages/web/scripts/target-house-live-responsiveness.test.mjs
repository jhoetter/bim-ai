import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION,
  TARGET_HOUSE_LIVE_INTERACTION_CONTRACT,
  classifyTargetHouseLiveResponsiveness,
  extractWebsocketChurnFromText,
  stateHasSelectedElement,
  targetHouseLiveResponsivenessContract,
  validateTargetHouseLiveResponsivenessEvidence,
  validateLiveBrowserProof,
} from './target-house-live-responsiveness.mjs';

function passingInteraction(id) {
  return {
    id,
    completed: true,
    samplesMs: [12, 18, 24],
    maxLongTaskMs: 10,
    droppedFramePercent: 0,
  };
}

test('target-house live browser contract covers required Wave 13-A interactions', () => {
  const contract = targetHouseLiveResponsivenessContract();

  assert.deepEqual(
    TARGET_HOUSE_LIVE_INTERACTION_CONTRACT.map((row) => row.id),
    ['orbit', 'select', 'lens-switch', 'advisor-open', 'advisor-close'],
  );
  assert.equal(
    contract.interactions.every((row) => row.trackerRefs.includes('BIR-L02')),
    true,
  );
  assert.equal(
    contract.interactions.every((row) => row.trackerRefs.includes('BIR-N11')),
    true,
  );
  assert.deepEqual(contract.websocketChurnPolicy, {
    benignViteProxySocketCodes: ['EPIPE', 'ECONNRESET'],
    actionableAppCloseCodes: [4403, 4404],
    exhaustedReconnectBudget: 'actionable',
    unknownChurn: 'actionable',
  });
});

test('validator accepts complete interaction evidence and benign websocket churn', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'target-house-live-ok-'));
  const inputPath = path.join(tmp, 'input.json');
  const logPath = path.join(tmp, 'vite.log');
  await fs.writeFile(
    inputPath,
    `${JSON.stringify({
      targetId: 'target-house-1',
      interactions: TARGET_HOUSE_LIVE_INTERACTION_CONTRACT.map((row) => passingInteraction(row.id)),
      websocketChurn: [
        { kind: 'app-ws-close', endpoint: 'workspace', closeCode: 1006, nextAttempt: 1 },
      ],
    })}\n`,
    'utf8',
  );
  await fs.writeFile(
    logPath,
    'http proxy error: write EPIPE\nhttp proxy error: read ECONNRESET\n',
    'utf8',
  );

  const result = await validateTargetHouseLiveResponsivenessEvidence({
    inputPath,
    outDir: tmp,
    proxyLogPath: logPath,
  });

  assert.equal(result.responsivenessReport.ok, true);
  assert.equal(result.responsivenessReport.summary.interactionPassCount, 5);
  assert.equal(result.responsivenessReport.summary.actionableChurnCount, 0);
  assert.equal(result.responsivenessReport.summary.benignChurnCount, 3);
  const written = JSON.parse(await fs.readFile(result.evidencePath, 'utf8'));
  assert.equal(written.schemaVersion, TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION);
  assert.equal(written.responsivenessReport.schemaVersion, 'target-house-live-responsiveness.v1');
  assert.equal(written.liveBrowserProof.ok, false);
  assert.ok(written.liveBrowserProof.blockerCodes.includes('live_browser_capture_mode_missing'));
});

test('live browser proof requires Playwright capture hooks, browser metadata, and URL', () => {
  const accepted = validateLiveBrowserProof({
    schemaVersion: TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION,
    captureMode: 'playwright-live-browser',
    url: 'http://127.0.0.1:2000',
    capturedAtEpochMs: 1_800_000_000_000,
    browser: { engine: 'chromium' },
    proofHooks: {
      appShell: true,
      orbitViewport: true,
      viewCube: true,
      inspector: true,
      advisorEntry: true,
    },
  });

  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.blockerCodes, []);

  const importedMetrics = validateLiveBrowserProof({
    schemaVersion: TARGET_HOUSE_LIVE_BROWSER_EVIDENCE_SCHEMA_VERSION,
    captureMode: 'validated-input',
    proofHooks: { appShell: true },
  });

  assert.equal(importedMetrics.ok, false);
  assert.deepEqual(importedMetrics.missingHookIds, [
    'orbitViewport',
    'viewCube',
    'inspector',
    'advisorEntry',
  ]);
  assert.ok(importedMetrics.blockerCodes.includes('live_browser_capture_mode_missing'));
  assert.ok(importedMetrics.blockerCodes.includes('live_browser_proof_hooks_missing'));
});

test('selection helper accepts primary selectedId and multi-selected ids', () => {
  assert.equal(stateHasSelectedElement({ selectedId: 'door-1', selectedIds: [] }, 'door-1'), true);
  assert.equal(
    stateHasSelectedElement({ selectedId: 'wall-1', selectedIds: ['door-1'] }, 'door-1'),
    true,
  );
  assert.equal(stateHasSelectedElement({ selectedId: 'wall-1', selectedIds: [] }, 'door-1'), false);
});

test('validator blocks missing metrics and actionable websocket churn', () => {
  const report = classifyTargetHouseLiveResponsiveness({
    targetId: 'target-house-1',
    interactions: [passingInteraction('orbit')],
    websocketChurn: [
      { kind: 'vite-proxy-error', code: 'ECONNREFUSED', count: 2 },
      { kind: 'app-ws-close', endpoint: 'presentation', closeCode: 4403, nextAttempt: 1 },
    ],
  });

  assert.equal(report.ok, false);
  assert.equal(report.summary.interactionPassCount, 1);
  assert.equal(report.summary.interactionFailCount, 4);
  assert.equal(report.summary.actionableChurnCount, 3);
  assert.deepEqual(
    report.interactionRows.filter((row) => row.status === 'missing').map((row) => row.interaction),
    ['select', 'lens-switch', 'advisor-open', 'advisor-close'],
  );
});

test('intentional browser websocket cleanup errors are benign', () => {
  const report = classifyTargetHouseLiveResponsiveness({
    targetId: 'target-house-1',
    interactions: TARGET_HOUSE_LIVE_INTERACTION_CONTRACT.map((row) => passingInteraction(row.id)),
    websocketChurn: [{ kind: 'browser-ws-error', endpoint: 'workspace', intentional: true }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.summary.actionableChurnCount, 0);
  assert.deepEqual(
    report.websocketChurnRows.map((row) => row.classification),
    ['benign'],
  );
});

test('proxy log extraction aggregates Vite websocket socket error codes', () => {
  assert.deepEqual(
    extractWebsocketChurnFromText(`
      ws proxy error EPIPE
      ws proxy error ECONNRESET
      ws proxy error EPIPE
      ws proxy error ETIMEDOUT
    `),
    [
      { kind: 'vite-proxy-error', code: 'EPIPE', count: 2 },
      { kind: 'vite-proxy-error', code: 'ECONNRESET', count: 1 },
      { kind: 'vite-proxy-error', code: 'ETIMEDOUT', count: 1 },
    ],
  );
});
