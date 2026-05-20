import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  BENCHMARK_COMMAND_TOOL_MARKERS,
  BLOCKING_EVIDENCE_STATUS_RE,
  EVIDENCE_ARTIFACT_FILE_RE,
  POSITIVE_EVIDENCE_STATUS_RE,
  SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS,
  SOURCES,
} from './audit-ui-mcp-parity.config.mjs';

const ROOT = process.cwd();

function read(relPath) {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return '';
  }
}

function normalizedId(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function parseJsonFile(relPath) {
  try {
    return JSON.parse(read(relPath));
  } catch {
    return null;
  }
}

export function listBenchmarkDirs() {
  const root = path.join(ROOT, SOURCES.benchmarkRoot);
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${SOURCES.benchmarkRoot}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

export function listBenchmarkEvidenceFiles(dir) {
  return listEvidenceArtifactFiles(dir);
}

export function listEvidenceArtifactFiles(relDir, maxDepth = 6) {
  const rootAbs = path.join(ROOT, relDir);
  const files = [];
  function visit(absDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        visit(absPath, depth + 1);
      } else if (entry.isFile()) {
        const relPath = path.relative(ROOT, absPath).replaceAll(path.sep, '/');
        if (EVIDENCE_ARTIFACT_FILE_RE.test(relPath)) files.push(relPath);
      }
    }
  }
  visit(rootAbs, 0);
  return files.sort();
}

export function benchmarkIdFromEvidence(value, source) {
  const candidates = [
    value?.benchmarkId,
    value?.benchmark?.id,
    value?.metadata?.benchmarkId,
    value?.uiEquivalence?.benchmarkId,
  ];
  const explicit = candidates.find((candidate) => typeof candidate === 'string' && candidate);
  if (explicit) return explicit;
  const match = source.match(/spec\/benchmarks\/([^/]+)/);
  return match?.[1] ?? '';
}

export function listGeneratedEvidenceFilesForBenchmark(benchmarkId) {
  if (!benchmarkId) return [];
  return listEvidenceArtifactFiles('spec/generated')
    .filter((relPath) => relPath !== 'spec/generated/ui-mcp-parity.json')
    .filter((relPath) => {
      const value = parseJsonFile(relPath);
      const artifactBenchmarkId = benchmarkIdFromEvidence(value, relPath);
      return (
        artifactBenchmarkId === benchmarkId ||
        normalizedId(relPath).includes(normalizedId(benchmarkId))
      );
    });
}

export function isBlockingEvidenceStatus(status) {
  return BLOCKING_EVIDENCE_STATUS_RE.test(String(status));
}

export function isPositiveEvidenceStatus(status) {
  const text = String(status);
  return POSITIVE_EVIDENCE_STATUS_RE.test(text) && !isBlockingEvidenceStatus(text);
}

export function addEvidenceSignal(signals, type, status, source, detail = '', options = {}) {
  const passes =
    typeof options.passes === 'boolean' ? options.passes : isPositiveEvidenceStatus(status);
  const signal = {
    type,
    status: String(status ?? 'unknown'),
    source,
    detail: String(detail ?? ''),
    passes,
    reason: String(options.reason ?? (passes ? '' : evidenceRejectionReason(status, detail))),
  };
  if (options.proof && typeof options.proof === 'object') signal.proof = options.proof;
  signals.push(signal);
}

export function evidenceRejectionReason(status, detail = '') {
  const text = `${status ?? ''} ${detail ?? ''}`;
  if (/stub|mock/i.test(text)) return 'stub or mocked artifact is not closure evidence';
  if (/traceability-only/i.test(text))
    return 'traceability-only artifact is not executable evidence';
  if (/documentation-only|docs-only|expected|declared|fixture/i.test(text)) {
    return 'documentation or fixture metadata is not closure evidence';
  }
  if (/optional|opt[-_\s]?in|requires|required/i.test(text)) {
    return 'artifact describes an optional or not-yet-run path';
  }
  if (/placeholder|todo|not[-_\s]?requested|skipped|deferred/i.test(text)) {
    return 'artifact is a placeholder or TODO';
  }
  if (/stale|expired/i.test(text)) return 'artifact is stale';
  if (/failed|failure|error|unavailable|invalid|blank/i.test(text)) {
    return 'artifact reports failed or unavailable evidence';
  }
  if (/unknown|none|missing/i.test(text)) return 'artifact does not contain a known clean status';
  return 'artifact does not contain explicit clean/pass machine-readable evidence';
}

