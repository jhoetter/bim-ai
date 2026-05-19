import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION,
  buildRendererDiagnosticsEvidenceManifest,
  evaluateRendererDiagnosticsEvidenceStaleness,
  evaluateRendererDiagnosticsForSketchAcceptance,
  normalizeRendererDiagnosticsEvidence,
  validateRendererDiagnosticsEvidenceManifest,
} from './lib/renderer-diagnostics-evidence.mjs';

function requiredFeatures() {
  return [
    {
      featureId: 'roof_terrace_cutout',
      requiredElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
      mappedElementIds: ['hf-roof-main', 'hf-roof-court-opening'],
    },
    {
      featureId: 'front_loggia',
      requiredElementIds: ['hf-front-loggia-floor'],
      mappedElementIds: ['hf-front-loggia-floor'],
    },
  ];
}

test('normalizes renderer diagnostics packets into evidence manifests', () => {
  const manifest = normalizeRendererDiagnosticsEvidence({
    gitHead: 'abc123',
    modelRevision: 42,
    rendererBuild: 'viewport-dev-20260519',
    supportMatrixDigest: 'rsm-00000001',
    viewId: 'roof_court_evidence',
    diagnostics: [
      {
        ruleId: 'renderer_unsupported_cut',
        code: 'renderer.roof_opening.unsupported',
        severity: 'error',
        issueClass: 'renderer-unsupported',
        rendererArea: 'boolean-cut',
        feature: 'roof-opening',
        featureIds: ['roof_terrace_cutout'],
        elementIds: ['hf-roof-main', 'hf-roof-court-opening'],
        message: 'Asymmetric roof opening cut was not rendered.',
        trackerItems: ['BIR-I04', 'BIR-M04'],
      },
    ],
  });

  const validation = validateRendererDiagnosticsEvidenceManifest(manifest);

  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
  assert.equal(manifest.schemaVersion, RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION);
  assert.equal(manifest.context.gitHead, 'abc123');
  assert.equal(manifest.context.modelRevision, '42');
  assert.equal(manifest.context.rendererBuild, 'viewport-dev-20260519');
  assert.deepEqual(manifest.viewIds, ['roof_court_evidence']);
  assert.deepEqual(manifest.featureIds, ['roof_terrace_cutout']);
  assert.deepEqual(manifest.elementIds, ['hf-roof-court-opening', 'hf-roof-main']);
  assert.equal(manifest.summary.blockingCandidates, 1);
});

test('blocks sketch acceptance when required feature has renderer unsupported diagnostic', () => {
  const manifest = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'viewport-dev-20260519',
    supportMatrixDigest: 'rsm-00000001',
    diagnostics: [
      {
        ruleId: 'renderer_unsupported_cut',
        code: 'renderer.roof_opening.unsupported',
        severity: 'error',
        issueClass: 'renderer-unsupported',
        rendererArea: 'boolean-cut',
        feature: 'roof-opening',
        featureIds: ['roof_terrace_cutout'],
        elementIds: ['hf-roof-main'],
        viewId: 'roof_court_evidence',
        message: 'Roof court opening could not be cut in the current viewport renderer.',
      },
    ],
  });

  const result = evaluateRendererDiagnosticsForSketchAcceptance(manifest, {
    requiredFeatures: requiredFeatures(),
  });

  assert.equal(result.blocked, true);
  assert.equal(result.blockingDiagnostics.length, 1);
  assert.equal(result.blockingDiagnostics[0].code, 'renderer.roof_opening.unsupported');
  assert.ok(
    result.staleReasons.some(
      (entry) => entry.code === 'required_feature_renderer_diagnostic_blocking',
    ),
  );
  const roofFeature = result.featureResults.find(
    (entry) => entry.featureId === 'roof_terrace_cutout',
  );
  assert.equal(roofFeature.blocked, true);
});

test('does not block sketch acceptance for unrelated renderer diagnostics', () => {
  const manifest = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'viewport-dev-20260519',
    supportMatrixDigest: 'rsm-00000001',
    diagnostics: [
      {
        ruleId: 'renderer_unsupported_cut',
        code: 'renderer.railing.proxy_degraded',
        severity: 'error',
        issueClass: 'renderer-unsupported',
        rendererArea: 'viewport-3d',
        feature: 'railing-geometry',
        featureIds: ['rear_guardrail_detail'],
        elementIds: ['rear-guardrail-01'],
        viewId: 'rear_evidence',
        message: 'A non-required guardrail detail fell back to a simplified proxy.',
      },
    ],
  });

  const result = evaluateRendererDiagnosticsForSketchAcceptance(manifest, {
    requiredFeatures: requiredFeatures(),
  });

  assert.equal(result.validation.valid, true, JSON.stringify(result.validation.issues, null, 2));
  assert.equal(result.blocked, false);
  assert.equal(result.blockingDiagnostics.length, 0);
  assert.equal(result.nonBlockingDiagnostics.length, 1);
  assert.equal(result.nonBlockingDiagnostics[0].code, 'renderer.railing.proxy_degraded');
});

test('diagnostics can block by affected required element id even without feature id', () => {
  const manifest = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'viewport-dev-20260519',
    supportMatrixDigest: 'rsm-00000001',
    diagnostics: [
      {
        ruleId: 'renderer_failed_cut',
        code: 'renderer.wall_cut.failed',
        severity: 'error',
        issueClass: 'renderer-failed',
        rendererArea: 'boolean-cut',
        feature: 'wall-cut',
        elementIds: ['hf-front-loggia-floor'],
        viewId: 'front_loggia_evidence',
        message: 'Loggia feature evidence could not be rendered cleanly.',
      },
    ],
  });

  const result = evaluateRendererDiagnosticsForSketchAcceptance(manifest, {
    requiredFeatures: requiredFeatures(),
  });
  const loggiaFeature = result.featureResults.find((entry) => entry.featureId === 'front_loggia');

  assert.equal(result.blocked, true);
  assert.equal(loggiaFeature.blocked, true);
  assert.equal(loggiaFeature.blockingDiagnostics[0].code, 'renderer.wall_cut.failed');
});

test('staleness detects renderer evidence context drift', () => {
  const manifest = buildRendererDiagnosticsEvidenceManifest({
    gitHead: 'abc123',
    modelRevision: '42',
    rendererBuild: 'viewport-dev-20260519',
    supportMatrixDigest: 'rsm-00000001',
    diagnostics: [],
  });

  const staleness = evaluateRendererDiagnosticsEvidenceStaleness(manifest, {
    currentContext: {
      gitHead: 'def456',
      modelRevision: '43',
      rendererBuild: 'viewport-dev-20260520',
      supportMatrixDigest: 'rsm-00000002',
    },
  });

  const codes = staleness.staleReasons.map((entry) => entry.code);
  assert.equal(staleness.stale, true);
  assert.ok(codes.includes('git_head_changed'));
  assert.ok(codes.includes('model_revision_changed'));
  assert.ok(codes.includes('renderer_build_changed'));
  assert.ok(codes.includes('support_matrix_digest_changed'));
});
