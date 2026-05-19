export const RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION =
  'renderer-diagnostics-evidence.v1';

export const RENDERER_BLOCKING_SEVERITIES = new Set(['error']);
export const RENDERER_BLOCKING_ISSUE_CLASSES = new Set([
  'renderer-unsupported',
  'renderer-failed',
]);

const CONTEXT_KEYS = [
  'gitHead',
  'modelRevision',
  'rendererBuild',
  'supportMatrixDigest',
];

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const VALID_SEVERITIES = new Set(['error', 'warning', 'info']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asNullableString(value) {
  const stringValue = asTrimmedString(value);
  return stringValue === '' ? null : stringValue;
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(asTrimmedString).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeSourceCommandRefs(...values) {
  const refs = [];
  for (const value of values) {
    const rows = Array.isArray(value) ? value : value == null ? [] : [value];
    for (const row of rows) {
      if (!isObject(row)) continue;
      const sourceCommandId = pickFirstString(row.sourceCommandId, row.commandId, row.id);
      if (!sourceCommandId) continue;
      const ref = { sourceCommandId };
      for (const key of [
        'commandType',
        'transactionId',
        'revisionAfter',
        'affectedElementId',
        'sourceRecipeRow',
        'agentWave',
        'commit',
        'phasePacketId',
      ]) {
        const normalized = asTrimmedString(row[key]);
        if (normalized) ref[key] = normalized;
      }
      refs.push(ref);
    }
  }

  const byKey = new Map();
  for (const ref of refs) {
    byKey.set(
      [
        ref.sourceCommandId,
        ref.affectedElementId ?? '',
        ref.transactionId ?? '',
        ref.phasePacketId ?? '',
      ].join('|'),
      ref,
    );
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.sourceCommandId}:${a.affectedElementId ?? ''}`.localeCompare(
      `${b.sourceCommandId}:${b.affectedElementId ?? ''}`,
    ),
  );
}

function normalizeSeverity(value) {
  const severity = asTrimmedString(value).toLowerCase();
  return VALID_SEVERITIES.has(severity) ? severity : 'info';
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function issue(severity, code, path, message, extra = {}) {
  return { severity, code, path, message, ...extra };
}

function staleReason(code, path, message, extra = {}) {
  return { code, path, message, ...extra };
}

function contextChangedReason(key, previous, current) {
  const codeByKey = {
    gitHead: 'git_head_changed',
    modelRevision: 'model_revision_changed',
    rendererBuild: 'renderer_build_changed',
    supportMatrixDigest: 'support_matrix_digest_changed',
  };
  return staleReason(
    codeByKey[key] ?? `${key}_changed`,
    `context.${key}`,
    `${key} changed since the renderer diagnostics evidence manifest was produced.`,
    { previous, current },
  );
}

function pickFirstString(...values) {
  for (const value of values) {
    const stringValue = asTrimmedString(value);
    if (stringValue) return stringValue;
  }
  return '';
}

function normalizeDiagnostic(rawDiagnostic, index, defaults = {}) {
  const raw = isObject(rawDiagnostic) ? rawDiagnostic : {};
  const evidence = isObject(raw.evidence) ? raw.evidence : {};
  const code = pickFirstString(raw.code, raw.ruleId, `renderer.diagnostic.${index}`);
  const ruleId = pickFirstString(raw.ruleId, raw.code, code);
  const viewIds = normalizeStringArray([
    ...normalizeStringArray(raw.viewIds),
    raw.viewId,
    evidence.viewId,
    defaults.viewId,
  ]);
  const featureIds = normalizeStringArray([
    ...normalizeStringArray(raw.featureIds),
    raw.featureId,
    raw.sketchFeatureId,
    raw.requiredFeatureId,
  ]);
  const elementIds = normalizeStringArray([
    ...normalizeStringArray(raw.elementIds),
    raw.elementId,
    raw.hostElementId,
  ]);
  const directSourceCommandId = pickFirstString(
    raw.sourceCommandId,
    raw.commandId,
    evidence.sourceCommandId,
    evidence.commandId,
  );
  const sourceCommands = normalizeSourceCommandRefs(
    raw.sourceCommands,
    evidence.sourceCommands,
    directSourceCommandId
      ? {
          sourceCommandId: directSourceCommandId,
          sourceRecipeRow: raw.sourceRecipeRow ?? evidence.sourceRecipeRow,
          agentWave: raw.agentWave ?? evidence.agentWave,
          commit: raw.commit ?? evidence.commit,
          phasePacketId: raw.phasePacketId ?? evidence.phasePacketId,
        }
      : null,
  );

  return {
    diagnosticId: pickFirstString(raw.diagnosticId, raw.id, `${code}#${index}`),
    severity: normalizeSeverity(raw.severity),
    code,
    ruleId,
    issueClass: pickFirstString(raw.issueClass, raw.classification, 'renderer-diagnostic'),
    rendererArea: pickFirstString(raw.rendererArea, raw.area, raw.surface, 'viewport-3d'),
    renderFeature: pickFirstString(raw.renderFeature, raw.feature, raw.rendererFeature, 'unknown'),
    featureIds,
    elementIds,
    viewIds,
    message: pickFirstString(raw.message, raw.summary, 'Renderer diagnostic reported.'),
    source: pickFirstString(raw.source, evidence.source, defaults.source, 'renderer'),
    trackerItems: normalizeStringArray(raw.trackerItems),
    sourceCommandIds: normalizeStringArray([
      ...normalizeStringArray(raw.sourceCommandIds),
      ...sourceCommands.map((entry) => entry.sourceCommandId),
    ]),
    sourceCommands,
    staleReasons: Array.isArray(raw.staleReasons) ? raw.staleReasons : [],
    details: isObject(raw.details) ? raw.details : {},
  };
}

function extractDiagnostics(input) {
  if (Array.isArray(input)) return { diagnostics: input, defaults: {} };
  if (!isObject(input)) return { diagnostics: [], defaults: {} };

  const diagnostics = Array.isArray(input.diagnostics)
    ? input.diagnostics
    : Array.isArray(input.rendererDiagnostics)
      ? input.rendererDiagnostics
      : [];

  return {
    diagnostics,
    defaults: {
      viewId: input.viewId,
      source: input.source,
    },
  };
}

function contextFromInput(input, overrides = {}) {
  const objectInput = isObject(input) ? input : {};
  return {
    gitHead: asNullableString(overrides.gitHead ?? objectInput.gitHead),
    modelRevision: asNullableString(overrides.modelRevision ?? objectInput.modelRevision),
    rendererBuild: asNullableString(overrides.rendererBuild ?? objectInput.rendererBuild),
    supportMatrixDigest: asNullableString(
      overrides.supportMatrixDigest ?? objectInput.supportMatrixDigest,
    ),
  };
}

function requiredFeatureId(feature, index) {
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

function diagnosticAffectsFeature(diagnostic, feature, index) {
  const id = requiredFeatureId(feature, index);
  if (diagnostic.featureIds.includes(id)) return true;
  return setsIntersect(diagnostic.elementIds, featureElementIds(feature));
}

function diagnosticIsBlocking(diagnostic) {
  return (
    RENDERER_BLOCKING_SEVERITIES.has(diagnostic.severity) &&
    (RENDERER_BLOCKING_ISSUE_CLASSES.has(diagnostic.issueClass) ||
      diagnostic.ruleId === 'renderer_unsupported_cut' ||
      diagnostic.ruleId === 'renderer_failed_cut')
  );
}

export function buildRendererDiagnosticsEvidenceManifest({
  generatedAt = new Date().toISOString(),
  gitHead = null,
  modelId = null,
  modelRevision = null,
  rendererBuild = null,
  supportMatrixDigest = null,
  diagnostics = [],
  sourcePacket = null,
  staleReasons = [],
  notes = [],
} = {}) {
  const source = sourcePacket ?? {
    diagnostics,
    gitHead,
    modelRevision,
    rendererBuild,
    supportMatrixDigest,
  };
  const { diagnostics: rawDiagnostics, defaults } = extractDiagnostics(source);
  const normalizedDiagnostics = rawDiagnostics.map((entry, index) =>
    normalizeDiagnostic(entry, index, defaults),
  );

  return {
    schemaVersion: RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION,
    kind: 'renderer_diagnostics_evidence_manifest',
    generatedAt,
    context: {
      ...contextFromInput(source, {
        gitHead,
        modelRevision,
        rendererBuild,
        supportMatrixDigest,
      }),
      modelId: asNullableString(modelId),
    },
    viewIds: normalizeStringArray(normalizedDiagnostics.flatMap((entry) => entry.viewIds)),
    featureIds: normalizeStringArray(normalizedDiagnostics.flatMap((entry) => entry.featureIds)),
    elementIds: normalizeStringArray(normalizedDiagnostics.flatMap((entry) => entry.elementIds)),
    sourceCommandIds: normalizeStringArray(
      normalizedDiagnostics.flatMap((entry) => entry.sourceCommandIds),
    ),
    diagnostics: normalizedDiagnostics,
    summary: summarizeRendererDiagnosticsEvidence(normalizedDiagnostics),
    staleReasons: Array.isArray(staleReasons) ? staleReasons : [],
    notes: normalizeStringArray(notes),
  };
}

export function normalizeRendererDiagnosticsEvidence(input, context = {}) {
  return buildRendererDiagnosticsEvidenceManifest({
    ...context,
    sourcePacket: input,
  });
}

export function summarizeRendererDiagnosticsEvidence(diagnostics = []) {
  const summary = {
    total: diagnostics.length,
    bySeverity: { error: 0, warning: 0, info: 0 },
    byIssueClass: {},
    blockingCandidates: 0,
  };

  for (const diagnostic of diagnostics) {
    const severity = normalizeSeverity(diagnostic.severity);
    summary.bySeverity[severity] += 1;
    const issueClass = diagnostic.issueClass || 'renderer-diagnostic';
    summary.byIssueClass[issueClass] = (summary.byIssueClass[issueClass] ?? 0) + 1;
    if (diagnosticIsBlocking(diagnostic)) summary.blockingCandidates += 1;
  }

  return summary;
}

export function validateRendererDiagnosticsEvidenceManifest(manifest) {
  const issues = [];

  if (!isObject(manifest)) {
    return {
      valid: false,
      issues: [
        issue(
          'error',
          'manifest_not_object',
          '$',
          'Renderer diagnostics evidence manifest must be an object.',
        ),
      ],
    };
  }

  if (manifest.schemaVersion !== RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'error',
        'invalid_schema_version',
        'schemaVersion',
        `schemaVersion must be ${RENDERER_DIAGNOSTICS_EVIDENCE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (manifest.kind !== 'renderer_diagnostics_evidence_manifest') {
    issues.push(
      issue(
        'error',
        'invalid_manifest_kind',
        'kind',
        'kind must be renderer_diagnostics_evidence_manifest.',
      ),
    );
  }

  if (!isObject(manifest.context)) {
    issues.push(issue('error', 'missing_context', 'context', 'context must be an object.'));
  } else {
    for (const key of CONTEXT_KEYS) {
      if (!hasOwn(manifest.context, key)) {
        issues.push(
          issue('error', 'missing_context_key', `context.${key}`, `${key} must be present.`),
        );
      }
    }
  }

  if (!Array.isArray(manifest.diagnostics)) {
    issues.push(
      issue('error', 'diagnostics_array_required', 'diagnostics', 'diagnostics must be an array.'),
    );
  } else {
    manifest.diagnostics.forEach((diagnostic, index) => {
      const base = `diagnostics[${index}]`;
      if (!isObject(diagnostic)) {
        issues.push(issue('error', 'diagnostic_not_object', base, 'Diagnostic must be an object.'));
        return;
      }
      for (const key of ['diagnosticId', 'severity', 'code', 'ruleId']) {
        if (!asTrimmedString(diagnostic[key])) {
          issues.push(issue('error', 'missing_diagnostic_field', `${base}.${key}`, `${key} is required.`));
        }
      }
      if (!VALID_SEVERITIES.has(diagnostic.severity)) {
        issues.push(
          issue(
            'error',
            'invalid_diagnostic_severity',
            `${base}.severity`,
            'Diagnostic severity must be error, warning, or info.',
          ),
        );
      }
      for (const key of ['viewIds', 'featureIds', 'elementIds', 'trackerItems', 'staleReasons']) {
        if (!Array.isArray(diagnostic[key])) {
          issues.push(issue('error', 'diagnostic_array_required', `${base}.${key}`, `${key} must be an array.`));
        }
      }
      for (const featureId of diagnostic.featureIds ?? []) {
        if (!ID_RE.test(featureId)) {
          issues.push(
            issue(
              'error',
              'invalid_feature_id',
              `${base}.featureIds`,
              `Invalid feature id ${featureId}.`,
            ),
          );
        }
      }
    });
  }

  return { valid: issues.every((entry) => entry.severity !== 'error'), issues };
}

export function evaluateRendererDiagnosticsForSketchAcceptance(
  manifest,
  { requiredFeatures = [] } = {},
) {
  const validation = validateRendererDiagnosticsEvidenceManifest(manifest);
  const featureResults = requiredFeatures.map((feature, index) => {
    const featureId = requiredFeatureId(feature, index);
    const affectedDiagnostics = (manifest?.diagnostics ?? []).filter((diagnostic) =>
      diagnosticAffectsFeature(diagnostic, feature, index),
    );
    const blockingDiagnostics = affectedDiagnostics.filter(diagnosticIsBlocking);
    const staleReasons = blockingDiagnostics.map((diagnostic) =>
      staleReason(
        'required_feature_renderer_diagnostic_blocking',
        `requiredFeatures.${featureId}`,
        `Required feature ${featureId} is affected by blocking renderer diagnostic ${diagnostic.code}.`,
        {
          featureId,
          diagnosticId: diagnostic.diagnosticId,
          diagnosticCode: diagnostic.code,
          ruleId: diagnostic.ruleId,
          severity: diagnostic.severity,
          issueClass: diagnostic.issueClass,
          elementIds: diagnostic.elementIds,
          viewIds: diagnostic.viewIds,
        },
      ),
    );
    return {
      featureId,
      requiredElementIds: featureElementIds(feature),
      affectedDiagnostics,
      blockingDiagnostics,
      blocked: blockingDiagnostics.length > 0,
      staleReasons,
    };
  });

  const blockingDiagnostics = featureResults.flatMap((entry) => entry.blockingDiagnostics);
  const blockingDiagnosticIds = new Set(blockingDiagnostics.map((entry) => entry.diagnosticId));
  const nonBlockingDiagnostics = (manifest?.diagnostics ?? []).filter(
    (entry) => !blockingDiagnosticIds.has(entry.diagnosticId),
  );

  return {
    blocked: blockingDiagnostics.length > 0 || !validation.valid,
    validation,
    featureResults,
    blockingDiagnostics,
    nonBlockingDiagnostics,
    staleReasons: [
      ...(validation.valid
        ? []
        : [
            staleReason(
              'renderer_diagnostics_evidence_invalid',
              '$',
              'Renderer diagnostics evidence is invalid and cannot prove sketch acceptance.',
            ),
          ]),
      ...featureResults.flatMap((entry) => entry.staleReasons),
    ],
  };
}

export function evaluateRendererDiagnosticsEvidenceStaleness(
  manifest,
  { currentContext = {} } = {},
) {
  const validation = validateRendererDiagnosticsEvidenceManifest(manifest);
  const staleReasons = [];

  if (!validation.valid) {
    staleReasons.push(
      staleReason(
        'manifest_invalid',
        '$',
        'The renderer diagnostics evidence manifest is invalid and cannot prove current evidence.',
      ),
    );
  }

  for (const key of CONTEXT_KEYS) {
    if (!hasOwn(currentContext, key)) continue;
    const previous = asTrimmedString(manifest?.context?.[key]);
    const current = asTrimmedString(currentContext[key]);
    if (previous !== current) staleReasons.push(contextChangedReason(key, previous, current));
  }

  return {
    stale: staleReasons.length > 0,
    staleReasons,
    validation,
  };
}

export function annotateRendererDiagnosticsEvidenceStaleness(manifest, staleness) {
  return {
    ...manifest,
    staleReasons: [...(manifest?.staleReasons ?? []), ...(staleness?.staleReasons ?? [])],
  };
}