export function statusAt(value, keys = ['status', 'mode']) {
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    if (typeof value[key] === 'string') return value[key];
  }
  return '';
}

export function httpOk(value) {
  const status = Number(value?.httpStatus ?? value?.response?.httpStatus ?? value?.statusCode);
  return !Number.isFinite(status) || (status >= 200 && status < 300);
}

export function typedBundleSurfaceOk(value, requestMode) {
  const surface = value?.publicSurface;
  if (!surface || typeof surface !== 'object') return false;
  const endpoint = String(surface.endpoint ?? surface.url ?? '');
  return (
    surface.kind === 'cmd-v3-api' &&
    String(surface.method ?? '').toUpperCase() === 'POST' &&
    /\/api\/models\/.+\/bundles($|\?)/.test(endpoint) &&
    String(surface.requestMode ?? '') === requestMode
  );
}

export function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function countFromMaybeObject(value, keys = ['count', 'total']) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return finiteNumber(value);
  if (typeof value !== 'object') return null;
  for (const key of keys) {
    const parsed = finiteNumber(value[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function normalizedKindCount(countsByKind, matchers) {
  if (!countsByKind || typeof countsByKind !== 'object' || Array.isArray(countsByKind)) return 0;
  let count = 0;
  for (const [kind, rawCount] of Object.entries(countsByKind)) {
    const normalized = normalizedId(kind);
    if (!matchers.some((matcher) => matcher.test(normalized))) continue;
    const parsed = finiteNumber(rawCount);
    if (parsed !== null) count += parsed;
  }
  return count;
}

export function semanticCountsFrom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source =
    value.semanticCounts && typeof value.semanticCounts === 'object'
      ? value.semanticCounts
      : value.counts && typeof value.counts === 'object'
        ? value.counts
        : value;
  const countsByKind =
    source.countsByKind ??
    source.elementCountsByKind ??
    source.kindCounts ??
    source.elementsByKind ??
    null;
  const walls =
    countFromMaybeObject(source.walls) ??
    countFromMaybeObject(source.wall) ??
    normalizedKindCount(countsByKind, [/wall/]);
  const openings =
    countFromMaybeObject(source.openings) ??
    countFromMaybeObject(source.opening) ??
    (() => {
      const doors = countFromMaybeObject(source.doors) ?? countFromMaybeObject(source.door) ?? 0;
      const windows =
        countFromMaybeObject(source.windows) ?? countFromMaybeObject(source.window) ?? 0;
      const hosted = countFromMaybeObject(source.hosted);
      const fromKinds = normalizedKindCount(countsByKind, [/opening/, /door/, /window/]);
      return Math.max(doors + windows, hosted ?? 0, fromKinds);
    })();
  const floors =
    countFromMaybeObject(source.floors) ??
    countFromMaybeObject(source.floor) ??
    normalizedKindCount(countsByKind, [/floor/, /slab/]);
  const roofs =
    countFromMaybeObject(source.roofs) ??
    countFromMaybeObject(source.roof) ??
    normalizedKindCount(countsByKind, [/roof/]);

  if ([walls, openings, floors, roofs].every((count) => count === null || count === 0)) {
    return null;
  }
  return {
    walls: walls ?? 0,
    openings: openings ?? 0,
    floors: floors ?? 0,
    roofs: roofs ?? 0,
  };
}

export function simpleHouseSemanticCountsOk(counts) {
  return (
    counts &&
    Object.entries(SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS).every(
      ([key, minimum]) => Number(counts[key] ?? 0) >= minimum,
    )
  );
}

export function collectChangedIds(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const ids = new Set();
  for (const [key, child] of Object.entries(value)) {
    if (/^changed(Element)?Ids$/i.test(key) && Array.isArray(child)) {
      for (const id of child) ids.add(String(id));
      continue;
    }
    if (child && typeof child === 'object') {
      for (const id of collectChangedIds(child, seen)) ids.add(id);
    }
  }
  return [...ids].sort();
}

export function semanticProofCandidates(value, context = value) {
  const roots = [value, context].filter((item, index, items) => {
    return item && typeof item === 'object' && items.indexOf(item) === index;
  });
  const candidates = [];
  for (const root of roots) {
    candidates.push(
      ['changedModelProof', root.changedModelProof],
      ['changedSimpleHouseProof', root.changedSimpleHouseProof],
      ['simpleHouseSemanticProof', root.simpleHouseSemanticProof],
      ['simpleHouseProof', root.simpleHouseProof],
      ['committedModelProof', root.committedModelProof],
      ['semanticProof', root.semanticProof],
      ['postCommit.snapshot.summary', root.postCommit?.snapshot?.summary],
      ['snapshotSummary.snapshot', root.snapshotSummary?.snapshot],
      ['snapshotSummary', root.snapshotSummary],
      ['source.changedModelProof', root.source?.changedModelProof],
      ['source.simpleHouseSemanticProof', root.source?.simpleHouseSemanticProof],
      ['committedEvidence.changedModelProof', root.committedEvidence?.changedModelProof],
      [
        'committedEvidence.changedSimpleHouseProof',
        root.committedEvidence?.changedSimpleHouseProof,
      ],
      [
        'committedEvidence.simpleHouseSemanticProof',
        root.committedEvidence?.simpleHouseSemanticProof,
      ],
      [
        'committedEvidence.snapshotSummary.snapshot',
        root.committedEvidence?.snapshotSummary?.snapshot,
      ],
      ['committedEvidence.snapshotSummary', root.committedEvidence?.snapshotSummary],
      [
        'committedEvidence.source.changedModelProof',
        root.committedEvidence?.source?.changedModelProof,
      ],
      ['visual.changedModelProof', root.visual?.changedModelProof],
      ['visual.source.changedModelProof', root.visual?.source?.changedModelProof],
      ['exports.changedModelProof', root.exports?.changedModelProof],
      ['exports.source.changedModelProof', root.exports?.source?.changedModelProof],
    );
  }
  return candidates.filter(([, candidate]) => candidate && typeof candidate === 'object');
}

export function changedSimpleHouseProof(value, context = value) {
  const changedIds = collectChangedIds({ value, context });
  if (!changedIds.length) {
    return { ok: false, changedIds, reason: 'changed ids are absent' };
  }
  for (const [source, candidate] of semanticProofCandidates(value, context)) {
    const counts = semanticCountsFrom(candidate);
    if (simpleHouseSemanticCountsOk(counts)) {
      return {
        ok: true,
        changedIds,
        counts,
        source,
      };
    }
  }
  return {
    ok: false,
    changedIds,
    reason:
      'simple-house semantic counts are absent or below expected wall/opening/floor/roof counts',
  };
}

export function simpleHouseRequestProof(value, context = value) {
  const candidates = [value, context].filter(Boolean);
  const commandCounts = candidates
    .flatMap((candidate) => [
      candidate?.request?.commandCount,
      candidate?.commandCount,
      candidate?.request?.commands?.length,
      candidate?.commands?.length,
    ])
    .map(finiteNumber)
    .filter((count) => count !== null);
  const commandCount = commandCounts.length ? Math.max(...commandCounts) : 0;
  const commandTypes = [
    ...new Set(
      candidates.flatMap((candidate) => [
        ...(Array.isArray(candidate?.request?.commandTypes) ? candidate.request.commandTypes : []),
        ...(Array.isArray(candidate?.commandTypes) ? candidate.commandTypes : []),
        ...(Array.isArray(candidate?.request?.commands)
          ? candidate.request.commands.map((command) => command?.type).filter(Boolean)
          : []),
        ...(Array.isArray(candidate?.commands)
          ? candidate.commands.map((command) => command?.type).filter(Boolean)
          : []),
      ]),
    ),
  ].sort();
  const hasCoreSemanticCommands = [
    'createWallChain',
    'createFloor',
    'createRoof',
    'insertDoorOnWall',
    'insertWindowOnWall',
  ].every((type) => commandTypes.includes(type));
  const ok = commandCount >= 20 || hasCoreSemanticCommands;
  return {
    ok,
    commandCount,
    commandTypes: commandTypes.slice(0, 20),
    reason: ok ? '' : 'simple-house command count/types are absent',
  };
}

export function liveExecutionRejectionReason(value, requestMode, context = value) {
  if (!value || typeof value !== 'object') return 'live execution artifact is missing or invalid';
  const status = statusAt(value);
  if (isBlockingEvidenceStatus(status)) return evidenceRejectionReason(status);
  if (value.ok !== true) return 'live execution artifact does not report ok=true';
  if (value.response?.ok === false || value.response?.bodyOk === false) {
    return 'live execution response is not ok';
  }
  if (value.validation?.ok === false) return 'live execution validation is not ok';
  if (!httpOk(value)) return 'live execution HTTP status is not successful';
  if (!typedBundleSurfaceOk(value, requestMode)) {
    return 'live execution artifact is not from the typed cmd-v3 bundle API';
  }
  const commandCount = Number(value.request?.commandCount ?? 0);
  if (!Number.isFinite(commandCount) || commandCount <= 0) {
    return 'live execution artifact does not include a command payload count';
  }
  if (requestMode === 'dry_run' && !simpleHouseRequestProof(value, context).ok) {
    return 'live dry-run artifact does not include simple-house command intent proof';
  }
  if (requestMode === 'commit') {
    const changedIds = collectChangedIds(value);
    if (!changedIds.length) {
      return 'live commit artifact does not include changed ids';
    }
    const hasCommitResponseProof =
      value.response?.applied === true ||
      value.response?.newRevision !== null ||
      changedIds.length > 0 ||
      value.response?.checkpointSnapshotId;
    if (!hasCommitResponseProof) {
      return 'live commit artifact does not include mutation proof';
    }
    if (
      value.postCommit?.commandLog?.ok !== true ||
      Number(value.postCommit?.commandLog?.summary?.entryCount ?? 0) <= 0
    ) {
      return 'live commit artifact does not include a clean post-commit command-log summary';
    }
    if (
      value.postCommit?.snapshot?.ok !== true ||
      Number(value.postCommit?.snapshot?.summary?.elementCount ?? 0) <= 0
    ) {
      return 'live commit artifact does not include a clean post-commit snapshot summary';
    }
    const proof = changedSimpleHouseProof(value, context);
    if (!proof.ok) {
      return `live commit artifact does not include changed simple-house semantic proof: ${proof.reason}`;
    }
  }
  return '';
}

export function executionOk(value, requestMode = null, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (requestMode) return liveExecutionRejectionReason(value, requestMode, context) === '';
  return value.ok === true && liveExecutionRejectionReason(value, 'dry_run', context) === '';
}

export function validationClean(validation) {
  if (!validation || typeof validation !== 'object') return false;
  if (validation.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(validation, ['status', 'result', 'outcome']))) return false;
  const checks =
    validation.checks && typeof validation.checks === 'object' ? validation.checks : {};
  const blocking = Number(
    checks.blockingViolationCount ??
      checks.errorViolationCount ??
      validation.blockingViolationCount ??
      validation.errorViolationCount ??
      0,
  );
  if (Number.isFinite(blocking) && blocking > 0) return false;
  const violations = validation.violations;
  if (
    Array.isArray(violations) &&
    violations.some((item) => /error|blocking/i.test(item?.severity))
  ) {
    return false;
  }
  return true;
}

export function advisorClean(advisor) {
  if (!advisor || typeof advisor !== 'object') return true;
  if (advisor.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(advisor, ['status', 'result', 'outcome']))) return false;
  const summaryStatus = advisor.summary?.status;
  if (typeof summaryStatus === 'string' && /fail|error|block/i.test(summaryStatus)) return false;
  const findings = Array.isArray(advisor.findings) ? advisor.findings : [];
  return !findings.some((item) => /error|blocking/i.test(item?.severity ?? item?.level ?? ''));
}

