import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runBenchmark } from './two-storey-stair.mjs';

test('two-storey stair benchmark validates offline semantic fixture', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'two-storey-stair-'));
  const exitCode = await runBenchmark(['--mode', 'offline', '--out-dir', outDir]);
  assert.equal(exitCode, 0);

  const result = JSON.parse(await fs.readFile(path.join(outDir, 'benchmark-result.json'), 'utf8'));
  assert.equal(result.ok, true);
  assert.equal(result.semanticDiff.ok, true);
  assert.deepEqual(result.semanticDiff.diff, []);
  assert.equal(result.semanticSummary.levels.count, 2);
  assert.equal(result.semanticSummary.walls.total, 12);
  assert.equal(result.semanticSummary.stairs.count, 1);
  assert.equal(result.semanticSummary.openings.slabOpenings, 1);
  assert.equal(result.semanticSummary.openings.shaftOpenings, 1);
  assert.equal(result.semanticSummary.railings.hostedOnStairs, 1);
  assert.equal(result.semanticSummary.views.plan, 2);
  assert.equal(result.semanticSummary.views.section, 1);
  assert.deepEqual(result.executionEvidence.rawBundleOnlyCapabilities, [
    'createStair',
    'createSlabOpening',
    'createRailing',
  ]);
});

test('two-storey stair benchmark writes conservative advisor visual export hooks', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'two-storey-stair-hooks-'));
  await runBenchmark(['--mode', 'offline', '--out-dir', outDir]);

  const advisor = JSON.parse(
    await fs.readFile(path.join(outDir, 'advisor-validation.json'), 'utf8'),
  );
  const visual = JSON.parse(await fs.readFile(path.join(outDir, 'visual-evidence.json'), 'utf8'));
  const exportEvidence = JSON.parse(
    await fs.readFile(path.join(outDir, 'export-evidence.json'), 'utf8'),
  );

  assert.equal(advisor.status, 'hook-declared-not-collected');
  assert.equal(visual.status, 'hook-declared-not-collected');
  assert.equal(exportEvidence.status, 'hook-declared-not-collected');
  assert.ok(visual.requiredViewIds.includes('tsh-section-stair'));
  assert.equal(exportEvidence.requiredGeometryCounts.stair, 1);
  assert.equal(exportEvidence.requiredGeometryCounts.railing, 1);
  assert.equal(exportEvidence.requiredGeometryCounts.slab_opening, 1);
});
