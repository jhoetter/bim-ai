import { evaluateRendererDiagnosticsForSketchAcceptance } from './renderer-diagnostics-evidence.mjs';
import { evaluateSketchAcceptanceStaleness } from './sketch-acceptance-provenance.mjs';

const BIM_INTEGRITY_BLOCKING_PRIORITY = 'P0';
const BIM_INTEGRITY_BLOCKING_SEVERITY = 'error';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(asTrimmedString).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function pickFirstString(...values) {
  for (const value of values) {
    const stringValue = asTrimmedString(value);
    if (stringValue) return stringValue;
  }
  return '';
}

function staleReason(code, path, message, extra = {}) {
  return { code, path, message, ...extra };
}

function extractBimIntegrityDiagnostics(input) {
  if (Array.isArray(input)) return input;
  if (!isObject(input)) return [];
  if (Array.isArray(input.diagnostics)) return input.diagnostics;
  if (Array.isArray(input.integrityDiagnostics)) return input.integrityDiagnostics;
  if (Array.isArray(input.bimIntegrityDiagnostics)) return input.bimIntegrityDiagnostics;
  if (Array.isArray(input.findings)) return input.findings;
  if (Array.isArray(input.issues)) return input.issues;
  return [];
}

function normalizeBimIntegrityDiagnostic(rawDiagnostic, index) {
  const raw = isObject(rawDiagnostic) ? rawDiagnostic : {};
  const evidence = isObject(raw.evidence) ? raw.evidence : {};
  const code = pickFirstString(raw.code, raw.ruleId, raw.checkId, `bim.integrity.${index}`);

  return {
    diagnosticId: pickFirstString(raw.diagnosticId, raw.findingId, raw.id, `${code}#${index}`),
    severity: pickFirstString(raw.severity, raw.level, 'info').toLowerCase(),
    priority: pickFirstString(raw.priority, raw.impact, raw.rank).toUpperCase(),
    code,
    ruleId: pickFirstString(raw.ruleId, raw.checkId, code),
    featureIds: normalizeStringArray([
      ...normalizeStringArray(raw.featureIds),
      raw.featureId,
      raw.sketchFeatureId,
      raw.requiredFeatureId,
      evidence.featureId,
    ]),
    elementIds: normalizeStringArray([
      ...normalizeStringArray(raw.elementIds),
      raw.elementId,
      raw.hostElementId,
      raw.bimElementId,
      evidence.elementId,
    ]),
    message: pickFirstString(raw.message, raw.summary, 'BIM integrity diagnostic reported.'),
    source: pickFirstString(raw.source, evidence.source, 'bim-integrity'),
    details: isObject(raw.details) ? raw.details : {},
  };
}

function featureId(feature, index) {
  return pickFirstString(feature?.featureId, feature?.id, `required-feature-${index}`);
}

function featureElementIds(feature) {
  return normalizeStringArray([
    ...normalizeStringArray(feature?.requiredElementIds),
    ...normalizeStringArray(feature?.mappedElementIds),
    ...normalizeStringArray(feature?.elementIds),
  ]);
}

function setsIntersect(leftValues, rightValues) {
  const right = new Set(rightValues);
  return leftValues.some((value) => right.has(value));
}

function bimIntegrityDiagnosticAffectsFeature(diagnostic, feature, index) {
  const id = featureId(feature, index);
  if (diagnostic.featureIds.includes(id)) return true;
  return setsIntersect(diagnostic.elementIds, featureElementIds(feature));
}

function bimIntegrityDiagnosticIsBlocking(diagnostic) {
  return (
    diagnostic.priority === BIM_INTEGRITY_BLOCKING_PRIORITY &&
    diagnostic.severity === BIM_INTEGRITY_BLOCKING_SEVERITY
  );
}