export function semanticDiffClean(diff) {
  if (Array.isArray(diff)) return diff.length === 0;
  if (!diff || typeof diff !== 'object') return false;
  if (diff.ok === true || diff.clean === true || diff.passed === true) return true;
  if (
    Number(diff.unmatchedFixtureCommandCount ?? 0) === 0 &&
    Number(diff.unexpectedReplayCommandCount ?? 0) === 0 &&
    diff.countDeltaByCommandType &&
    typeof diff.countDeltaByCommandType === 'object' &&
    Object.values(diff.countDeltaByCommandType).every((value) => Number(value) === 0)
  ) {
    return true;
  }
  const counts = [
    diff.mismatchCount,
    diff.differenceCount,
    diff.deltaCount,
    diff.failures,
    diff.errors,
  ].filter((value) => value !== undefined);
  if (counts.length && counts.every((value) => Number(value) === 0)) return true;
  const differences = diff.differences ?? diff.diffs ?? diff.items;
  return Array.isArray(differences) && differences.length === 0;
}

export function visualEvidenceClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) return false;
  if (value.stale === true || value.isStale === true || value.fresh === false) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  const raster =
    value.sheetPrintRaster && typeof value.sheetPrintRaster === 'object'
      ? value.sheetPrintRaster
      : value;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(raster))) return false;
  if (raster.pass === false || raster.ok === false || raster.nonblankProof?.ok === false) {
    return false;
  }
  const rasterText = JSON.stringify(raster);
  if (/stub|mock/i.test(rasterText)) {
    return false;
  }
  if (value.nonblankProof?.ok === true || value.sheetPrintRaster?.nonblankProof?.ok === true) {
    return true;
  }
  if (
    value.ok === true &&
    /nonblank|server-side-substitute|render|screenshot/i.test(JSON.stringify(value))
  ) {
    return true;
  }
  return false;
}

