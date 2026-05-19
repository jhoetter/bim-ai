import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  SKETCH_ACCEPTANCE_LAYER,
  annotateSketchAcceptanceStaleness,
  buildSketchAcceptanceProvenanceManifest,
  evaluateSketchAcceptanceStaleness,
  validateSketchAcceptanceProvenanceManifest,
} from './lib/sketch-acceptance-provenance.mjs';

function validManifest(overrides = {}) {
  return buildSketchAcceptanceProvenanceManifest({
    gitHead: 'abc123',
    modelId: 'target-house-1',
    modelRevision: '42',
    phaseId: 'phase-03-envelope-openings',
    irHash: 'sha256:ir-v1',
    capabilityHash: 'sha256:capabilities-v1',
    advisorDigest: 'sha256:advisor-v1',
    ruleDigest: 'sha256:rules-v1',
    integrityDigest: 'sha256:integrity-v1',
    rendererDiagnosticsDigest: 'sha256:renderer-v1',
    supportMatrixDigest: 'sha256:support-matrix-v1',
    screenshotManifestHash: 'sha256:screenshot-manifest-v1',
    requiredFeatures: [
      {
        featureId: 'roof_terrace_cutout',
        title: 'Roof terrace cutout',
        phase: 'phase-03-envelope-openings',
        sourceRefs: ['spec/target-house/target-house-1.png#roof-terrace'],
        requiredElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
        mappedElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
        evidencePaths: [{ path: 'evidence/roof-terrace.png', viewId: 'roof_court_evidence' }],
        status: 'verified',
      },
    ],
    evidence: {
      screenshots: ['evidence/roof-terrace.png'],
      reports: ['evidence/advisor.json'],
      exports: ['evidence/model.ifc.json'],
      manifests: ['evidence/phase-manifest.json'],
    },
    ...overrides,
  });
}

test('sketch acceptance provenance manifest validates as separate from Advisor', () => {
  const manifest = validManifest();
  const result = validateSketchAcceptanceProvenanceManifest(manifest);

  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
  assert.equal(manifest.acceptanceLayer, SKETCH_ACCEPTANCE_LAYER);
  assert.equal(manifest.kind, 'sketch_acceptance_provenance_manifest');
  assert.equal(manifest.context.gitHead, 'abc123');
  assert.equal(manifest.context.modelRevision, '42');
  assert.equal(manifest.context.irHash, 'sha256:ir-v1');
  assert.equal(manifest.context.capabilityHash, 'sha256:capabilities-v1');
  assert.equal(manifest.context.advisorDigest, 'sha256:advisor-v1');
  assert.equal(manifest.context.ruleDigest, 'sha256:rules-v1');
  assert.equal(manifest.context.integrityDigest, 'sha256:integrity-v1');
  assert.equal(manifest.context.rendererDiagnosticsDigest, 'sha256:renderer-v1');
  assert.equal(manifest.context.supportMatrixDigest, 'sha256:support-matrix-v1');
  assert.equal(manifest.context.screenshotManifestHash, 'sha256:screenshot-manifest-v1');
});

test('validation rejects passing feature claims without element mapping or evidence', () => {
  const manifest = validManifest({
    requiredFeatures: [
      {
        featureId: 'loggia_recess',
        requiredElementIds: ['hf-loggia-opening'],
        mappedElementIds: [],
        evidencePaths: [],
        status: 'accepted',
      },
    ],
  });

  const result = validateSketchAcceptanceProvenanceManifest(manifest);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((entry) => entry.code === 'passing_feature_without_elements'));
  assert.ok(result.issues.some((entry) => entry.code === 'passing_feature_without_evidence'));
});

test('staleness detection compares current context digests and evidence paths', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-provenance-'));
  await fs.mkdir(path.join(dir, 'evidence'), { recursive: true });
  await fs.writeFile(path.join(dir, 'evidence/roof-terrace.png'), 'fake image bytes');
  await fs.writeFile(path.join(dir, 'evidence/advisor.json'), '{}\n');

  const manifest = validManifest();
  const result = await evaluateSketchAcceptanceStaleness(manifest, {
    rootDir: dir,
    checkEvidencePaths: true,
    currentContext: {
      gitHead: 'def456',
      modelRevision: '43',
      irHash: 'sha256:ir-v2',
      capabilityHash: 'sha256:capabilities-v1',
      advisorDigest: 'sha256:advisor-v1',
      ruleDigest: 'sha256:rules-v2',
      integrityDigest: 'sha256:integrity-v2',
      rendererDiagnosticsDigest: 'sha256:renderer-v2',
      supportMatrixDigest: 'sha256:support-matrix-v2',
      screenshotManifestHash: 'sha256:screenshot-manifest-v2',
    },
  });

  const codes = result.staleReasons.map((entry) => entry.code);
  assert.equal(result.stale, true);
  assert.ok(codes.includes('git_head_changed'));
  assert.ok(codes.includes('model_revision_changed'));
  assert.ok(codes.includes('ir_hash_changed'));
  assert.ok(codes.includes('rule_digest_changed'));
  assert.ok(codes.includes('integrity_digest_changed'));
  assert.ok(codes.includes('renderer_diagnostics_digest_changed'));
  assert.ok(codes.includes('support_matrix_digest_changed'));
  assert.ok(codes.includes('screenshot_manifest_hash_changed'));
  assert.ok(codes.includes('evidence_path_missing'));
});

test('feature evidence staleness can be annotated back onto the manifest', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-sketch-provenance-'));
  const manifest = validManifest({
    evidence: { screenshots: [], reports: [], exports: [], manifests: [] },
  });

  const staleness = await evaluateSketchAcceptanceStaleness(manifest, {
    rootDir: dir,
    checkEvidencePaths: true,
  });
  const annotated = annotateSketchAcceptanceStaleness(manifest, staleness);
  const feature = annotated.requiredFeatures[0];

  assert.equal(staleness.stale, true);
  assert.equal(feature.featureId, 'roof_terrace_cutout');
  assert.ok(
    feature.staleReasons.some((entry) => entry.code === 'feature_evidence_path_missing'),
  );
});
