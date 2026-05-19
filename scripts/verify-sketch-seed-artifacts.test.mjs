import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  gitHeadMismatchAllowance,
  isPostEvidenceOnlyPath,
} from './verify-sketch-seed-artifacts.mjs';

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value, 'utf8');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function makeMethodologySeedFixture({ complete = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skb-methodology-'));
  const seed = 'methodology-seed';
  const artifact = path.join(root, seed);
  const bundleText = `${JSON.stringify(
    {
      commands: [
        { id: 'wall-main', type: 'createWall', elementId: 'wall-main' },
        { id: 'roof-main', type: 'createRoof', elementId: 'roof-main' },
      ],
    },
    null,
    2,
  )}\n`;
  await writeText(path.join(artifact, 'bundle.json'), bundleText);
  await writeJson(path.join(artifact, 'manifest.json'), {
    schemaVersion: 'bim-ai.seed-artifact.v1',
    name: seed,
    bundle: 'bundle.json',
    bundleSha256: sha256Text(bundleText),
    commandCount: 2,
  });

  const live = path.join(artifact, 'evidence', 'live-run-current');
  await writeJson(path.join(live, 'tolerance-ledger.json'), {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    ok: true,
    summary: { findingCount: 0, toleranceCount: 0, blockingFindingCount: 0, incompleteToleranceCount: 0 },
  });
  await writeJson(path.join(live, 'export-validation.json'), {
    schemaVersion: 'sketch.exchange-validation.v1',
    ok: true,
    summary: { passCount: 1, warningCount: 0, errorCount: 0 },
  });

  const phase = path.join(artifact, 'evidence', 'phase-1');
  const artifactNames = [
    'assumption-ledger.json',
    'source-feature-map.json',
    'agent-loop-packet.json',
    'renderer-diagnostics.json',
    'integrity-diagnostics.json',
    'export-validation.json',
    'tolerance-ledger.json',
    'screenshot-manifest.json',
  ];
  await writeJson(path.join(phase, 'phase-packet.json'), {
    schemaVersion: 'sketch-to-bim.phase-packet.v1',
    ok: true,
    evidence: Object.fromEntries(artifactNames.map((name) => [name, name])),
  });
  if (complete) {
    await writeJson(path.join(phase, 'assumption-ledger.json'), {
      schemaVersion: 'sketch-to-bim.assumption-ledger.v1',
      ok: true,
      summary: { assumptionCount: 1, incompleteAssumptionCount: 0, unresolvedContestableCount: 0 },
      assumptions: [{ id: 'a1', text: 'Scale from brief.', sourceRefs: ['brief:1'] }],
    });
  }
  await writeJson(path.join(phase, 'source-feature-map.json'), {
    schemaVersion: 'sketch-to-bim.source-feature-map.v1',
    ok: true,
    summary: { featureCount: 1, mappedFeatureCount: 1, incompleteFeatureCount: 0 },
    features: [{ featureId: 'main_wall', sourceRefs: ['sketch:front'], commandRefs: [{ commandId: 'wall-main' }] }],
  });
  await writeJson(path.join(phase, 'agent-loop-packet.json'), {
    schemaVersion: 'sketch-to-bim.agent-loop-packet.v1',
    summary: { findingCount: 0, blockingFindingCount: 0, untracedFindingCount: 0 },
    findings: [],
  });
  for (const fileName of [
    'renderer-diagnostics.json',
    'integrity-diagnostics.json',
    'export-validation.json',
    'tolerance-ledger.json',
  ]) {
    await writeJson(path.join(phase, fileName), { ok: true, summary: {} });
  }
  await writeJson(path.join(phase, 'screenshot-manifest.json'), {
    schemaVersion: 'sketch-to-bim-screenshot-manifest.v0',
    captures: [{ viewId: 'main', screenshotPath: 'main.png' }],
  });
  return { root, seed };
}

function runVerifier(root, seed) {
  return spawnSync(
    process.execPath,
    [
      'scripts/verify-sketch-seed-artifacts.mjs',
      '--root',
      root,
      '--seed',
      seed,
      '--require-methodology-gates',
      '--no-golden-requirements',
    ],
    { encoding: 'utf8' },
  );
}

const summary = {
  bundlePath: 'seed-artifacts/target-house-1/bundle.json',
  irPath: 'seed-artifacts/target-house-1/evidence/sketch-ir.json',
  capabilitiesPath: 'spec/sketch-to-bim-capability-matrix.json',
  rendererSupportMatrixPath: 'spec/generated/renderer-support-matrix.md',
  seedSourceFiles: [
    'seed-artifacts/target-house-1/manifest.json',
    'seed-artifacts/target-house-1/bundle.json',
    'seed-artifacts/target-house-1/evidence/target-house-1.recipe.json',
  ],
  targetSpecFiles: [
    'spec/generated/target-house-1-required-features.json',
    'spec/target-house/target-house-1-acceptance-checklist.md',
  ],
  advisorRuleFiles: [
    'app/bim_ai/constructability_report.py',
    'app/bim_ai/domain_integrity.py',
    'app/bim_ai/room_access_integrity.py',
  ],
};

test('post-evidence allowance covers evidence, tests, and digest-tracked source files', () => {
  const artifactDir = 'seed-artifacts/target-house-1';

  assert.equal(
    isPostEvidenceOnlyPath('seed-artifacts/target-house-1/evidence/live-run-current/snapshot.json', {
      artifactDir,
      summary,
    }),
    true,
  );
  assert.equal(
    isPostEvidenceOnlyPath('app/bim_ai/room_access_integrity.py', { artifactDir, summary }),
    true,
  );
  assert.equal(
    isPostEvidenceOnlyPath('spec/generated/renderer-support-matrix.md', { artifactDir, summary }),
    true,
  );
  assert.equal(
    isPostEvidenceOnlyPath('spec/target-house/target-house-1-acceptance-checklist.md', {
      artifactDir,
      summary,
    }),
    true,
  );
  assert.equal(
    isPostEvidenceOnlyPath('app/tests/test_room_access_integrity.py', { artifactDir, summary }),
    true,
  );
  assert.equal(
    isPostEvidenceOnlyPath('app/bim_ai/routes_api.py', { artifactDir, summary }),
    false,
  );
});

test('gitHead mismatch is allowed only when current content digests cover following commits', () => {
  const allowed = gitHeadMismatchAllowance({
    recordedHead: 'a'.repeat(40),
    currentHead: 'b'.repeat(40),
    changedFiles: [
      'seed-artifacts/target-house-1/evidence/live-run-current/tool-run-summary.json',
      'app/bim_ai/domain_integrity.py',
      'scripts/verify-sketch-seed-artifacts.test.mjs',
    ],
    summary,
    artifactDir: 'seed-artifacts/target-house-1',
    contentChecksMatch: true,
  });

  assert.equal(allowed.allowed, true);

  const disallowed = gitHeadMismatchAllowance({
    recordedHead: 'a'.repeat(40),
    currentHead: 'b'.repeat(40),
    changedFiles: ['app/bim_ai/routes_api.py'],
    summary,
    artifactDir: 'seed-artifacts/target-house-1',
    contentChecksMatch: true,
  });

  assert.equal(disallowed.allowed, false);
  assert.equal(disallowed.reason, 'post_evidence_source_changes');
});

test('methodology seed gate fails incomplete phase evidence', async () => {
  const { root, seed } = await makeMethodologySeedFixture({ complete: false });
  const proc = runVerifier(root, seed);

  assert.notEqual(proc.status, 0);
  const payload = JSON.parse(proc.stdout);
  const codes = payload.results.flatMap((result) => result.findings.map((finding) => finding.code));
  assert.ok(codes.includes('methodology_assumption_ledger_missing'));
});

test('methodology seed gate accepts complete traceability and rehearsal artifacts', async () => {
  const { root, seed } = await makeMethodologySeedFixture({ complete: true });
  const proc = runVerifier(root, seed);

  assert.equal(proc.status, 0, proc.stderr || proc.stdout);
  const payload = JSON.parse(proc.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.results[0].ok, true);
});
