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
  if (REVIEW_STATUSES.has(status)) return 'unchecked';
  return 'unchecked';
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

function evaluateChecklistEntry(entry, toleranceLedger) {
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
  phaseId = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const checklistResults = checklistEntries(checklist).map((entry) =>
    evaluateChecklistEntry(entry, toleranceLedger),
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
    })),
  };
}