export function evaluateBimIntegrityDiagnosticsForPhaseAcceptance(
  evidence,
  { requiredFeatures = [] } = {},
) {
  const diagnostics = extractBimIntegrityDiagnostics(evidence).map((entry, index) =>
    normalizeBimIntegrityDiagnostic(entry, index),
  );
  const featureResults = requiredFeatures.map((feature, index) => {
    const id = featureId(feature, index);
    const affectedDiagnostics = diagnostics.filter((diagnostic) =>
      bimIntegrityDiagnosticAffectsFeature(diagnostic, feature, index),
    );
    const blockingDiagnostics = affectedDiagnostics.filter(bimIntegrityDiagnosticIsBlocking);
    const staleReasons = blockingDiagnostics.map((diagnostic) =>
      staleReason(
        'required_feature_bim_integrity_blocking',
        `requiredFeatures.${id}`,
        `Required feature ${id} is affected by blocking BIM integrity diagnostic ${diagnostic.code}.`,
        {
          featureId: id,
          diagnosticId: diagnostic.diagnosticId,
          diagnosticCode: diagnostic.code,
          ruleId: diagnostic.ruleId,
          severity: diagnostic.severity,
          priority: diagnostic.priority,
          elementIds: diagnostic.elementIds,
        },
      ),
    );

    return {
      featureId: id,
      requiredElementIds: featureElementIds(feature),
      affectedDiagnostics,
      blockingDiagnostics,
      blocked: blockingDiagnostics.length > 0,
      staleReasons,
    };
  });

  const blockingDiagnostics = diagnostics.filter(bimIntegrityDiagnosticIsBlocking);
  const featureBlockingDiagnosticIds = new Set(
    featureResults.flatMap((entry) =>
      entry.blockingDiagnostics.map((diagnostic) => diagnostic.diagnosticId),
    ),
  );
  const packetStaleReasons = blockingDiagnostics
    .filter((diagnostic) => !featureBlockingDiagnosticIds.has(diagnostic.diagnosticId))
    .map((diagnostic) =>
      staleReason(
        'bim_integrity_diagnostic_blocking',
        'bimIntegrity.diagnostics',
        `Phase acceptance is affected by blocking BIM integrity diagnostic ${diagnostic.code}.`,
        {
          diagnosticId: diagnostic.diagnosticId,
          diagnosticCode: diagnostic.code,
          ruleId: diagnostic.ruleId,
          severity: diagnostic.severity,
          priority: diagnostic.priority,
          featureIds: diagnostic.featureIds,
          elementIds: diagnostic.elementIds,
        },
      ),
    );
  const blockingDiagnosticIds = new Set(blockingDiagnostics.map((entry) => entry.diagnosticId));

  return {
    blocked: blockingDiagnostics.length > 0,
    diagnostics,
    featureResults,
    blockingDiagnostics,
    nonBlockingDiagnostics: diagnostics.filter(
      (entry) => !blockingDiagnosticIds.has(entry.diagnosticId),
    ),
    staleReasons: [...featureResults.flatMap((entry) => entry.staleReasons), ...packetStaleReasons],
  };
}

export async function evaluatePhaseAcceptanceEvidence(
  manifest,
  {
    currentContext = {},
    rootDir = process.cwd(),
    checkEvidencePaths = false,
    rendererDiagnosticsEvidence = null,
    bimIntegrityEvidence = null,
    requiredFeatures = manifest?.requiredFeatures ?? [],
  } = {},
) {
  const sketchStaleness = await evaluateSketchAcceptanceStaleness(manifest, {
    currentContext,
    rootDir,
    checkEvidencePaths,
  });
  const rendererDiagnostics =
    rendererDiagnosticsEvidence == null
      ? null
      : evaluateRendererDiagnosticsForSketchAcceptance(rendererDiagnosticsEvidence, {
          requiredFeatures,
        });
  const bimIntegrity =
    bimIntegrityEvidence == null
      ? null
      : evaluateBimIntegrityDiagnosticsForPhaseAcceptance(bimIntegrityEvidence, {
          requiredFeatures,
        });

  const staleReasons = [
    ...sketchStaleness.staleReasons,
    ...Object.values(sketchStaleness.featureStaleReasons).flat(),
  ];
  const blockReasons = [
    ...staleReasons,
    ...(rendererDiagnostics?.staleReasons ?? []),
    ...(bimIntegrity?.staleReasons ?? []),
  ];

  return {
    stale: sketchStaleness.stale,
    blocked:
      sketchStaleness.stale ||
      Boolean(rendererDiagnostics?.blocked) ||
      Boolean(bimIntegrity?.blocked),
    staleReasons,
    blockReasons,
    sketchStaleness,
    rendererDiagnostics,
    bimIntegrity,
  };
}
