import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET_HOUSE_CLEAN_PASS_GATE_SCHEMA_VERSION = 'target-house.clean-pass-gate.v1';

const WARNING_SEVERITIES = new Set(['warning', 'warn']);
const ERROR_SEVERITIES = new Set(['error', 'blocker', 'blocking']);
const RENDERER_KEY_RE = /renderer|render|raster|viewport|visual/i;
const RENDERER_BLOCKER_VALUE_RE = /unsupported|failed|missing|unavailable|blocked|invalid/i;
const OPTIONAL_FULL_RASTER_UNAVAILABLE = 'unsupported_full_raster_renderer_unavailable';
const SHEET_PRINT_RASTER_SURROGATE_V2 = 'sheetPrintRasterPrintSurrogate_v2';
const SHEET_PRINT_RASTER_CONTRACT_V3 = 'sheetPrintRasterPrintContract_v3';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalize(value) {
  return asString(value).toLowerCase().replace(/\s+/g, '_');
}

function uniqueStrings(...values) {
  const out = [];
  for (const value of values.flat()) {
    if (typeof value === 'string' || typeof value === 'number') out.push(asString(value));
    else if (isObject(value)) {
      out.push(asString(value.code), asString(value.ruleId), asString(value.id));
    }
  }
  return [...new Set(out.filter(Boolean))].sort();
}

function firstString(...values) {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return '';
}

function isSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(asString(value));
}

