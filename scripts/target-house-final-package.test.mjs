import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import {
  buildTargetHouseFinalCloseoutManifest,
  buildTargetHousePerformanceEvidence,
  writeTargetHouseFinalPackage,
} from './target-house-final-package.mjs';
import { resolveTargetHouseSnapshotInput } from '../packages/cli/lib/target-house-package-inputs.mjs';

function gitHead() {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.resolve(new URL('..', import.meta.url).pathname),
    encoding: 'utf8',
  });
  assert.equal(proc.status, 0, proc.stderr);
  return proc.stdout.trim();
}

test('target-house performance evidence covers required BIR-N07 interactions', async () => {
  const evidence = await buildTargetHousePerformanceEvidence({ seed: 'target-house-1' });
  const snapshotInput = resolveTargetHouseSnapshotInput({
    repoRoot: path.resolve(new URL('..', import.meta.url).pathname),
    seed: 'target-house-1',
  });
  const expectedElementCount = Object.keys(snapshotInput.snapshot.elements).length;

  assert.equal(evidence.schemaVersion, 'target-house-performance-evidence.v1');
  assert.equal(evidence.generatedFrom.helperFormat, 'rendererCostProfile_v1');
  assert.equal(evidence.profile.format, 'rendererCostProfile_v1');
  assert.ok(
    ['fresh_live_snapshot', 'materialized_seed_bundle'].includes(
      evidence.generatedFrom.snapshotSource.kind,
    ),
  );
  assert.equal(evidence.profile.counts.elementCount, expectedElementCount);
  assert.ok(evidence.profile.counts.openingCount > 0);

  const byInteraction = new Map(evidence.interactions.map((row) => [row.interaction, row]));
  for (const interaction of ['orbit', 'select', 'lens-switch', 'advisor-open']) {
    const row = byInteraction.get(interaction);
    assert.ok(row, `missing ${interaction}`);
    assert.equal(row.accepted, true, `${interaction} must be within deterministic budget`);
    assert.notEqual(row.status, 'over_budget');
    assert.ok(row.estimatedMs > 0);
    assert.ok(row.budgetMs > 0);
  }
  assert.equal(evidence.summary.ok, true);
  assert.equal(evidence.summary.requiredInteractionCount, 4);
  assert.equal(evidence.summary.acceptedInteractionCount, 4);
});

test('target-house final package manifest ties head, source, evidence, tracker, tolerances, and gates', async () => {
  const manifest = await buildTargetHouseFinalCloseoutManifest({ seed: 'target-house-1' });

  assert.equal(manifest.schemaVersion, 'target-house-final-closeout-manifest.v1');
  assert.equal(manifest.git.head, gitHead());
  assert.equal(manifest.seedSource.bundleHashMatchesManifest, true);
  assert.ok(manifest.seedSource.sourceDigest.fileCount > 0);
  assert.equal(manifest.evidence.requiredEvidencePresent, true);
  assert.ok(
    ['fresh_live_snapshot', 'materialized_seed_bundle'].includes(
      manifest.evidence.snapshotSource.kind,
    ),
  );
  assert.equal(manifest.performanceEvidence.summary.ok, true);
  assert.equal(typeof manifest.tolerances.ok, 'boolean');
  assert.ok(manifest.tolerances.blockingFindingCount >= 0);
  assert.equal(manifest.tracker.rows['BIR-N07'].status, 'Partial');
  assert.equal(manifest.tracker.generatedRows['BIR-N07'].source, 'generated_section_rollup');
  assert.ok(manifest.tracker.generatedRows['BIR-N07'].sectionRollup.partial >= 0);
  assert.equal(manifest.tracker.generatedStatusIncludesTargetHouseSection, true);
  assert.equal(manifest.tracker.generatedStatusDigestSha256.length, 64);
  assert.equal(typeof manifest.acceptanceGates.ok, 'boolean');
  assert.equal(
    manifest.status.blockers.includes('live_evidence_freshness'),
    !manifest.evidence.liveEvidenceFresh,
  );
  assert.equal(
    manifest.status.ready,
    manifest.status.blockers.length === 0,
    'ready flag must be a pure function of blockers',
  );
});

test('target-house final package writes deterministic manifest and performance evidence', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'target-house-final-package-'));
  const result = await writeTargetHouseFinalPackage({ seed: 'target-house-1', outDir });

  assert.match(result.performancePath, /target-house-1-performance-evidence\.json$/);
  assert.match(result.manifestPath, /target-house-1-final-closeout-manifest\.json$/);

  const performance = JSON.parse(
    await fs.readFile(path.join(outDir, 'target-house-1-performance-evidence.json'), 'utf8'),
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(outDir, 'target-house-1-final-closeout-manifest.json'), 'utf8'),
  );
  assert.equal(performance.summary.ok, true);
  assert.equal(manifest.performanceEvidence.evidenceDigestSha256, performance.evidenceDigestSha256);
  assert.equal(manifest.manifestDigestSha256.length, 64);
  assert.equal(result.status, manifest.status.status);
});
