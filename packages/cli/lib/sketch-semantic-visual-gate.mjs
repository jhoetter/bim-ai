export const SKETCH_SEMANTIC_VISUAL_GATE_SCHEMA_VERSION =
  'sketch.semantic-visual-gate.v1';

export const SEMANTIC_VISUAL_CATEGORIES = [
  'silhouette',
  'roof_cutout',
  'terrace_loggia',
  'facade_rhythm',
  'cladding_materials',
  'rooms_programme',
  'stairs_rails',
  'diagnostics',
];

const CATEGORY_SET = new Set(SEMANTIC_VISUAL_CATEGORIES);
const PASS_STATUSES = new Set(['pass', 'passed', 'ok', 'verified', 'accepted', 'resolved']);
const FAIL_STATUSES = new Set(['fail', 'failed', 'blocked', 'mismatch', 'rejected']);
const REVIEW_STATUSES = new Set(['', 'unchecked', 'pending', 'needs_review', 'review', 'todo']);
const TOLERATED_STATUSES = new Set(['tolerated', 'accepted_tolerance', 'accepted-tolerance']);
const INVALID_CHECKLIST_STATUSES = new Set([
  'invalid',
  'not_applicable',
  'not-applicable',
  'n/a',
  'na',
  'invalid_checklist_row',
  'invalid-checklist-row',
  'rejected_invalid',
  'rejected-invalid',
]);
const INVALID_CHECKLIST_DISPOSITIONS = new Set([
  'invalid',
  'not_applicable',
  'not-applicable',
  'invalid_checklist_row',
  'invalid-checklist-row',
  'rejected_invalid',
  'rejected-invalid',
]);
const DRIFT_PASS_STATUSES = new Set([
  'none',
  'no_drift',
  'unchanged',
  'matched',
  'match',
  'resolved',
  'pass',
  'ok',
]);
const DRIFT_BLOCK_STATUSES = new Set([
  'drift',
  'changed',
  'unresolved',
  'regressed',
  'mismatch',
  'fail',
  'failed',
  'blocked',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStatus(value) {
  return asString(value).toLowerCase().replace(/\s+/g, '_');
}

function arrayValues(...values) {
  const out = [];
  for (const value of values) {
    if (Array.isArray(value)) out.push(...value);
    else if (value != null) out.push(value);
  }
  return out;
}

function uniqueStrings(...values) {
  return [
    ...new Set(
      arrayValues(...values)
        .map((value) => {
          if (typeof value === 'string' || typeof value === 'number') return asString(value);
          if (isObject(value) && typeof value.path === 'string') return asString(value.path);
          if (isObject(value) && typeof value.href === 'string') return asString(value.href);
          return '';
        })
        .filter(Boolean),
    ),
  ];
}

function evidencePathsFrom(value) {
  return uniqueStrings(
    value?.evidencePaths,
    value?.evidencePath,
    value?.evidence,
    value?.evidenceLinks,
    value?.sourcePath,
    value?.screenshotPath,
    value?.readoutPath,
  );
}

function notesFrom(...values) {
  return uniqueStrings(
    values.flatMap((value) => [
      value?.notes,
      value?.note,
      value?.reason,
      value?.message,
      value?.prompt,
    ]),
  );
}

function firstString(...values) {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return '';
}

function normalizeCategory(value, fallbackText = '') {
  const direct = normalizeStatus(value);
  if (CATEGORY_SET.has(direct)) return direct;
  const text = `${direct} ${fallbackText}`.toLowerCase();
  if (/silhouette|massing|wrapper|outline/.test(text)) return 'silhouette';
  if (/roof.*(cutout|opening|void|terrace)|cutout.*roof/.test(text)) return 'roof_cutout';
  if (/terrace|loggia|balcony|recess/.test(text)) return 'terrace_loggia';
  if (/facade|fa[cç]ade|window.*rhythm|bay|fenestration|opening.*rhythm/.test(text)) {
    return 'facade_rhythm';
  }
  if (/cladding|material|timber|brick|stone|plaster|render|glass|metal/.test(text)) {
    return 'cladding_materials';
  }
  if (/room|programme|program|plan|interior|kitchen|bath|bedroom|living/.test(text)) {
    return 'rooms_programme';
  }
  if (/stair|rail|guard|balustrade|handrail/.test(text)) return 'stairs_rails';
  if (/diagnostic|advisor|warning|readout|wire|artifact|z-fighting|gap/.test(text)) {
    return 'diagnostics';
  }
  return 'diagnostics';
}

function normalizeToleranceRows(toleranceLedger) {
  if (!isObject(toleranceLedger)) return [];
  const rows = Array.isArray(toleranceLedger.tolerances)
    ? toleranceLedger.tolerances
    : Array.isArray(toleranceLedger.entries)
      ? toleranceLedger.entries
      : [];
  return rows.filter(isObject);
}

function rowIds(row) {
  return uniqueStrings(
    row.id,
    row.toleranceId,
    row.itemId,
    row.checkId,
    row.driftId,
    row.rowId,
    row.featureId,
    row.affectedFeatureIds,
    row.affectedCheckIds,
    row.affectedDriftIds,
  );
}

function toleranceEvidence(row) {
  return uniqueStrings(row.evidenceLinks, row.evidencePaths, row.evidence, row.evidencePath);
}

function findTolerance({ target, toleranceLedger }) {
  const rows = normalizeToleranceRows(toleranceLedger);
  const targetIds = new Set(
    uniqueStrings(
      target.toleranceId,
      target.id,
      target.itemId,
      target.checkId,
      target.driftId,
      target.featureId,
    ),
  );
  const category = normalizeCategory(target.category, target.prompt ?? target.message ?? target.id);

  for (const row of rows) {
    const ids = rowIds(row);
    if (ids.some((id) => targetIds.has(id))) return row;
    const rowCategory = normalizeCategory(row.category, row.reason ?? row.id);
    if (category && rowCategory === category && ids.length === 0) return row;
  }
  return null;
}

function validateTolerance({ target, toleranceLedger }) {
  const row = findTolerance({ target, toleranceLedger });
  if (!row) {
    return { ok: false, row: null, missing: ['ledgerRow'] };
  }
  const missing = [];
  if (!firstString(row.reason, row.toleranceReason, row.phaseRationale)) missing.push('reason');
  if (!firstString(row.owner)) missing.push('owner');
  if (!firstString(row.expiryCondition, row.expiresWhen, row.expiresAt)) {
    missing.push('expiryCondition');
  }
  if (toleranceEvidence(row).length === 0) missing.push('evidenceLinks');
  return { ok: missing.length === 0, row, missing };
}

function classifyChecklistStatus(status) {
  if (PASS_STATUSES.has(status)) return 'pass';
  if (FAIL_STATUSES.has(status)) return 'fail';
  if (TOLERATED_STATUSES.has(status)) return 'tolerated';
  if (INVALID_CHECKLIST_STATUSES.has(status)) return 'invalid';
  if (REVIEW_STATUSES.has(status)) return 'unchecked';
  return 'unchecked';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function rowsFromTargetHouseAcceptance(targetHouseEvidenceAcceptance) {
  return {
    visualRows: asArray(targetHouseEvidenceAcceptance?.visualRows).filter(isObject),
    dataQualityRows: asArray(targetHouseEvidenceAcceptance?.dataQualityRows).filter(isObject),
  };
}

function passStatus(value) {
  return PASS_STATUSES.has(normalizeStatus(value));
}

function rowEvidencePaths(row) {
  return uniqueStrings(
    evidencePathsFrom(row),
    row?.screenshot?.path,
    row?.screenshot?.href,
    row?.sourcePath,
  );
}

function allRowsPass(rows) {
  return rows.length > 0 && rows.every((row) => passStatus(row.status ?? row.result));
}

function requiredFeatureId(feature, index = 0) {
  return firstString(feature?.id, feature?.featureId, `required-feature-${index}`);
}

function requiredFeatureRows(evidence) {
  return asArray(evidence?.requiredFeatures).filter(isObject);
}

function findRequiredFeature(evidence, featureId) {
  const wanted = asString(featureId);
  if (!wanted) return null;
  return (
    requiredFeatureRows(evidence).find(
      (feature, index) =>
        requiredFeatureId(feature, index) === wanted ||
        asString(feature.featureId) === wanted ||
        asArray(feature.aliases).some((alias) => asString(alias) === wanted),
    ) ?? null
  );
}

function featureHasTrace(feature, viewId) {
  if (!feature) return false;
  const hasLocator =
    asArray(feature.requiredElementIds).length > 0 ||
    asArray(feature.mappedElementIds).length > 0 ||
    asArray(feature.elementIds).length > 0 ||
    asArray(feature.semanticSelectors).length > 0;
  const hasSource =
    asArray(feature.sourceRefs).length > 0 || asArray(feature.sourceReferences).length > 0;
  const hasPhase = Boolean(firstString(feature.phaseId, feature.phase));
  const requiredViewIds = asArray(feature.requiredViewIds).map(asString).filter(Boolean);
  const viewMatches = !viewId || requiredViewIds.length === 0 || requiredViewIds.includes(viewId);
  return hasLocator && hasSource && hasPhase && viewMatches;
}

function featureTraceFrom(feature, viewId, acceptanceStatus) {
  if (!feature) return null;
  return {
    featureId: requiredFeatureId(feature),
    phaseId: firstString(feature.phaseId, feature.phase) || null,
    requiredViewIds: uniqueStrings(feature.requiredViewIds),
    requiredElementIds: uniqueStrings(
      feature.requiredElementIds,
      feature.mappedElementIds,
      feature.elementIds,
    ),
    semanticSelectors: uniqueStrings(feature.semanticSelectors),
    sourceRefs: uniqueStrings(feature.sourceRefs, feature.sourceReferences),
    acceptanceStatus,
    viewId: viewId ?? null,
  };
}

function targetHouseVisualEvidenceForView(evidence, viewId) {
  const { visualRows } = rowsFromTargetHouseAcceptance(evidence?.targetHouseEvidenceAcceptance);
  if (!viewId) return visualRows;
  return visualRows.filter((row) => asString(row.viewId) === viewId);
}

function screenshotEvidenceForView(evidence, viewId) {
  const captures = asArray(evidence?.screenshotManifest?.captures).filter(isObject);
  if (!viewId) return captures;
  return captures.filter((capture) => asString(capture.viewId) === viewId);
}

function visualGateEvidenceForView(evidence, viewId) {
  const captures = asArray(evidence?.visualGateReport?.captures).filter(isObject);
  if (!viewId) return captures;
  return captures.filter((capture) => asString(capture.viewId) === viewId);
}

function cleanAdvisorEvidencePasses(evidence) {
  if (evidence?.cleanPassGate?.ok === true) return true;
  const warningCount = Number(
    evidence?.advisorWarningCount ?? evidence?.liveAdvisor?.warning?.total ?? 0,
  );
  return Number.isFinite(warningCount) && warningCount === 0;
}

function dataQualityEvidencePasses(evidence) {
  if (evidence?.bimDataQualityReport?.ok === true) return true;
  const { dataQualityRows } = rowsFromTargetHouseAcceptance(evidence?.targetHouseEvidenceAcceptance);
  return allRowsPass(dataQualityRows);
}

function targetHouseAcceptancePasses(evidence) {
  const targetHouse = evidence?.targetHouseEvidenceAcceptance;
  if (!targetHouse) return false;
  if (targetHouse.ok === false) return false;
  const { visualRows, dataQualityRows } = rowsFromTargetHouseAcceptance(targetHouse);
  return allRowsPass(visualRows) && (dataQualityRows.length === 0 || allRowsPass(dataQualityRows));
}

function deterministicEvidenceForRequirement({ item, check, category, evidence }) {
  if (!isObject(evidence)) return null;
  const itemId = firstString(item?.id);
  const checkId = firstString(check?.id);
  const viewId = firstString(item?.viewId);
  const featureId = firstString(check?.featureId, item?.featureId);
  const feature = findRequiredFeature(evidence, featureId);
  const visualRows = targetHouseVisualEvidenceForView(evidence, viewId);
  const screenshots = screenshotEvidenceForView(evidence, viewId);
  const visualPass = viewId ? allRowsPass(visualRows) : targetHouseAcceptancePasses(evidence);
  const evidencePaths = uniqueStrings(
    evidencePathsFrom(evidence?.targetHouseEvidenceAcceptance),
    evidencePathsFrom(evidence?.cleanPassGate),
    evidencePathsFrom(evidence?.bimDataQualityReport),
    visualRows.flatMap(rowEvidencePaths),
    visualGateEvidenceForView(evidence, viewId).flatMap(rowEvidencePaths),
    screenshots.flatMap(rowEvidencePaths),
  );

  if (itemId === 'global:advisor' || checkId === 'advisor_findings_dispositioned') {
    if (!cleanAdvisorEvidencePasses(evidence)) return null;
    return {
      result: 'pass',
      status: 'evidence_pass',
      evidencePaths,
      notes: ['Deterministic clean-pass evidence has no unresolved Advisor warning/error blockers.'],
      disposition: 'deterministic_evidence',
      featureTrace: null,
    };
  }

  if (itemId === 'global:interior' || category === 'rooms_programme') {
    if (!dataQualityEvidencePasses(evidence) || !visualPass) return null;
    return {
      result: 'pass',
      status: 'evidence_pass',
      evidencePaths,
      notes: ['Deterministic visual and BIM data-quality evidence cover room/programme topology.'],
      disposition: 'deterministic_evidence',
      featureTrace: featureTraceFrom(feature, viewId, 'pass'),
    };
  }

  if (itemId === 'global:silhouette' || itemId === 'global:artifacts') {
    if (!targetHouseAcceptancePasses(evidence) && !visualPass) return null;
    return {
      result: 'pass',
      status: 'evidence_pass',
      evidencePaths,
      notes: ['Deterministic target-house view evidence covers the global semantic visual requirement.'],
      disposition: 'deterministic_evidence',
      featureTrace: null,
    };
  }

  if (featureId) {
    if (!visualPass) return null;
    const traceOk = feature ? featureHasTrace(feature, viewId) : false;
    if (requiredFeatureRows(evidence).length > 0 && !traceOk) return null;
    return {
      result: 'pass',
      status: 'evidence_pass',
      evidencePaths,
      notes: [
        feature
          ? 'Deterministic target-house view evidence and required-feature trace cover this semantic visual row.'
          : 'Deterministic target-house view evidence covers this semantic visual row.',
      ],
      disposition: 'deterministic_evidence',
      featureTrace: featureTraceFrom(feature, viewId, 'pass'),
    };
  }

  if (visualPass || targetHouseAcceptancePasses(evidence)) {
    return {
      result: 'pass',
      status: 'evidence_pass',
      evidencePaths,
      notes: ['Deterministic target-house evidence covers this semantic visual row.'],
      disposition: 'deterministic_evidence',
      featureTrace: null,
    };
  }

  return null;
}

function invalidChecklistDisposition({ item, check }) {
  const disposition = normalizeStatus(check?.disposition ?? item?.disposition);
  const status = normalizeStatus(check?.status ?? item?.status);
  if (
    !INVALID_CHECKLIST_DISPOSITIONS.has(disposition) &&
    !INVALID_CHECKLIST_STATUSES.has(status)
  ) {
    return null;
  }
  const notes = notesFrom(item, check);
  const evidencePaths = uniqueStrings(evidencePathsFrom(item), evidencePathsFrom(check));
  const missing = [];
  if (notes.length === 0) missing.push('reason');
  if (evidencePaths.length === 0) missing.push('evidencePaths');
  return {
    ok: missing.length === 0,
    missing,
    notes,
    evidencePaths,
    disposition: disposition || status,
  };
}

export function resolveSemanticVisualChecklistRequirement({
  item = null,
  check = null,
  evidence = null,
  category = null,
} = {}) {
  const normalizedCategory = normalizeCategory(
    category ?? check?.category ?? item?.category,
    `${item?.id ?? ''} ${item?.featureKind ?? ''} ${item?.prompt ?? ''} ${check?.id ?? ''} ${check?.prompt ?? ''}`,
  );
  const invalidDisposition = invalidChecklistDisposition({ item, check });
  if (invalidDisposition) {
    if (invalidDisposition.ok) {
      return {
        result: 'invalid',
        status: 'invalid_checklist_row',
        blocker: false,
        blockerCode: null,
        category: normalizedCategory,
        evidencePaths: invalidDisposition.evidencePaths,
        notes: invalidDisposition.notes,
        disposition: invalidDisposition.disposition,
        dispositionMissing: [],
        featureTrace: null,
      };
    }
    return {
      result: 'fail',
      status: 'invalid_checklist_row',
      blocker: true,
      blockerCode: 'invalid_checklist_disposition_incomplete',
      category: normalizedCategory,
      evidencePaths: invalidDisposition.evidencePaths,
      notes: invalidDisposition.notes,
      disposition: invalidDisposition.disposition,
      dispositionMissing: invalidDisposition.missing,
      featureTrace: null,
    };
  }

  const deterministic = deterministicEvidenceForRequirement({
    item,
    check,
    category: normalizedCategory,
    evidence,
  });
  if (deterministic) {
    return {
      blocker: false,
      blockerCode: null,
      category: normalizedCategory,
      ...deterministic,
    };
  }
  return null;
}

function checklistEntries(checklist) {
  const entries = [];
  for (const [itemIndex, item] of (checklist?.items ?? []).entries()) {
    if (!isObject(item)) continue;
    const itemId = firstString(item.id, `item-${itemIndex}`);
    const itemRequired = item.required !== false;
    const checks = Array.isArray(item.semanticChecks) ? item.semanticChecks : [];
    if (checks.length === 0 && itemRequired) {
      entries.push({ item, check: null, itemId, checkId: null });
      continue;
    }
    for (const [checkIndex, check] of checks.entries()) {
      if (!isObject(check) || check.required === false || itemRequired === false) continue;
      entries.push({
        item,
        check,
        itemId,
        checkId: firstString(check.id, `${itemId}:check-${checkIndex}`),
      });
    }
  }
  return entries;
}

function evaluateChecklistEntry(entry, toleranceLedger, evidence) {
  const source = entry.check ?? entry.item;
  const status = normalizeStatus(source.status ?? entry.item.status);
  const text = [
    entry.item.category,
    entry.item.featureKind,
    entry.item.featureId,
    entry.item.prompt,
    source.id,
    source.prompt,
  ]
    .filter(Boolean)
    .join(' ');
  const category = normalizeCategory(source.category ?? entry.item.category, text);
  const target = {
    id: entry.checkId ?? entry.itemId,
    itemId: entry.itemId,
    checkId: entry.checkId,
    featureId: firstString(source.featureId, entry.item.featureId),
    toleranceId: source.toleranceId ?? entry.item.toleranceId,
    category,
    prompt: source.prompt ?? entry.item.prompt,
  };
  const classification = classifyChecklistStatus(status);
  const evidencePaths = uniqueStrings(evidencePathsFrom(entry.item), evidencePathsFrom(source));
  const notes = notesFrom(entry.item, source);
  const evidenceDisposition =
    classification === 'unchecked' || classification === 'invalid'
      ? resolveSemanticVisualChecklistRequirement({
          item: entry.item,
          check: entry.check,
          evidence,
          category,
        })
      : null;
  const row = {
    id: target.id,
    itemId: entry.itemId,
    checkId: entry.checkId,
    viewId: entry.item.viewId ?? null,
    featureId: target.featureId || null,
    category,
    status: status || 'unchecked',
    result: classification,
    evidencePaths,
    notes,
    blocker: false,
    tolerance: null,
  };

  if (classification === 'pass') return row;
  if (evidenceDisposition) {
    row.status = evidenceDisposition.status;
    row.result = evidenceDisposition.result;
    row.evidencePaths = uniqueStrings(evidencePaths, evidenceDisposition.evidencePaths);
    row.notes = uniqueStrings(notes, evidenceDisposition.notes);
    row.blocker = evidenceDisposition.blocker;
    row.blockerCode = evidenceDisposition.blockerCode;
    row.disposition = evidenceDisposition.disposition ?? null;
    row.dispositionMissing = evidenceDisposition.dispositionMissing ?? [];
    row.featureTrace = evidenceDisposition.featureTrace ?? null;
    return row;
  }
  if (classification === 'tolerated') {
    const tolerance = validateTolerance({ target, toleranceLedger });
    row.tolerance = tolerance.row
      ? { id: tolerance.row.id ?? tolerance.row.toleranceId ?? null, missing: tolerance.missing }
      : { id: null, missing: tolerance.missing };
    if (tolerance.ok) {
      row.result = 'pass';
      return row;
    }
    row.result = 'fail';
    row.blocker = true;
    row.blockerCode = 'tolerance_ledger_incomplete';
    return row;
  }
  row.blocker = true;
  row.blockerCode = classification === 'fail' ? 'required_check_failed' : 'required_check_unchecked';
  return row;
}

function classifyDriftStatus(row) {
  const status = normalizeStatus(row.status ?? row.resolution ?? row.result);
  if (TOLERATED_STATUSES.has(status)) return 'tolerated';
  if (DRIFT_PASS_STATUSES.has(status)) return 'pass';
  if (DRIFT_BLOCK_STATUSES.has(status)) return 'fail';
  if (row.tolerated === true || row.toleranceId) return 'tolerated';
  if (firstString(row.current, row.currentPhase, row.currentReadout) === '') return 'unchecked';
  if (firstString(row.previous, row.previousPhase, row.sourceReference, row.reference) === '') {
    return 'unchecked';
  }
  if (
    firstString(row.current, row.currentPhase, row.currentReadout) ===
    firstString(row.previous, row.previousPhase, row.sourceReference, row.reference)
  ) {
    return 'pass';
  }
  return 'fail';
}

function evaluateDriftRow(row, index, toleranceLedger) {
  const id = firstString(row.id, row.driftId, `drift-${index}`);
  const category = normalizeCategory(row.category, `${id} ${row.notes ?? ''}`);
  const classification = classifyDriftStatus(row);
  const target = {
    id,
    driftId: id,
    featureId: row.featureId,
    toleranceId: row.toleranceId,
    category,
    message: row.message ?? row.notes,
  };
  const evaluated = {
    id,
    category,
    status: normalizeStatus(row.status ?? row.resolution ?? row.result) || classification,
    result: classification,
    current: row.current ?? row.currentPhase ?? row.currentReadout ?? null,
    previous: row.previous ?? row.previousPhase ?? row.sourceReference ?? row.reference ?? null,
    evidencePaths: evidencePathsFrom(row),
    notes: notesFrom(row),
    blocker: false,
    tolerance: null,
  };

  if (classification === 'pass') return evaluated;
  if (classification === 'tolerated') {
    const tolerance = validateTolerance({ target, toleranceLedger });
    evaluated.tolerance = tolerance.row
      ? { id: tolerance.row.id ?? tolerance.row.toleranceId ?? null, missing: tolerance.missing }
      : { id: null, missing: tolerance.missing };
    if (tolerance.ok) {
      evaluated.result = 'pass';
      return evaluated;
    }
    evaluated.result = 'fail';
    evaluated.blocker = true;
    evaluated.blockerCode = 'tolerance_ledger_incomplete';
    return evaluated;
  }
  evaluated.blocker = true;
  evaluated.blockerCode =
    classification === 'unchecked' ? 'drift_comparison_unchecked' : 'unresolved_visual_drift';
  return evaluated;
}

function countByCategory(rows) {
  return rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
}

export function evaluateSketchSemanticVisualGate({
  checklist = null,
  driftRows = [],
  toleranceLedger = null,
  evidence = null,
  phaseId = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const checklistResults = checklistEntries(checklist).map((entry) =>
    evaluateChecklistEntry(entry, toleranceLedger, evidence),
  );
  const driftResults = (Array.isArray(driftRows) ? driftRows : [])
    .filter(isObject)
    .map((row, index) => evaluateDriftRow(row, index, toleranceLedger));
  const blockers = [...checklistResults, ...driftResults].filter((row) => row.blocker);

  return {
    schemaVersion: SKETCH_SEMANTIC_VISUAL_GATE_SCHEMA_VERSION,
    generatedAt,
    phaseId,
    ok: blockers.length === 0,
    categories: SEMANTIC_VISUAL_CATEGORIES,
    summary: {
      checklistRequiredCount: checklistResults.length,
      checklistPassCount: checklistResults.filter((row) => row.result === 'pass').length,
      checklistFailCount: checklistResults.filter((row) => row.result === 'fail').length,
      checklistInvalidCount: checklistResults.filter((row) => row.result === 'invalid').length,
      checklistUncheckedCount: checklistResults.filter((row) => row.result === 'unchecked').length,
      driftRowCount: driftResults.length,
      driftPassCount: driftResults.filter((row) => row.result === 'pass').length,
      driftBlockCount: driftResults.filter((row) => row.blocker).length,
      blockerCount: blockers.length,
      checklistByCategory: countByCategory(checklistResults),
      driftByCategory: countByCategory(driftResults),
    },
    checklist: checklistResults,
    drift: driftResults,
    blockers: blockers.map((row) => ({
      id: row.id,
      category: row.category,
      status: row.status,
      blockerCode: row.blockerCode,
      evidencePaths: row.evidencePaths,
      notes: row.notes,
      dispositionMissing: row.dispositionMissing ?? [],
    })),
  };
}