function getPathValue(root, trail) {
  let value = root;
  for (const part of trail) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

function artifactByName(manifest, artifactName) {
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  return artifacts.find((artifact) => artifact?.artifactName === artifactName) ?? null;
}

function checksPass(checks) {
  return Array.isArray(checks) && checks.length > 0 && checks.every((check) => check?.ok === true);
}

function deterministicSheetRowForPath(artifact, trail) {
  if (trail[0] !== 'deterministicSheetEvidence') return null;
  const index = Number(trail[1]);
  if (!Number.isInteger(index) || index < 0) return null;
  const rows = Array.isArray(artifact.deterministicSheetEvidence)
    ? artifact.deterministicSheetEvidence
    : [];
  const row = rows[index];
  return isObject(row) ? row : null;
}

function hasEquivalentSheetRasterEvidence(row) {
  const contract = row.sheetPrintRasterPrintContract_v3;
  const manifest = row.sheetExportArtifactManifest_v1;
  const ingest = row.sheetPrintRasterIngest_v1;
  if (!isObject(contract) || !isObject(manifest) || !isObject(ingest)) return false;

  const svg = artifactByName(manifest, 'sheet-preview.svg');
  const png = artifactByName(manifest, 'sheet-print-raster.png');
  const corr = manifest.ciBaselineCorrelation;
  if (!isObject(svg) || !isObject(png) || !isObject(corr)) return false;

  const hasViewportEvidence =
    (Array.isArray(contract.layoutBandsMm) && contract.layoutBandsMm.length > 0) ||
    (Array.isArray(contract.viewportSegmentCorrelation) &&
      contract.viewportSegmentCorrelation.length > 0) ||
    (Array.isArray(row.viewportEvidenceHints_v0) && row.viewportEvidenceHints_v0.length > 0);

  return (
    contract.format === SHEET_PRINT_RASTER_CONTRACT_V3 &&
    contract.valid === true &&
    contract.surrogateVersion === SHEET_PRINT_RASTER_SURROGATE_V2 &&
    contract.fullRasterExportStatus === OPTIONAL_FULL_RASTER_UNAVAILABLE &&
    checksPass(contract.checks) &&
    isSha256Hex(contract.svgContentSha256) &&
    isSha256Hex(contract.pngByteSha256) &&
    contract.exportListingParityDigestMatch === true &&
    hasViewportEvidence &&
    manifest.format === 'sheetExportArtifactManifest_v1' &&
    manifest.exportListingParityDigestMatch === true &&
    isSha256Hex(manifest.svgListingDigestSha256) &&
    manifest.svgListingDigestSha256 === manifest.pdfListingDigestSha256 &&
    svg.mimeType === 'image/svg+xml' &&
    svg.digestSha256 === contract.svgContentSha256 &&
    png.mimeType === 'image/png' &&
    png.digestSha256 === contract.pngByteSha256 &&
    png.surrogateContract === SHEET_PRINT_RASTER_SURROGATE_V2 &&
    png.fullRasterExportStatus === OPTIONAL_FULL_RASTER_UNAVAILABLE &&
    corr.surrogateContract === SHEET_PRINT_RASTER_SURROGATE_V2 &&
    corr.fullRasterExportStatus === OPTIONAL_FULL_RASTER_UNAVAILABLE &&
    corr.svgDigestSha256 === contract.svgContentSha256 &&
    corr.pngDigestSha256 === contract.pngByteSha256 &&
    corr.exportListingDigestSha256 === manifest.svgListingDigestSha256 &&
    ingest.contract === SHEET_PRINT_RASTER_SURROGATE_V2 &&
    ingest.svgContentSha256 === contract.svgContentSha256 &&
    ingest.placeholderPngSha256 === contract.pngByteSha256
  );
}

function isOptionalFullRasterUnavailableWithEvidence({ source, artifact, trail, key, value }) {
  if (source !== 'evidence-package') return false;
  if (key !== 'fullRasterExportStatus') return false;
  if (normalize(value) !== OPTIONAL_FULL_RASTER_UNAVAILABLE) return false;
  const row = deterministicSheetRowForPath(artifact, trail);
  if (!row) return false;

  const currentNode = getPathValue(artifact, trail.slice(0, -1));
  if (!isObject(currentNode)) return false;
  const validCarrier =
    currentNode === row.sheetPrintRasterPrintContract_v3 ||
    currentNode === row.sheetExportArtifactManifest_v1?.ciBaselineCorrelation ||
    currentNode?.artifactName === 'sheet-print-raster.png';
  return validCarrier && hasEquivalentSheetRasterEvidence(row);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readEvidenceJson(evidenceDir, relativePath) {
  return readJsonIfExists(path.join(evidenceDir, relativePath));
}

function artifactFindingCount(artifact) {
  if (!isObject(artifact)) return 0;
  if (Number.isFinite(artifact.total)) return Number(artifact.total);
  if (Array.isArray(artifact.groups)) {
    return artifact.groups.reduce((sum, group) => sum + (Number(group?.count) || 0), 0);
  }
  if (Array.isArray(artifact.findings)) return artifact.findings.length;
  if (Array.isArray(artifact.violations)) return artifact.violations.length;
  return 0;
}

function chooseArtifact(...artifacts) {
  const present = artifacts.filter(isObject);
  if (present.length === 0) return null;
  return present.reduce((best, artifact) =>
    artifactFindingCount(artifact) > artifactFindingCount(best) ? artifact : best,
  );
}

function groupRows(artifact, fallbackSeverity, source) {
  if (!isObject(artifact)) return [];
  const groups = Array.isArray(artifact.groups) ? artifact.groups : [];
  return groups.filter(isObject).map((group) => ({
    source,
    code: firstString(group.code, group.ruleId, group.id, 'unknown_advisor_group'),
    severity: normalize(group.severity || fallbackSeverity),
    count: Number(group.count) || 0,
    elementIds: uniqueStrings(group.elementIds, group.affectedElementIds),
    messages: uniqueStrings(group.messages, group.message).slice(0, 5),
  }));
}

function findingRows(artifact, fallbackSeverity, source) {
  if (!isObject(artifact)) return [];
  const rows = [
    ...(Array.isArray(artifact.findings) ? artifact.findings : []),
    ...(Array.isArray(artifact.violations) ? artifact.violations : []),
  ];
  return rows.filter(isObject).map((row) => ({
    source,
    code: firstString(row.code, row.ruleId, row.id, 'unknown_finding'),
    severity: normalize(row.severity || fallbackSeverity),
    count: 1,
    elementIds: uniqueStrings(row.elementIds, row.affectedElementIds, row.ids),
    messages: uniqueStrings(row.message, row.title).slice(0, 5),
  }));
}

function collectAdvisorRows(evidenceDir) {
  const warning = chooseArtifact(
    readEvidenceJson(evidenceDir, 'advisor-warning.json'),
    readEvidenceJson(evidenceDir, 'live/advisor-warning.json'),
  );
  const error = chooseArtifact(
    readEvidenceJson(evidenceDir, 'advisor-error.json'),
    readEvidenceJson(evidenceDir, 'live/advisor-error.json'),
  );
  const all = chooseArtifact(
    readEvidenceJson(evidenceDir, 'advisor-all.json'),
    readEvidenceJson(evidenceDir, 'live/advisor-all.json'),
  );

  return [
    ...groupRows(error, 'error', 'advisor-error'),
    ...findingRows(error, 'error', 'advisor-error'),
    ...groupRows(warning, 'warning', 'advisor-warning'),
    ...findingRows(warning, 'warning', 'advisor-warning'),
    ...groupRows(all, '', 'advisor-all').filter((row) => row.severity),
    ...findingRows(all, '', 'advisor-all').filter((row) => row.severity),
  ];
}

function collectValidationRows(evidenceDir) {
  const validation = chooseArtifact(
    readEvidenceJson(evidenceDir, 'validate.json'),
    readEvidenceJson(evidenceDir, 'live/validate.json'),
  );
  if (!isObject(validation)) {
    return [
      {
        source: 'validate',
        code: 'validation_artifact_missing',
        severity: 'error',
        count: 1,
        elementIds: [],
        messages: ['validate.json is missing from target-house evidence.'],
      },
    ];
  }
  return findingRows(validation, '', 'validate');
}

function collectRecursiveDiagnostics(value, source, out = [], trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectRecursiveDiagnostics(item, source, out, [...trail, index]),
    );
    return out;
  }
  if (!isObject(value)) return out;

  const severity = normalize(value.severity);
  const code = firstString(value.code, value.ruleId, value.id, value.checkId);
  if (severity && code) {
    out.push({
      source,
      code,
      severity,
      count: Number(value.count) || 1,
      elementIds: uniqueStrings(value.elementIds, value.affectedElementIds),
      messages: uniqueStrings(value.message, value.reason, value.note).slice(0, 5),
      path: trail.join('.'),
    });
  }

  for (const [key, child] of Object.entries(value)) {
    collectRecursiveDiagnostics(child, source, out, [...trail, key]);
  }
  return out;
}

