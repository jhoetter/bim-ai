import fs from 'node:fs/promises';
import path from 'node:path';

export const SKETCH_ACCEPTANCE_PROVENANCE_SCHEMA_VERSION =
  'sketch-acceptance-provenance.v1';
export const SKETCH_ACCEPTANCE_LAYER = 'sketch_acceptance';

export const REQUIRED_CONTEXT_KEYS = [
  'gitHead',
  'modelRevision',
  'irHash',
  'capabilityHash',
  'advisorDigest',
  'ruleDigest',
  'integrityDigest',
  'rendererDiagnosticsDigest',
];

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const FEATURE_STATUSES = new Set([
  'pending',
  'pass',
  'verified',
  'accepted',
  'fail',
  'blocked',
  'tolerated',
]);
const PASSING_FEATURE_STATUSES = new Set(['pass', 'verified', 'accepted']);
const LOCAL_PATH_SCHEMES = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(severity, code, pathValue, message) {
  return { severity, code, path: pathValue, message };
}

function asTrimmedString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(asTrimmedString).filter(Boolean))];
}

function normalizeEvidencePathEntry(entry) {
  if (typeof entry === 'string') return { path: entry };
  if (isObject(entry) && typeof entry.path === 'string') return { ...entry, path: entry.path };
  return null;
}

function normalizeEvidencePathEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeEvidencePathEntry).filter(Boolean);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function contextValue(context, key) {
  return asTrimmedString(context?.[key]);
}

function staleReason(code, pathValue, message, extra = {}) {
  return { code, path: pathValue, message, ...extra };
}

function contextChangedReason(key, previous, current) {
  const codeByKey = {
    gitHead: 'git_head_changed',
    modelRevision: 'model_revision_changed',
    irHash: 'ir_hash_changed',
    capabilityHash: 'capability_hash_changed',
    advisorDigest: 'advisor_digest_changed',
    ruleDigest: 'rule_digest_changed',
    integrityDigest: 'integrity_digest_changed',
    rendererDiagnosticsDigest: 'renderer_diagnostics_digest_changed',
  };
  return staleReason(
    codeByKey[key] ?? `${key}_changed`,
    `context.${key}`,
    `${key} changed since the sketch acceptance provenance manifest was produced.`,
    { previous, current },
  );
}

function isLocalEvidencePath(evidencePath) {
  const trimmed = asTrimmedString(evidencePath);
  return trimmed !== '' && !LOCAL_PATH_SCHEMES.test(trimmed);
}

async function evidencePathExists(rootDir, evidencePath) {
  if (!isLocalEvidencePath(evidencePath)) return true;
  try {
    await fs.access(path.resolve(rootDir, evidencePath));
    return true;
  } catch {
    return false;
  }
}

export function buildSketchAcceptanceProvenanceManifest({
  generatedAt = new Date().toISOString(),
  gitHead,
  modelId = null,
  modelRevision,
  phaseId = null,
  irHash,
  capabilityHash,
  advisorDigest = 'pending',
  ruleDigest = 'pending',
  integrityDigest = 'pending',
  rendererDiagnosticsDigest = 'pending',
  requiredFeatures = [],
  evidence = {},
  staleReasons = [],
  notes = [],
} = {}) {
  return {
    schemaVersion: SKETCH_ACCEPTANCE_PROVENANCE_SCHEMA_VERSION,
    kind: 'sketch_acceptance_provenance_manifest',
    acceptanceLayer: SKETCH_ACCEPTANCE_LAYER,
    generatedAt,
    context: {
      gitHead: asTrimmedString(gitHead),
      modelId: modelId == null ? null : asTrimmedString(modelId),
      modelRevision: asTrimmedString(modelRevision),
      phaseId: phaseId == null ? null : asTrimmedString(phaseId),
      irHash: asTrimmedString(irHash),
      capabilityHash: asTrimmedString(capabilityHash),
      advisorDigest: advisorDigest == null ? null : asTrimmedString(advisorDigest),
      ruleDigest: ruleDigest == null ? null : asTrimmedString(ruleDigest),
      integrityDigest: integrityDigest == null ? null : asTrimmedString(integrityDigest),
      rendererDiagnosticsDigest:
        rendererDiagnosticsDigest == null ? null : asTrimmedString(rendererDiagnosticsDigest),
    },
    requiredFeatures: requiredFeatures.map((feature) => ({
      featureId: asTrimmedString(feature.featureId),
      title: feature.title == null ? null : asTrimmedString(feature.title),
      phase: feature.phase == null ? null : asTrimmedString(feature.phase),
      sourceRefs: normalizeStringArray(feature.sourceRefs),
      requiredElementIds: normalizeStringArray(feature.requiredElementIds),
      mappedElementIds: normalizeStringArray(feature.mappedElementIds),
      evidencePaths: normalizeEvidencePathEntries(feature.evidencePaths),
      status: asTrimmedString(feature.status) || 'pending',
      staleReasons: Array.isArray(feature.staleReasons) ? feature.staleReasons : [],
      notes: normalizeStringArray(feature.notes),
    })),
    evidence: {
      screenshots: normalizeEvidencePathEntries(evidence.screenshots),
      reports: normalizeEvidencePathEntries(evidence.reports),
      exports: normalizeEvidencePathEntries(evidence.exports),
      manifests: normalizeEvidencePathEntries(evidence.manifests),
    },
    staleReasons: Array.isArray(staleReasons) ? staleReasons : [],
    notes: normalizeStringArray(notes),
  };
}

