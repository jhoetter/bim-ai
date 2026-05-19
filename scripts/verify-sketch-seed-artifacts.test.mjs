import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gitHeadMismatchAllowance,
  isPostEvidenceOnlyPath,
} from './verify-sketch-seed-artifacts.mjs';

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