function collectRendererBlockers(evidenceDir) {
  const evidencePackage = chooseArtifact(
    readEvidenceJson(evidenceDir, 'evidence-package.json'),
    readEvidenceJson(evidenceDir, 'live/evidence-package.json'),
  );
  const visualGate = readEvidenceJson(evidenceDir, 'visual-gate.json');
  const visualContract = chooseArtifact(
    readEvidenceJson(evidenceDir, 'visual-evidence-contract.json'),
    readEvidenceJson(evidenceDir, 'live/visual-evidence-contract.json'),
  );
  const rows = [];

  for (const [source, artifact] of [
    ['evidence-package', evidencePackage],
    ['visual-gate', visualGate],
    ['visual-evidence-contract', visualContract],
  ]) {
    if (!isObject(artifact)) continue;
    const stack = [[artifact, []]];
    while (stack.length) {
      const [node, trail] = stack.pop();
      if (Array.isArray(node)) {
        node.forEach((child, index) => stack.push([child, [...trail, index]]));
        continue;
      }
      if (!isObject(node)) continue;

      for (const [key, value] of Object.entries(node)) {
        if (isObject(value) || Array.isArray(value)) {
          stack.push([value, [...trail, key]]);
          continue;
        }
        const stringValue = asString(value);
        if (
          RENDERER_KEY_RE.test(key) &&
          RENDERER_BLOCKER_VALUE_RE.test(stringValue) &&
          !/needs_review/i.test(stringValue)
        ) {
          if (
            isOptionalFullRasterUnavailableWithEvidence({
              source,
              artifact,
              trail: [...trail, key],
              key,
              value: stringValue,
            })
          ) {
            continue;
          }
          rows.push({
            source,
            code: `${key}:${normalize(stringValue)}`,
            severity: 'error',
            count: 1,
            elementIds: [],
            messages: [`${key}=${stringValue}`],
            path: [...trail, key].join('.'),
          });
        }
      }
    }
  }

  return rows;
}

function mergeDiagnosticRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.severity}:${row.code}`;
    const existing = byKey.get(key) ?? {
      ...row,
      source: '',
      sources: [],
      sourceCounts: new Map(),
      elementIds: [],
      messages: [],
    };
    existing.sources = uniqueStrings(existing.sources, row.source);
    existing.sourceCounts.set(row.source, (existing.sourceCounts.get(row.source) ?? 0) + row.count);
    existing.elementIds = uniqueStrings(existing.elementIds, row.elementIds);
    existing.messages = uniqueStrings(existing.messages, row.messages).slice(0, 8);
    existing.path = firstString(existing.path, row.path);
    byKey.set(key, existing);
  }
  return [...byKey.values()].map((row) => {
    const sourceCounts = [...row.sourceCounts.values()];
    return {
      ...row,
      source: row.sources.join('+'),
      count: sourceCounts.length ? Math.max(...sourceCounts) : row.count,
      sourceCounts: undefined,
    };
  });
}

function toleranceRows(toleranceLedger) {
  if (!isObject(toleranceLedger)) return [];
  const rows = Array.isArray(toleranceLedger.tolerances)
    ? toleranceLedger.tolerances
    : Array.isArray(toleranceLedger.entries)
      ? toleranceLedger.entries
      : [];
  return rows.filter(isObject);
}

function toleranceCodes(row) {
  return uniqueStrings(
    row.code,
    row.ruleId,
    row.findingCode,
    row.findingCodes,
    row.affectedFindingCodes,
    row.affectedRuleIds,
    row.advisorCodes,
    row.rendererCodes,
    row.integrityCodes,
  );
}

function validateToleranceRow(row) {
  const missing = [];
  if (!firstString(row.reason, row.toleranceReason, row.phaseRationale)) missing.push('reason');
  if (!firstString(row.owner, row.acceptedBy)) missing.push('owner');
  if (!firstString(row.expiryCondition, row.expiresWhen, row.expiresAt)) {
    missing.push('expiryCondition');
  }
  if (uniqueStrings(row.evidenceLinks, row.evidencePaths, row.evidencePath).length === 0) {
    missing.push('evidenceLinks');
  }
  return missing;
}

function matchTolerance(warning, rows) {
  const warningCode = normalize(warning.code);
  for (const row of rows) {
    const codes = toleranceCodes(row).map(normalize);
    if (codes.includes(warningCode) || codes.includes('*')) return row;
  }
  return null;
}

export function evaluateTargetHouseCleanPassGate({
  evidenceDir,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!evidenceDir) throw new Error('evidenceDir is required.');
  const toleranceLedger =
    chooseArtifact(
      readEvidenceJson(evidenceDir, 'tolerance-ledger.json'),
      readEvidenceJson(evidenceDir, 'live/tolerance-ledger.json'),
    ) ?? {};
  const tolerances = toleranceRows(toleranceLedger);

  const rows = mergeDiagnosticRows([
    ...collectAdvisorRows(evidenceDir),
    ...collectValidationRows(evidenceDir),
    ...collectRecursiveDiagnostics(
      chooseArtifact(
        readEvidenceJson(evidenceDir, 'constructability-report.json'),
        readEvidenceJson(evidenceDir, 'live/constructability-report.json'),
      ),
      'constructability-report',
    ),
  ]);
  const rendererBlockers = collectRendererBlockers(evidenceDir);
  const errors = rows.filter((row) => ERROR_SEVERITIES.has(row.severity));
  const warnings = rows.filter((row) => WARNING_SEVERITIES.has(row.severity));

  const unresolvedWarnings = [];
  const toleratedWarnings = [];
  for (const warning of warnings) {
    const tolerance = matchTolerance(warning, tolerances);
    if (!tolerance) {
      unresolvedWarnings.push({ ...warning, missingTolerance: ['ledgerRow'] });
      continue;
    }
    const missing = validateToleranceRow(tolerance);
    if (missing.length) unresolvedWarnings.push({ ...warning, missingTolerance: missing });
    else
      toleratedWarnings.push({
        ...warning,
        toleranceId: firstString(tolerance.id, tolerance.code),
      });
  }

  const blockers = [
    ...errors.map((row) => ({ ...row, blockerKind: 'p0_error' })),
    ...rendererBlockers.map((row) => ({ ...row, blockerKind: 'renderer_blocker' })),
    ...unresolvedWarnings.map((row) => ({ ...row, blockerKind: 'warning_without_tolerance' })),
  ];

  return {
    schemaVersion: TARGET_HOUSE_CLEAN_PASS_GATE_SCHEMA_VERSION,
    generatedAt,
    targetId: 'target-house-1',
    evidenceDir,
    ok: blockers.length === 0,
    summary: {
      p0ErrorCount: errors.reduce((sum, row) => sum + row.count, 0),
      rendererBlockerCount: rendererBlockers.length,
      warningCount: warnings.reduce((sum, row) => sum + row.count, 0),
      toleratedWarningGroupCount: toleratedWarnings.length,
      unresolvedWarningGroupCount: unresolvedWarnings.length,
      toleranceCount: tolerances.length,
      blockerCount: blockers.length,
    },
    blockers,
    p0Errors: errors,
    rendererBlockers,
    warnings,
    toleratedWarnings,
    unresolvedWarnings,
    toleranceLedger: {
      ok: toleranceLedger.ok ?? null,
      toleranceCount: tolerances.length,
      requiredFields: ['reason', 'owner', 'expiryCondition', 'evidenceLinks'],
    },
  };
}

function parseArgs(argv) {
  const args = {
    evidenceDir: path.join(
      process.cwd(),
      'seed-artifacts',
      'target-house-1',
      'evidence',
      'live-run-current',
    ),
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evidence-dir') args.evidenceDir = path.resolve(argv[++index]);
    else if (arg === '--out') args.out = path.resolve(argv[++index]);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/gate-target-house-clean-pass.mjs [--evidence-dir <dir>] [--out <json>]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

export function runTargetHouseCleanPassGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: args.evidenceDir });
  const rendered = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, rendered);
  } else {
    process.stdout.write(rendered);
  }
  if (!result.ok) {
    console.error(
      `target-house-1 clean-pass gate failed: ${result.summary.blockerCount} blocker(s), ${result.summary.warningCount} warning(s), ${result.summary.rendererBlockerCount} renderer blocker(s).`,
    );
    return 1;
  }
  console.error('target-house-1 clean-pass gate passed.');
  return 0;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) process.exitCode = runTargetHouseCleanPassGateCli();