export function exportEvidenceClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  const candidates = [
    ...Object.values(value.manifests ?? {}),
    ...Object.values(value.artifacts ?? {}),
    value,
  ].filter((candidate) => candidate && typeof candidate === 'object');
  return candidates.some((candidate) => {
    const text = JSON.stringify(candidate);
    return (
      /artifact-returned|manifest-returned|artifact-or-manifest-returned/i.test(text) &&
      !/stub|mock|placeholder|todo|blank-artifact|invalid|failed/i.test(text)
    );
  });
}

export function committedAdvisorValidationClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (value.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(value))) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  if (value.validationPass === true && value.advisorPass === true) return true;
  if (value.validationResult?.pass === true && value.advisorResult?.pass === true) return true;
  return validationClean(value.validation) && advisorClean(value.advisor);
}

export function committedAdvisorValidationRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') {
    return 'committed advisor/validation artifact is missing or invalid';
  }
  if (value.ok === false) return 'committed advisor/validation artifact reports ok=false';
  const status = statusAt(value);
  if (isBlockingEvidenceStatus(status)) return evidenceRejectionReason(status);
  if (value.validationPass === false || value.validationResult?.pass === false) {
    return 'committed validation evidence did not pass';
  }
  if (value.advisorPass === false || value.advisorResult?.pass === false) {
    return 'committed advisor evidence did not pass';
  }
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `committed advisor/validation artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'committed advisor/validation artifact is not clean';
}

export function visualEvidenceRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') return 'visual/render artifact is missing or invalid';
  const raster =
    value.sheetPrintRaster && typeof value.sheetPrintRaster === 'object'
      ? value.sheetPrintRaster
      : value;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(raster))) {
    return evidenceRejectionReason(statusAt(raster));
  }
  if (raster.pass === false || raster.ok === false || raster.nonblankProof?.ok === false) {
    return 'visual/render artifact is blank, invalid, or failed';
  }
  const rasterText = JSON.stringify(raster);
  if (/stub|mock/i.test(rasterText)) return 'visual/render artifact is a stub or mocked raster';
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `visual/render artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'visual/render artifact does not include clean nonblank proof';
}

