import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRendererDiagnosticsEvidenceManifest } from './lib/renderer-diagnostics-evidence.mjs';
import { evaluatePhaseAcceptanceEvidence } from './lib/phase-acceptance-evidence.mjs';
import { buildSketchAcceptanceProvenanceManifest } from './lib/sketch-acceptance-provenance.mjs';

function phaseManifest(overrides = {}) {
  return buildSketchAcceptanceProvenanceManifest({
    gitHead: 'abc123',
    modelId: 'sample-house-1',
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
        sourceRefs: ['spec/samples/sample-house-1.png#roof-terrace'],
        requiredElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
        mappedElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
        evidencePaths: [{ path: 'evidence/roof-terrace.png' }],
        status: 'verified',
      },
    ],
    evidence: {
      screenshots: [],
      reports: [],
      exports: [],
      manifests: [],
    },
    ...overrides,
  });
}

test('phase evidence blocks when renderer unsupported affects a required feature', async () => {
  const manifest = phaseManifest();
  const rendererDiagnosticsEvidence = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'renderer-v1',
    supportMatrixDigest: 'sha256:support-matrix-v1',
    diagnostics: [
      {
        diagnosticId: 'rd-1',
        severity: 'error',
        code: 'unsupported-boolean-cut',
        ruleId: 'renderer_unsupported_cut',
        issueClass: 'renderer-unsupported',
        featureIds: ['roof_terrace_cutout'],
        elementIds: ['hf-roof-court-opening'],
      },
    ],
  });

  const result = await evaluatePhaseAcceptanceEvidence(manifest, {
    rendererDiagnosticsEvidence,
  });

  assert.equal(result.blocked, true);
  assert.equal(result.rendererDiagnostics.blocked, true);
  assert.ok(
    result.blockReasons.some(
      (entry) => entry.code === 'required_feature_renderer_diagnostic_blocking',
    ),
  );
});

test('phase evidence blocks when BIM integrity reports a P0 error on a required feature', async () => {
  const manifest = phaseManifest();
  const result = await evaluatePhaseAcceptanceEvidence(manifest, {
    bimIntegrityEvidence: {
      diagnostics: [
        {
          diagnosticId: 'bir-1',
          severity: 'error',
          priority: 'P0',
          code: 'roof-opening-outside-host',
          featureIds: ['roof_terrace_cutout'],
          elementIds: ['hf-roof-court-opening'],
        },
      ],
    },
  });

  assert.equal(result.blocked, true);
  assert.equal(result.bimIntegrity.blocked, true);
  assert.ok(
    result.blockReasons.some((entry) => entry.code === 'required_feature_bim_integrity_blocking'),
  );
});

test('phase evidence blocks when current head, model, or capability hash is stale', async () => {
  const result = await evaluatePhaseAcceptanceEvidence(phaseManifest(), {
    currentContext: {
      gitHead: 'def456',
      modelRevision: '43',
      capabilityHash: 'sha256:capabilities-v2',
    },
  });

  const codes = result.blockReasons.map((entry) => entry.code);
  assert.equal(result.stale, true);
  assert.equal(result.blocked, true);
  assert.ok(codes.includes('git_head_changed'));
  assert.ok(codes.includes('model_revision_changed'));
  assert.ok(codes.includes('capability_hash_changed'));
});

test('phase evidence does not block on unrelated nonblocking warnings', async () => {
  const manifest = phaseManifest();
  const rendererDiagnosticsEvidence = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'renderer-v1',
    supportMatrixDigest: 'sha256:support-matrix-v1',
    diagnostics: [
      {
        diagnosticId: 'rd-warning',
        severity: 'warning',
        code: 'renderer-low-sample-count',
        ruleId: 'renderer_low_sample_count',
        issueClass: 'renderer-diagnostic',
        featureIds: ['unrelated_feature'],
      },
    ],
  });

  const result = await evaluatePhaseAcceptanceEvidence(manifest, {
    rendererDiagnosticsEvidence,
    bimIntegrityEvidence: {
      diagnostics: [
        {
          diagnosticId: 'bir-warning',
          severity: 'warning',
          priority: 'P2',
          code: 'unrelated-advisory',
          featureIds: ['unrelated_feature'],
        },
      ],
    },
  });

  assert.equal(result.stale, false);
  assert.equal(result.blocked, false);
  assert.equal(result.rendererDiagnostics.blocked, false);
  assert.equal(result.bimIntegrity.blocked, false);
});