export function validateSketchAcceptanceProvenanceManifest(manifest) {
  const issues = [];

  if (!isObject(manifest)) {
    issues.push(
      issue(
        'error',
        'manifest_not_object',
        '$',
        'Sketch acceptance provenance manifest must be an object.',
      ),
    );
    return { valid: false, issues };
  }

  if (manifest.schemaVersion !== SKETCH_ACCEPTANCE_PROVENANCE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'error',
        'invalid_schema_version',
        'schemaVersion',
        `schemaVersion must be ${SKETCH_ACCEPTANCE_PROVENANCE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (manifest.acceptanceLayer !== SKETCH_ACCEPTANCE_LAYER) {
    issues.push(
      issue(
        'error',
        'invalid_acceptance_layer',
        'acceptanceLayer',
        'Sketch acceptance provenance must be separate from the normal Advisor layer.',
      ),
    );
  }
  if (manifest.kind !== 'sketch_acceptance_provenance_manifest') {
    issues.push(
      issue(
        'error',
        'invalid_manifest_kind',
        'kind',
        'kind must be sketch_acceptance_provenance_manifest.',
      ),
    );
  }

  if (!isObject(manifest.context)) {
    issues.push(issue('error', 'missing_context', 'context', 'context must be an object.'));
  } else {
    for (const key of REQUIRED_CONTEXT_KEYS) {
      if (!hasOwn(manifest.context, key)) {
        issues.push(
          issue('error', 'missing_context_key', `context.${key}`, `${key} must be present.`),
        );
        continue;
      }
      if (manifest.context[key] !== null && contextValue(manifest.context, key) === '') {
        issues.push(
          issue(
            'error',
            'invalid_context_value',
            `context.${key}`,
            `${key} must be a non-empty string, number, or null placeholder.`,
          ),
        );
      }
    }
  }

  if (!Array.isArray(manifest.requiredFeatures) || manifest.requiredFeatures.length === 0) {
    issues.push(
      issue(
        'error',
        'missing_required_features',
        'requiredFeatures',
        'At least one required sketch/brief feature must be mapped.',
      ),
    );
  } else {
    const featureIds = new Set();
    manifest.requiredFeatures.forEach((feature, index) => {
      const base = `requiredFeatures[${index}]`;
      if (!isObject(feature)) {
        issues.push(issue('error', 'feature_not_object', base, 'Feature mapping must be an object.'));
        return;
      }

      const featureId = asTrimmedString(feature.featureId);
      if (!featureId) {
        issues.push(
          issue('error', 'missing_feature_id', `${base}.featureId`, 'featureId is required.'),
        );
      } else if (!ID_RE.test(featureId)) {
        issues.push(
          issue(
            'error',
            'invalid_feature_id',
            `${base}.featureId`,
            'featureId must be stable and machine-safe.',
          ),
        );
      } else if (featureIds.has(featureId)) {
        issues.push(
          issue(
            'error',
            'duplicate_feature_id',
            `${base}.featureId`,
            `Duplicate featureId ${featureId}.`,
          ),
        );
      } else {
        featureIds.add(featureId);
      }

      for (const key of ['sourceRefs', 'requiredElementIds', 'mappedElementIds', 'evidencePaths']) {
        if (!Array.isArray(feature[key])) {
          issues.push(issue('error', 'feature_array_required', `${base}.${key}`, `${key} must be an array.`));
        }
      }

      const status = asTrimmedString(feature.status) || 'pending';
      if (!FEATURE_STATUSES.has(status)) {
        issues.push(
          issue(
            'error',
            'invalid_feature_status',
            `${base}.status`,
            `status must be one of ${[...FEATURE_STATUSES].join(', ')}.`,
          ),
        );
      }

      if (PASSING_FEATURE_STATUSES.has(status)) {
        if (normalizeStringArray(feature.mappedElementIds).length === 0) {
          issues.push(
            issue(
              'error',
              'passing_feature_without_elements',
              `${base}.mappedElementIds`,
              'Passing sketch features must map to at least one BIM element id.',
            ),
          );
        }
        if (normalizeEvidencePathEntries(feature.evidencePaths).length === 0) {
          issues.push(
            issue(
              'error',
              'passing_feature_without_evidence',
              `${base}.evidencePaths`,
              'Passing sketch features must cite evidence paths.',
            ),
          );
        }
      }
    });
  }

  if (!isObject(manifest.evidence)) {
    issues.push(issue('error', 'missing_evidence', 'evidence', 'evidence must be an object.'));
  } else {
    for (const key of ['screenshots', 'reports', 'exports', 'manifests']) {
      if (!Array.isArray(manifest.evidence[key])) {
        issues.push(
          issue('error', 'evidence_array_required', `evidence.${key}`, `${key} must be an array.`),
        );
      }
    }
  }

  return { valid: issues.every((entry) => entry.severity !== 'error'), issues };
}

export async function evaluateSketchAcceptanceStaleness(
  manifest,
  { currentContext = {}, rootDir = process.cwd(), checkEvidencePaths = false } = {},
) {
  const validation = validateSketchAcceptanceProvenanceManifest(manifest);
  const staleReasons = [];
  const featureStaleReasons = {};

  if (!validation.valid) {
    staleReasons.push(
      staleReason(
        'manifest_invalid',
        '$',
        'The sketch acceptance provenance manifest is invalid and cannot prove current evidence.',
      ),
    );
  }

  for (const key of REQUIRED_CONTEXT_KEYS) {
    if (!hasOwn(currentContext, key)) continue;
    const previous = contextValue(manifest?.context, key);
    const current = contextValue(currentContext, key);
    if (previous !== current) staleReasons.push(contextChangedReason(key, previous, current));
  }

  if (checkEvidencePaths && isObject(manifest)) {
    const manifestEvidence = isObject(manifest.evidence) ? manifest.evidence : {};
    for (const section of ['screenshots', 'reports', 'exports', 'manifests']) {
      for (const entry of normalizeEvidencePathEntries(manifestEvidence[section])) {
        const exists = await evidencePathExists(rootDir, entry.path);
        if (!exists) {
          staleReasons.push(
            staleReason(
              'evidence_path_missing',
              `evidence.${section}`,
              `Evidence path does not exist: ${entry.path}`,
              { evidencePath: entry.path },
            ),
          );
        }
      }
    }

    if (Array.isArray(manifest.requiredFeatures)) {
      for (const feature of manifest.requiredFeatures) {
        const featureId = asTrimmedString(feature?.featureId) || '<missing-feature-id>';
        for (const entry of normalizeEvidencePathEntries(feature?.evidencePaths)) {
          const exists = await evidencePathExists(rootDir, entry.path);
          if (!exists) {
            if (!featureStaleReasons[featureId]) featureStaleReasons[featureId] = [];
            featureStaleReasons[featureId].push(
              staleReason(
                'feature_evidence_path_missing',
                `requiredFeatures.${featureId}.evidencePaths`,
                `Feature evidence path does not exist: ${entry.path}`,
                { evidencePath: entry.path },
              ),
            );
          }
        }
      }
    }
  }

  const featureReasonCount = Object.values(featureStaleReasons).reduce(
    (sum, reasons) => sum + reasons.length,
    0,
  );
  return {
    stale: staleReasons.length > 0 || featureReasonCount > 0,
    staleReasons,
    featureStaleReasons,
    validation,
  };
}

export function annotateSketchAcceptanceStaleness(manifest, staleness) {
  const featureStaleReasons = staleness?.featureStaleReasons ?? {};
  return {
    ...manifest,
    staleReasons: [...(manifest?.staleReasons ?? []), ...(staleness?.staleReasons ?? [])],
    requiredFeatures: Array.isArray(manifest?.requiredFeatures)
      ? manifest.requiredFeatures.map((feature) => ({
          ...feature,
          staleReasons: [
            ...(feature.staleReasons ?? []),
            ...(featureStaleReasons[feature.featureId] ?? []),
          ],
        }))
      : manifest?.requiredFeatures,
  };
}