export function exportEvidenceRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') return 'export artifact is missing or invalid';
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) {
    return evidenceRejectionReason(statusAt(value));
  }
  if (/stub|mock/i.test(JSON.stringify(value))) return 'export artifact is a stub or mock';
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `export artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'export artifact/manifest evidence is unavailable or not clean';
}

export function topLevelUiEvidenceBlocked(value) {
  const statuses = [
    value?.status,
    value?.pathKind,
    value?.auditClassification,
    value?.parityClaim,
    value?.freshness,
  ].filter((item) => typeof item === 'string');
  return statuses.some((status) => isBlockingEvidenceStatus(status));
}

export function uiEquivalentEvidenceClean(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.ok === false || value.uiEquivalentEvidence === false) return false;
  if (topLevelUiEvidenceBlocked(value)) return false;
  const status = String(value.status ?? value.pathKind ?? value.auditClassification ?? '');
  const explicitlyValidated =
    value.uiEquivalentEvidence === true ||
    /validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status);
  if (!explicitlyValidated) return false;
  const semanticDiff =
    value.semanticDiff ?? value.semanticReplayDiff ?? value.diff ?? value.replayDiff ?? null;
  if (!semanticDiffClean(semanticDiff)) return false;
  const rows = Array.isArray(value.cmdKBridgeCoverage?.rows) ? value.cmdKBridgeCoverage.rows : [];
  return !rows.some(
    (row) =>
      /blocked|activator/i.test(String(row.bridgeStatus ?? '')) &&
      row.completedByCmdK === true &&
      row.exactFixturePayloadExecutable !== false,
  );
}

export function collectJsonEvidenceSignals(value, source) {
  if (!value || typeof value !== 'object') return [];
  const signals = [];
  const sourceName = path.basename(source);
  const statusText = JSON.stringify(value).slice(0, 50000);
  const execution =
    value.executionEvidence && typeof value.executionEvidence === 'object'
      ? value.executionEvidence
      : value;
  const liveDryRun =
    execution.liveDryRun && typeof execution.liveDryRun === 'object'
      ? execution.liveDryRun
      : execution;
  const liveCommit =
    execution.liveCommit && typeof execution.liveCommit === 'object'
      ? execution.liveCommit
      : execution;

  if (/execution-evidence|live-dry-run-evidence|benchmark-result/i.test(sourceName)) {
    const mode = String(liveDryRun.mode ?? execution.mode ?? value.mode ?? '');
    if (/live/i.test(mode) && /dry[-_\s]?run/i.test(mode)) {
      const requestProof = simpleHouseRequestProof(liveDryRun, value);
      const passes = executionOk(liveDryRun, 'dry_run', value);
      addEvidenceSignal(
        signals,
        'liveDryRunEvidence',
        passes ? 'live-dry-run-clean' : statusAt(liveDryRun) || mode,
        source,
        mode,
        {
          passes,
          reason: passes ? '' : liveExecutionRejectionReason(liveDryRun, 'dry_run', value),
          proof: passes
            ? {
                simpleHouseRequestProof: true,
                commandCount: requestProof.commandCount,
                commandTypes: requestProof.commandTypes,
              }
            : undefined,
        },
      );
    }
  }

  if (/execution-evidence|live-commit-evidence|benchmark-result/i.test(sourceName)) {
    const mode = String(liveCommit.mode ?? execution.mode ?? value.mode ?? '');
    if (/live/i.test(mode) && /commit/i.test(mode)) {
      const proof = changedSimpleHouseProof(liveCommit, value);
      const passes = executionOk(liveCommit, 'commit', value);
      addEvidenceSignal(
        signals,
        'liveCommitEvidence',
        passes ? 'live-commit-clean' : statusAt(liveCommit) || mode,
        source,
        mode,
        {
          passes,
          reason: passes ? '' : liveExecutionRejectionReason(liveCommit, 'commit', value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/committed-evidence|advisor-validation|benchmark-result/i.test(sourceName)) {
    const committed =
      value.committedEvidence && typeof value.committedEvidence === 'object'
        ? value.committedEvidence
        : value;
    const committedMode = String(committed.mode ?? '');
    if (
      /committed|post[-_\s]?commit/i.test(`${committedMode} ${statusText}`) ||
      /advisor-validation/i.test(sourceName)
    ) {
      const proof = changedSimpleHouseProof(committed, value);
      const passes = committedAdvisorValidationClean(committed, value);
      addEvidenceSignal(
        signals,
        'committedAdvisorValidation',
        passes ? 'committed-advisor-validation-clean' : statusAt(committed) || 'committed-evidence',
        source,
        committedMode || 'committed advisor/validation artifact',
        {
          passes,
          reason: passes ? '' : committedAdvisorValidationRejectionReason(committed, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/visual|render|screenshot|committed-evidence|benchmark-result/i.test(sourceName)) {
    const visual = value.visual ?? value.committedEvidence?.visual ?? value;
    const claimsVisual = /visual|render|screenshot|nonblank|sheetPrintRaster/i.test(
      `${sourceName} ${statusText}`,
    );
    if (claimsVisual) {
      const proof = changedSimpleHouseProof(visual, value);
      const passes = visualEvidenceClean(visual, value);
      addEvidenceSignal(
        signals,
        'visualRenderEvidence',
        passes ? 'visual-render-clean' : statusAt(visual) || 'visual-evidence',
        source,
        'visual/render evidence artifact',
        {
          passes,
          reason: passes ? '' : visualEvidenceRejectionReason(visual, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/export|committed-evidence|benchmark-result/i.test(sourceName)) {
    const exports = value.exports ?? value.committedEvidence?.exports ?? value;
    const claimsExport = /export|ifc|gltf|glb|pdf|manifest|artifact/i.test(
      `${sourceName} ${statusText}`,
    );
    if (claimsExport) {
      const proof = changedSimpleHouseProof(exports, value);
      const passes = exportEvidenceClean(exports, value);
      addEvidenceSignal(
        signals,
        'exportEvidence',
        passes ? 'export-clean' : statusAt(exports) || 'export-evidence',
        source,
        'export evidence artifact',
        {
          passes,
          reason: passes ? '' : exportEvidenceRejectionReason(exports, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/ui-cmdk-traceability|ui-equivalence|ui-equivalent/i.test(sourceName)) {
    const ui =
      value.uiEquivalence && typeof value.uiEquivalence === 'object' ? value.uiEquivalence : value;
    const pathKind = String(ui.pathKind ?? ui.kind ?? ui.mode ?? ui.status ?? '');
    const semanticDiff =
      ui.semanticDiff ??
      ui.semanticReplayDiff ??
      value.semanticDiff ??
      value.semanticReplayDiff ??
      ui.diff ??
      value.diff;
    const hasBlockers =
      (Array.isArray(ui.remainingUiBlockers) && ui.remainingUiBlockers.length > 0) ||
      (Array.isArray(ui.blockers) && ui.blockers.length > 0) ||
      (Array.isArray(ui.todos) && ui.todos.length > 0) ||
      (Array.isArray(ui.remainingExitCriteria) && ui.remainingExitCriteria.length > 0);
    const passes = uiEquivalentEvidenceClean(ui);
    addEvidenceSignal(
      signals,
      'uiEquivalentPath',
      passes ? 'ui-equivalence-clean' : pathKind || statusAt(ui) || 'ui-equivalence',
      source,
      semanticDiff === undefined ? 'missing semantic diff' : 'semantic diff checked',
      {
        passes,
        reason: passes
          ? ''
          : hasBlockers
            ? 'UI-equivalence artifact still lists blockers or TODOs'
            : 'UI-equivalence artifact is not executable, clean, and semantically equal',
      },
    );
  }
  return signals;
}

export function flattenEvidenceExpectations(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return [];
  const rows = [];
  for (const [key, child] of Object.entries(value)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (child === true || child === false) {
      rows.push({ id, status: String(child), todo: '' });
    } else if (child && typeof child === 'object') {
      if ('status' in child || 'todo' in child) {
        rows.push({
          id,
          status: String(child.status ?? 'declared'),
          todo: String(child.todo ?? ''),
        });
        continue;
      }
      rows.push(...flattenEvidenceExpectations(child, id));
    }
  }
  return rows;
}

export function parseBenchmarkEvidence() {
  return listBenchmarkDirs().map((dir) => {
    const expectedPath = `${dir}/expected-semantics.json`;
    const bundlePath = `${dir}/mcp-cli-command-bundle.json`;
    const expected = parseJsonFile(expectedPath) ?? {};
    const bundle = parseJsonFile(bundlePath) ?? {};
    const commands = Array.isArray(bundle.commands) ? bundle.commands : [];
    const commandTypes = [...new Set(commands.map((cmd) => cmd?.type).filter(Boolean))].sort();
    const toolMarkers = [];
    for (const commandType of commandTypes) {
      for (const toolId of BENCHMARK_COMMAND_TOOL_MARKERS.get(commandType) ?? []) {
        toolMarkers.push({
          toolId,
          marker: commandType,
          status: 'fixture-command',
          source: bundlePath,
          live: false,
          note: 'Command appears in deterministic MCP/CLI fixture; this is not live typed execution evidence.',
        });
      }
    }
    const paths = expected.paths && typeof expected.paths === 'object' ? expected.paths : {};
    const pathRows = Object.entries(paths).map(([id, value]) => ({
      id,
      status: String(value?.status ?? 'unknown'),
      todo: String(value?.todo ?? ''),
    }));
    const evidenceRows = flattenEvidenceExpectations(expected.evidenceExpectations ?? {});
    const evidenceSignals = [];
    for (const row of evidenceRows) {
      if (row.id === 'advisor') {
        toolMarkers.push({
          toolId: 'qa.advisor',
          marker: 'advisor evidence expectation',
          status: row.status,
          source: expectedPath,
          live: row.status === 'live' || row.status === 'validated',
          note: row.todo || 'Advisor evidence expectation declared by benchmark.',
        });
      }
      if (/(^|\.)(todo|artifacts?)(\.|$)/i.test(row.id)) continue;
      if (/live[-_\s]?dry[-_\s]?run/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveDryRunEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not live dry-run evidence',
          },
        );
      }
      if (/live[-_\s]?commit/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveCommitEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not live commit evidence',
          },
        );
      }
      if (/advisor|validation|constructability/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'committedAdvisorValidation',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason:
              'expected-semantics metadata is documentation, not committed advisor/validation evidence',
          },
        );
      }
      if (/screenshot|visual|render/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'visualRenderEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not visual/render evidence',
          },
        );
      }
      if (/export|ifc|gltf|glb|pdf/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'exportEvidence', row.status, expectedPath, row.todo, {
          passes: false,
          reason: 'expected-semantics metadata is documentation, not export evidence',
        });
      }
    }
    for (const row of pathRows) {
      if (
        /live[-_\s]?dry[-_\s]?run|dry[-_\s]?run.*live/i.test(row.status) &&
        isPositiveEvidenceStatus(row.status)
      ) {
        toolMarkers.push({
          toolId: 'model.dry_run',
          marker: `${row.id} path status`,
          status: row.status,
          source: expectedPath,
          live: true,
          note: row.todo || 'Benchmark path declares live dry-run evidence.',
        });
      }
      if (/live[-_\s]?dry[-_\s]?run|dry[-_\s]?run.*live/i.test(row.status)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveDryRunEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'benchmark path metadata is not a clean live dry-run artifact',
          },
        );
      }
      if (
        /live[-_\s]?commit|commit.*live/i.test(row.status) &&
        isPositiveEvidenceStatus(row.status)
      ) {
        toolMarkers.push({
          toolId: 'model.commit_bundle',
          marker: `${row.id} path status`,
          status: row.status,
          source: expectedPath,
          live: true,
          note: row.todo || 'Benchmark path declares live commit evidence.',
        });
      }
      if (/live[-_\s]?commit|commit.*live/i.test(row.status)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveCommitEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'benchmark path metadata is not a clean live commit artifact',
          },
        );
      }
      if (/ui/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'uiEquivalentPath', row.status, expectedPath, row.todo, {
          passes: false,
          reason: 'benchmark path metadata is not executable UI-equivalence evidence',
        });
      }
    }
    const mcpCliPath = paths.mcpCli && typeof paths.mcpCli === 'object' ? paths.mcpCli : {};
    const liveDryRun = mcpCliPath.liveDryRun;
    if (liveDryRun && typeof liveDryRun === 'object') {
      addEvidenceSignal(
        evidenceSignals,
        'liveDryRunEvidence',
        liveDryRun.status,
        expectedPath,
        liveDryRun.mode ? `mode=${liveDryRun.mode}` : '',
        {
          passes: false,
          reason: 'benchmark liveDryRun metadata is optional configuration, not run evidence',
        },
      );
    }
    const artifactPaths = [
      ...new Set([
        ...listBenchmarkEvidenceFiles(dir),
        ...listGeneratedEvidenceFilesForBenchmark(expected.benchmarkId ?? path.basename(dir)),
      ]),
    ].sort();
    for (const relPath of artifactPaths) {
      evidenceSignals.push(...collectJsonEvidenceSignals(parseJsonFile(relPath), relPath));
    }
    return {
      id: expected.benchmarkId ?? path.basename(dir),
      dir,
      expectedSemantics: fs.existsSync(path.join(ROOT, expectedPath)) ? expectedPath : '',
      commandBundle: fs.existsSync(path.join(ROOT, bundlePath)) ? bundlePath : '',
      pathStatus: pathRows,
      evidenceExpectations: evidenceRows,
      evidenceArtifactPaths: artifactPaths,
      commandTypes,
      toolMarkers: toolMarkers.sort((a, b) => a.toolId.localeCompare(b.toolId)),
      evidenceSignals: evidenceSignals.sort(
        (a, b) => a.type.localeCompare(b.type) || a.source.localeCompare(b.source),
      ),
      uiEquivalentStatus: String(paths.ui?.status ?? 'unknown'),
      uiEquivalentTodo: String(paths.ui?.todo ?? ''),
      liveEvidence: toolMarkers.some((marker) => marker.live),
    };
  });
}

