import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  M3_WAVE2_WORKSTREAMS,
  M3_WAVE3_WORKSTREAMS,
  M4_WAVE1_WORKSTREAMS,
  SOURCES,
} from './audit-ui-mcp-parity.config.mjs';
import {
  evidenceRejectionReason,
  isBlockingEvidenceStatus,
  isPositiveEvidenceStatus,
  parseJsonFile,
  semanticDiffClean,
  topLevelUiEvidenceBlocked,
} from './audit-ui-mcp-parity.evidence.mjs';

const ROOT = process.cwd();
const UNKNOWN = 'unknown';

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

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || UNKNOWN;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function descriptorMatchesStableId(row, id) {
  return [row.id, row.stableId].some((value) => normalizedId(value) === normalizedId(id));
}

function statusFromGates(gates) {
  if (gates.every((gate) => gate.passed)) return 'Done';
  if (gates.some((gate) => gate.status === 'partial' || gate.passed)) return 'Partial';
  return 'Not Started';
}

function m3Gate(id, label, passed, blocker, evidence = [], partial = false) {
  return {
    id,
    label,
    status: passed ? 'passed' : partial ? 'partial' : 'blocked',
    passed,
    blocker: passed ? '' : blocker,
    evidence,
  };
}

function sketchSurfaceEvidence(apiLedger, surfaceId) {
  const descriptor = apiLedger.find((row) => descriptorMatchesStableId(row, surfaceId));
  if (descriptor) {
    return {
      type: 'api-descriptor',
      status: descriptor.routeImplemented ? 'implemented' : 'route-mismatch',
      source: descriptor.source,
      detail: `${descriptor.id} -> ${descriptor.method} ${descriptor.path}`,
      passes: descriptor.routeImplemented,
    };
  }

  const productMap = read('spec/methodology/sketch-to-bim-product-surfaces.md');
  const text = productMap.toLowerCase();
  const mentionsSurface = text.includes(surfaceId.toLowerCase());
  const mentionsCli =
    (surfaceId === 'sketch.ir.validate' && /initiation-check|initiation-run/.test(text)) ||
    (surfaceId === 'sketch.seed.compile' && /seed-dsl compile/.test(text)) ||
    (surfaceId === 'sketch.phase.apply' && /apply-bundle/.test(text)) ||
    (surfaceId === 'sketch.phase.accept' && /fail-on-acceptance|phase acceptance/.test(text));

  return {
    type: 'product-map',
    status: mentionsCli || mentionsSurface ? 'cli-or-gap-documented' : 'missing',
    source: 'spec/methodology/sketch-to-bim-product-surfaces.md',
    detail:
      mentionsCli || mentionsSurface
        ? 'Product map documents a CLI/generic path or explicit gap, but no stable API/MCP descriptor was detected.'
        : 'No product descriptor, CLI mapping, or blocker text was detected.',
    passes: false,
  };
}

function buildM3SketchWorkstream(apiLedger) {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-F');
  const gates = config.requiredSurfaces.map((surfaceId) => {
    const evidence = [sketchSurfaceEvidence(apiLedger, surfaceId)];
    const passed = evidence.some((item) => item.passes);
    return m3Gate(
      surfaceId,
      surfaceId,
      passed,
      `No implemented stable API/MCP descriptor was detected for ${surfaceId}. CLI-only or product-map entries remain Partial evidence.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function scenarioEvidenceStatus(scenario, key) {
  const section = scenario?.evidence?.[key];
  if (!section || typeof section !== 'object') return 'missing';
  if (section.pass === true) return 'passed';
  if (['executable', 'validated-replay'].includes(section.classification)) return 'passed';
  if (isBlockingEvidenceStatus(`${section.classification ?? ''} ${section.status ?? ''}`)) {
    return section.classification === 'traceability-only' ? 'partial' : 'missing';
  }
  if (isPositiveEvidenceStatus(section.status)) return 'passed';
  if (section.classification === 'traceability-only') return 'partial';
  if ((section.artifacts ?? []).length) return 'partial';
  return 'missing';
}

function twoStoreyArtifactPath(name) {
  return `spec/benchmarks/two-storey-house-with-stair/${name}`;
}

function explicitClosurePass(value, kind) {
  const candidates = [
    value?.m3Closure?.[kind],
    value?.m3Closure?.[kind === 'cmdK' ? 'cmdk' : kind],
    value?.[`${kind}Closure`],
    kind === 'cmdK' ? value?.cmdkClosure : null,
    kind === 'ui' ? value?.uiReplay : null,
    kind === 'cmdK' ? value?.cmdKBridgeCoverage?.closure : null,
  ].filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate.pass === true ||
      candidate.passed === true ||
      candidate.semanticFixtureEquivalent === true ||
      candidate.exactFixtureSemanticEquivalence === true,
  );
}

function blockerList(value, kind) {
  const specific =
    kind === 'cmdK'
      ? [
          ...(value?.remainingCmdKBlockers ?? []),
          ...(value?.cmdKBridgeCoverage?.blockedOrUnmappedCommandTypes ?? []),
        ]
      : [...(value?.remainingUiBlockers ?? []), ...(value?.remainingUiReplayBlockers ?? [])];
  const generic = [
    ...(value?.blockers ?? []),
    ...(value?.todos ?? []),
    ...(value?.remainingExitCriteria ?? []),
  ];
  return [...specific, ...generic].filter(Boolean);
}

function uiValidatedReplayClean(value) {
  if (!value || typeof value !== 'object') return false;
  if (isBlockingEvidenceStatus(`${value.classification ?? ''} ${value.status ?? ''}`)) return false;
  if (!/validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(value.classification)) {
    return false;
  }
  const proof = value.proof ?? {};
  const fixtureCount = Number(proof.fixtureCommandCount ?? 0);
  const replayCount = Number(proof.replayCommandCount ?? 0);
  return (
    fixtureCount > 0 &&
    fixtureCount === replayCount &&
    proof.fixtureCommandSequenceSha256 &&
    proof.fixtureCommandSequenceSha256 === proof.replayCommandSequenceSha256 &&
    Number(proof.sequenceMismatchCount ?? 0) === 0 &&
    Number(proof.unmatchedFixtureCommandCount ?? 0) === 0 &&
    Number(proof.unexpectedReplayCommandCount ?? 0) === 0 &&
    (!Array.isArray(proof.payloadDigestMismatches) || proof.payloadDigestMismatches.length === 0) &&
    Array.isArray(value.inputMapping) &&
    value.inputMapping.length === fixtureCount
  );
}

function twoStoreyUiClosureEvidence(kind) {
  const equivalencePath = twoStoreyArtifactPath('ui-equivalence.json');
  const uiReplayPath = twoStoreyArtifactPath('ui-validated-replay.json');
  const tracePath = twoStoreyArtifactPath('ui-cmdk-traceability.json');
  const equivalence = parseJsonFile(equivalencePath);
  const uiReplay = parseJsonFile(uiReplayPath);
  const traceability = parseJsonFile(tracePath);
  if (!equivalence) {
    return {
      type: 'two-storey-closure',
      status: 'missing',
      source: equivalencePath,
      detail: `${kind} closure evidence artifact is missing.`,
      passes: false,
      reason: `${equivalencePath} is missing.`,
    };
  }

  const uiReplayClean = uiValidatedReplayClean(uiReplay);
  const status = String(
    kind === 'ui' && uiReplay
      ? (uiReplay.classification ?? uiReplay.status ?? '')
      : (equivalence.auditClassification ?? equivalence.pathKind ?? equivalence.status ?? ''),
  );
  const semanticDiff =
    equivalence.semanticDiff ??
    equivalence.semanticReplayDiff ??
    equivalence.diff ??
    equivalence.replayDiff;
  const semanticClean = semanticDiffClean(semanticDiff);
  const topLevelBlocked = topLevelUiEvidenceBlocked(equivalence);
  const blockers =
    kind === 'ui' && uiReplayClean ? blockerList(uiReplay, kind) : blockerList(equivalence, kind);
  const rows = Array.isArray(equivalence.cmdKBridgeCoverage?.rows)
    ? equivalence.cmdKBridgeCoverage.rows
    : [];
  const fixtureCommandTypesTotal = Number(
    equivalence.cmdKBridgeCoverage?.fixtureCommandTypesTotal ?? rows.length,
  );
  const exactCmdKRows = rows.filter(
    (row) => row.completedByCmdK === true && row.exactFixturePayloadExecutable === true,
  );
  const directPayloadCoversCommandTypes = Array.isArray(
    equivalence.cmdKBridgeCoverage?.directPayloadCoversCommandTypes,
  )
    ? equivalence.cmdKBridgeCoverage.directPayloadCoversCommandTypes
    : [];
  const exactCmdKCount = Number(
    equivalence.cmdKBridgeCoverage?.exactUiExecutableOperationCount ?? exactCmdKRows.length,
  );
  const allCmdKTypesClosed =
    fixtureCommandTypesTotal > 0 &&
    exactCmdKRows.length === fixtureCommandTypesTotal &&
    exactCmdKCount >= fixtureCommandTypesTotal;
  const directPayloadTypesClosed =
    fixtureCommandTypesTotal > 0 &&
    directPayloadCoversCommandTypes.length >= fixtureCommandTypesTotal &&
    (equivalence.cmdKBridgeCoverage?.directPayloadCommandIds ?? []).length > 0;
  const validation = equivalence.validation ?? {};
  const uiValidated =
    validation.browserAuthoredModel === true ||
    validation.exactNumericUiInputExecutable === true ||
    validation.uiValidatedReplay === true ||
    validation.exactFixtureSemanticEquivalence === true ||
    uiReplayClean ||
    explicitClosurePass(equivalence, 'ui');
  const cmdKValidated =
    explicitClosurePass(equivalence, 'cmdK') ||
    allCmdKTypesClosed ||
    directPayloadTypesClosed ||
    equivalence.cmdKBridgeCoverage?.directPayloadBridge === true ||
    equivalence.cmdKBridgeCoverage?.validatedReplay === true;
  const basePass =
    /validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status) &&
    (semanticClean || (kind === 'ui' && uiReplayClean)) &&
    (kind === 'ui' && uiReplayClean ? true : !topLevelBlocked) &&
    blockers.length === 0;
  const passes = kind === 'cmdK' ? basePass && cmdKValidated : basePass && uiValidated;
  const reasonParts = [];
  if (!/validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status)) {
    reasonParts.push(`status is ${status || 'missing'}`);
  }
  if (!semanticClean && !(kind === 'ui' && uiReplayClean)) {
    reasonParts.push('semantic replay diff is missing or not clean');
  }
  if (topLevelBlocked && !(kind === 'ui' && uiReplayClean)) {
    reasonParts.push('top-level status still contains blocking terms');
  }
  if (blockers.length) reasonParts.push(`${blockers.length} ${kind} blocker(s) remain`);
  if (kind === 'ui' && !uiValidated) {
    reasonParts.push('no browser-authored, exact numeric, or explicit M3-Q UI replay proof');
  }
  if (kind === 'cmdK' && !cmdKValidated) {
    reasonParts.push(
      'no direct payload bridge, exact Cmd+K fixture coverage, or explicit M3-R replay proof',
    );
  }
  return {
    type: 'two-storey-closure',
    status: passes ? `${kind}-closure-clean` : status || 'missing',
    source: kind === 'ui' && uiReplayClean ? uiReplayPath : equivalencePath,
    detail: [
      `${kind} closure`,
      `semanticDiff=${semanticClean || (kind === 'ui' && uiReplayClean) ? 'clean' : 'blocked'}`,
      `traceability=${traceability?.pathKind ?? traceability?.latestMachineReadableStatus ?? 'missing'}`,
      blockers.length ? `blockers=${blockers.slice(0, 5).join('; ')}` : 'blockers=none',
    ].join('; '),
    passes,
    reason: passes ? '' : reasonParts.join('; '),
    proof: passes
      ? {
          twoStoreySemanticFixtureEquivalent: true,
          kind,
          sourceWorkstream: kind === 'cmdK' ? 'M3-R' : 'M3-Q',
          replayCommandCount:
            kind === 'ui' && uiReplayClean
              ? Number(uiReplay.proof?.replayCommandCount ?? 0)
              : undefined,
          exactCmdKCommandTypes: Math.max(
            exactCmdKRows.length,
            directPayloadCoversCommandTypes.length,
          ),
          fixtureCommandTypesTotal,
        }
      : undefined,
  };
}

function twoStoreyEvidenceSignal(scenario, scenarioPath, kind) {
  if (kind === 'ui' || kind === 'cmdK') return twoStoreyUiClosureEvidence(kind);
  const status = scenarioEvidenceStatus(scenario, kind);
  return {
    type: 'scenario-evidence',
    status,
    source: scenarioPath,
    detail: `${kind}: ${scenario?.evidence?.[kind]?.classification ?? 'missing'} / ${
      scenario?.evidence?.[kind]?.status ?? 'missing'
    }`,
    passes: status === 'passed',
  };
}

function buildM3BenchmarkWorkstream() {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-G');
  const scenarioPath = `spec/benchmarks/${config.scenarioId}/scenario.json`;
  const scenario = parseJsonFile(scenarioPath);
  const hasScenario = Boolean(scenario);
  const fixtures = scenario?.fixtures ?? {};
  const runner = scenario?.runner ?? {};
  const requiredFixtureKeys = [
    'expectedSemantics',
    'mcpCliCommandBundle',
    'uiCmdKTraceability',
    'uiEquivalence',
    'liveEvidenceDirectory',
  ];
  const fixtureEvidence = requiredFixtureKeys.map((key) => ({
    type: 'scenario-fixture',
    status: fixtures[key] ? 'declared' : 'missing',
    source: scenarioPath,
    detail: `${key}: ${fixtures[key] ?? 'missing'}`,
    passes: Boolean(fixtures[key]),
  }));
  const evidenceKinds = ['ui', 'cmdK', 'mcpCli', 'advisor', 'visual', 'export', 'semanticDiff'];
  const evidenceSignals = evidenceKinds.map((kind) =>
    twoStoreyEvidenceSignal(scenario, scenarioPath, kind),
  );
  const gates = [
    m3Gate(
      'scenario-present',
      'Scenario spec present',
      hasScenario,
      `${scenarioPath} is missing.`,
      [
        {
          type: 'scenario',
          status: hasScenario ? 'present' : 'missing',
          source: scenarioPath,
          detail: scenario?.summary ?? '',
          passes: hasScenario,
        },
      ],
    ),
    m3Gate(
      'runner-executable',
      'Executable benchmark runner',
      runner.kind && runner.kind !== 'not-yet-implemented' && Boolean(runner.command),
      'Two-storey benchmark runner is not executable yet.',
      [
        {
          type: 'scenario-runner',
          status: runner.kind ?? 'missing',
          source: scenarioPath,
          detail: runner.command ?? 'no command',
          passes: runner.kind && runner.kind !== 'not-yet-implemented' && Boolean(runner.command),
        },
      ],
      hasScenario,
    ),
    m3Gate(
      'fixture-set',
      'Expected semantics and fixture artifacts',
      fixtureEvidence.every((item) => item.passes),
      'Two-storey benchmark expected semantics, MCP/CLI bundle, UI traceability, UI equivalence, or live evidence directory is missing.',
      fixtureEvidence,
      fixtureEvidence.some((item) => item.passes),
    ),
    m3Gate(
      'evidence-set',
      'Executable evidence set',
      evidenceSignals.every((item) => item.passes),
      'Two-storey benchmark lacks passing UI/Cmd+K, MCP/CLI, advisor, visual, export, or semantic-diff evidence.',
      evidenceSignals,
      evidenceSignals.some((item) => item.status === 'partial' || item.passes),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function exportManifestKindPass(exportEvidence, key) {
  return exportEvidence?.manifests?.[key]?.pass === true;
}

function exportArtifactPass(exportEvidence, key) {
  return exportEvidence?.artifacts?.[key]?.pass === true;
}

function exportArtifactStatus(exportEvidence, key) {
  return (
    exportEvidence?.artifacts?.[key]?.status ??
    exportEvidence?.manifests?.[key]?.status ??
    'missing-or-failed'
  );
}

function exportedDocCounts(exportEvidence) {
  return (
    exportEvidence?.manifests?.gltf?.summary?.geometryProof?.counts?.counts ??
    exportEvidence?.manifests?.gltf?.body?.extensions?.BIM_AI_exportManifest_v0?.countsByKind ??
    {}
  );
}

function buildM3DocumentationExportWorkstream(apiLedger) {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-H');
  const descriptorEvidence = config.requiredDescriptors.map((id) => {
    const descriptor = apiLedger.find((row) => descriptorMatchesStableId(row, id));
    return {
      type: 'api-descriptor',
      status: descriptor
        ? descriptor.routeImplemented
          ? 'implemented'
          : 'route-mismatch'
        : 'missing',
      source: descriptor?.source ?? SOURCES.apiRegistry,
      detail: descriptor ? `${descriptor.id} -> ${descriptor.method} ${descriptor.path}` : id,
      passes: Boolean(descriptor?.routeImplemented),
    };
  });
  const exportEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/export-evidence.json';
  const exportEvidence = parseJsonFile(exportEvidencePath);
  const counts = exportedDocCounts(exportEvidence);
  const countSignals = ['sheet', 'schedule', 'placed_tag', 'dimension'].map((kind) => ({
    type: 'export-count',
    status: Number(counts[kind] ?? 0) > 0 ? 'present' : 'missing',
    source: exportEvidencePath,
    detail: `${kind}: ${counts[kind] ?? 0}`,
    passes: Number(counts[kind] ?? 0) > 0,
  }));
  const artifactSignals = [
    {
      type: 'export-artifact',
      status: exportManifestKindPass(exportEvidence, 'gltf') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'glTF/GLB manifest evidence',
      passes: exportManifestKindPass(exportEvidence, 'gltf'),
    },
    {
      type: 'export-artifact',
      status: exportManifestKindPass(exportEvidence, 'ifc') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'IFC manifest evidence',
      passes: exportManifestKindPass(exportEvidence, 'ifc'),
    },
    {
      type: 'export-artifact',
      status: exportArtifactPass(exportEvidence, 'sheetPdf') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'Sheet PDF artifact evidence',
      passes: exportArtifactPass(exportEvidence, 'sheetPdf'),
    },
  ];
  const gates = [
    m3Gate(
      'descriptor-pack',
      'Documentation/export descriptor pack',
      descriptorEvidence.every((item) => item.passes),
      'One or more documentation/export API descriptors are missing or route-mismatched.',
      descriptorEvidence,
      descriptorEvidence.some((item) => item.passes),
    ),
    m3Gate(
      'document-artifact-counts',
      'Sheet, schedule, tag, and dimension evidence',
      countSignals.every((item) => item.passes),
      'Export evidence does not include sheet, schedule, tag, and dimension counts.',
      countSignals,
      countSignals.some((item) => item.passes),
    ),
    m3Gate(
      'export-artifacts',
      'PDF, IFC, and glTF/GLB artifacts',
      artifactSignals.every((item) => item.passes),
      'Production evidence must include clean PDF, IFC, and glTF/GLB export artifacts or manifests; PDF shells alone are not enough.',
      artifactSignals,
      artifactSignals.some((item) => item.passes),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3TransactionWorkstream() {
  const commitEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/live-commit-evidence.json';
  const commandLogPath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/command-log-summary.json';
  const commitEvidence = parseJsonFile(commitEvidencePath);
  const commandLog = parseJsonFile(commandLogPath);
  const latestLog =
    commandLog?.latest?.[0] ?? commitEvidence?.postCommit?.commandLog?.summary?.latest?.[0];
  const basicMetadata = [
    {
      key: 'parentRevision',
      value: commitEvidence?.revision?.parentRevision,
      source: commitEvidencePath,
    },
    {
      key: 'newRevision',
      value: commitEvidence?.revision?.newRevision ?? commitEvidence?.revision?.revision,
      source: commitEvidencePath,
    },
    {
      key: 'changedIds',
      value: Array.isArray(commitEvidence?.changedIds) ? commitEvidence.changedIds.length : 0,
      source: commitEvidencePath,
    },
    {
      key: 'agentIdentity',
      value: latestLog?.userId,
      source: commandLogPath,
    },
    {
      key: 'commandLogRevisionAfter',
      value: latestLog?.revisionAfter ?? commitEvidence?.revision?.commandLogRevisionAfter,
      source: commandLogPath,
    },
  ].map((item) => ({
    type: 'transaction-metadata',
    status:
      item.value === undefined || item.value === null || item.value === 0 ? 'missing' : 'present',
    source: item.source,
    detail: `${item.key}: ${item.value ?? 'missing'}`,
    passes: !(item.value === undefined || item.value === null || item.value === 0),
  }));
  const idempotencySignals = [
    {
      type: 'idempotency',
      status:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'clientOpId or bundle digest replay dedup proof',
      passes:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true,
    },
    {
      type: 'stale-revision',
      status:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'stale parent revision rejection proof',
      passes:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true,
    },
    {
      type: 'workflow-metadata',
      status:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'M3 sketch/export/import workflow metadata assertions',
      passes:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true,
    },
  ];
  const gates = [
    m3Gate(
      'basic-transaction-metadata',
      'Parent revision, changed ids, agent, and command log metadata',
      basicMetadata.every((item) => item.passes),
      'Committed evidence does not include complete basic transaction metadata.',
      basicMetadata,
      basicMetadata.some((item) => item.passes),
    ),
    m3Gate(
      'idempotent-replay',
      'Idempotent replay and stale revision gates',
      idempotencySignals.every((item) => item.passes),
      'No clean clientOpId/bundle-digest replay dedup, stale revision protection, and M3 workflow metadata proof was detected.',
      idempotencySignals,
      idempotencySignals.some((item) => item.passes),
    ),
  ];
  return {
    id: 'M3-I',
    label: 'Transaction idempotency and workflow metadata',
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

export function buildM3Wave2(apiLedger) {
  const workstreams = [
    buildM3SketchWorkstream(apiLedger),
    buildM3BenchmarkWorkstream(),
    buildM3DocumentationExportWorkstream(apiLedger),
    buildM3TransactionWorkstream(),
  ];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    workstreams,
    gates,
    blockers,
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
    },
  };
}

function implementedDescriptorEvidence(apiLedger, ids, sourceFallback) {
  const descriptor = apiLedger.find((row) => ids.some((id) => descriptorMatchesStableId(row, id)));
  return {
    type: 'api-descriptor',
    status: descriptor
      ? descriptor.routeImplemented
        ? 'implemented'
        : 'route-mismatch'
      : 'missing',
    source: descriptor?.source ?? sourceFallback,
    detail: descriptor
      ? `${descriptor.id} -> ${descriptor.method} ${descriptor.path}`
      : `missing stable id: ${ids.join(' or ')}`,
    passes: Boolean(descriptor?.routeImplemented),
  };
}

function rawFallbackEvidence(backendLedger, commandIds, sourceFallback) {
  const matched = backendLedger.filter((row) =>
    commandIds.some((id) => row.backendCommands.includes(id)),
  );
  return {
    type: 'raw-fallback',
    status: matched.length ? 'raw-command-only' : 'missing',
    source: matched.map((row) => row.source).join(', ') || sourceFallback,
    detail: matched.length
      ? `${commandIds.join(', ')} exists through raw apply-bundle; no typed public descriptor matched.`
      : `${commandIds.join(', ')} not detected as backend fallback commands.`,
    passes: false,
  };
}

function buildM3VerticalCirculationWorkstream(apiLedger, backendLedger) {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-K');
  const gates = config.requiredSurfaceGroups.map((group) => {
    const descriptorEvidence = implementedDescriptorEvidence(
      apiLedger,
      group.acceptedStableIds,
      SOURCES.apiRegistry,
    );
    const fallbackEvidence = rawFallbackEvidence(
      backendLedger,
      group.rawFallbackCommands,
      SOURCES.commands,
    );
    return m3Gate(
      group.id,
      group.label,
      descriptorEvidence.passes,
      `${group.label} is not exposed as an implemented first-class API/MCP descriptor; raw bundle fallback is not enough for Wave 3 typed vertical-circulation parity.`,
      [descriptorEvidence, fallbackEvidence],
      fallbackEvidence.status !== 'missing',
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function scenarioEvidenceSignal(scenario, scenarioPath, kind) {
  const section = scenario?.evidence?.[kind];
  let status = scenarioEvidenceStatus(scenario, kind);
  if (section?.classification === 'traceability-only') status = 'partial';
  return {
    type: 'scenario-evidence',
    status,
    source: scenarioPath,
    detail: `${kind}: ${section?.classification ?? 'missing'} / ${section?.status ?? 'missing'}`,
    passes: status === 'passed',
  };
}

function buildM3TwoStoreyEvidenceWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-L');
  const scenarioPath = `spec/benchmarks/${config.scenarioId}/scenario.json`;
  const scenario = parseJsonFile(scenarioPath);
  const requiredKinds = ['advisor', 'visual', 'export', 'semanticDiff'];
  const gates = requiredKinds.map((kind) => {
    const evidence = [scenarioEvidenceSignal(scenario, scenarioPath, kind)];
    return m3Gate(
      `two-storey-${kind}`,
      `Two-storey ${kind} evidence`,
      evidence.every((item) => item.passes),
      `Two-storey ${kind} evidence is not an executable or accepted pass/fail artifact yet.`,
      evidence,
      evidence.some((item) => item.status === 'partial'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function buildM3TwoStoreyUiWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-M');
  const requiredKinds = ['ui', 'cmdK'];
  const gates = requiredKinds.map((kind) => {
    const evidence = [twoStoreyUiClosureEvidence(kind)];
    return m3Gate(
      `two-storey-${kind}`,
      `Two-storey ${kind} executable or validated replay`,
      evidence.every((item) => item.passes),
      evidence[0]?.reason ||
        `Two-storey ${kind} path is still traceability-only or missing; activator-only Cmd+K entries cannot close semantic parity.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function buildM3CleanExportWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-N');
  const exportEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/export-evidence.json';
  const exportEvidence = parseJsonFile(exportEvidencePath);
  const artifactSignals = [
    {
      id: 'clean-gltf',
      label: 'Clean glTF/GLB export manifest',
      key: 'gltf',
      passes: exportManifestKindPass(exportEvidence, 'gltf'),
    },
    {
      id: 'clean-ifc',
      label: 'Clean IFC export manifest',
      key: 'ifc',
      passes: exportManifestKindPass(exportEvidence, 'ifc'),
    },
    {
      id: 'clean-pdf',
      label: 'Clean sheet PDF artifact',
      key: 'sheetPdf',
      passes: exportArtifactPass(exportEvidence, 'sheetPdf'),
    },
  ];
  const gates = artifactSignals.map((signal) =>
    m3Gate(
      signal.id,
      signal.label,
      signal.passes,
      `${signal.label} is missing, unavailable, or failed in production evidence.`,
      [
        {
          type: 'export-artifact',
          status: signal.passes ? 'passed' : exportArtifactStatus(exportEvidence, signal.key),
          source: exportEvidencePath,
          detail: signal.label,
          passes: signal.passes,
        },
      ],
      Boolean(exportEvidence),
    ),
  );
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3WorkflowEvidenceWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-O');
  const commitEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/live-commit-evidence.json';
  const commitEvidence = parseJsonFile(commitEvidencePath);
  const signals = [
    {
      id: 'client-op-or-digest-replay',
      label: 'clientOpId or bundle-digest replay dedup',
      status:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true,
    },
    {
      id: 'stale-revision-protection',
      label: 'stale revision protection',
      status:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true,
    },
    {
      id: 'm3-workflow-metadata',
      label: 'M3 sketch/export/import workflow metadata',
      status:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true,
    },
  ];
  const gates = signals.map((signal) =>
    m3Gate(
      signal.id,
      signal.label,
      signal.passes,
      `${signal.label} proof was not detected in benchmark transaction evidence.`,
      [
        {
          type: 'transaction-evidence',
          status: signal.status,
          source: commitEvidencePath,
          detail: signal.label,
          passes: signal.passes,
        },
      ],
      Boolean(commitEvidence),
    ),
  );
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3Wave3FinalizationWorkstream(wave3Workstreams) {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-P');
  const plannedWorkstreamIds = M3_WAVE3_WORKSTREAMS.filter((row) => row.id !== 'M3-P').map(
    (row) => row.id,
  );
  const observedWorkstreamIds = new Set(wave3Workstreams.map((row) => row.id));
  const reportInputsComplete = plannedWorkstreamIds.every((id) => observedWorkstreamIds.has(id));
  const gates = [
    m3Gate(
      'wave3-workstreams-enumerated',
      'Wave 3 workstreams enumerated',
      reportInputsComplete,
      'Wave 3 audit did not enumerate every M3-K through M3-O workstream.',
      plannedWorkstreamIds.map((id) => ({
        type: 'audit-workstream',
        status: observedWorkstreamIds.has(id) ? 'present' : 'missing',
        source: 'scripts/audit-ui-mcp-parity.mjs',
        detail: id,
        passes: observedWorkstreamIds.has(id),
      })),
      wave3Workstreams.length > 0,
    ),
    m3Gate(
      'next-wave-schedule-derived',
      'Next-wave schedule derived from blockers',
      reportInputsComplete,
      'Wave 3 audit cannot derive next-wave schedule until all workstream gates are visible.',
      [
        {
          type: 'audit-report',
          status: reportInputsComplete ? 'derived' : 'incomplete',
          source: 'scripts/audit-ui-mcp-parity.mjs',
          detail:
            'Generated report ranks remaining M3-K through M3-O blockers by workstream order and gate id.',
          passes: reportInputsComplete,
        },
      ],
      wave3Workstreams.length > 0,
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

export function buildM3Wave3(apiLedger, backendLedger) {
  const evidenceWorkstreams = [
    buildM3VerticalCirculationWorkstream(apiLedger, backendLedger),
    buildM3TwoStoreyEvidenceWorkstream(),
    buildM3TwoStoreyUiWorkstream(),
    buildM3CleanExportWorkstream(),
    buildM3WorkflowEvidenceWorkstream(),
  ];
  const workstreams = [
    ...evidenceWorkstreams,
    buildM3Wave3FinalizationWorkstream(evidenceWorkstreams),
  ];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    workstreams,
    gates,
    blockers,
    nextWaveSchedule: blockers.map((blocker, index) => ({
      order: index + 1,
      sourceBlocker: blocker.id,
      recommendedFocus: blocker.blocker,
    })),
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
      nextWaveItemCount: blockers.length,
    },
  };
}

function m4ScenarioPath(scenarioId) {
  return `spec/benchmarks/${scenarioId}/scenario.json`;
}

function loadProfessionalBenchmarkSuite() {
  const suitePath = 'spec/benchmarks/professional-suite.json';
  const suite = parseJsonFile(suitePath);
  const scenarioIds = Array.isArray(suite?.scenarios)
    ? suite.scenarios.map((entry) => entry.scenarioId).filter(Boolean)
    : [];
  const scenarios = Object.fromEntries(
    scenarioIds.map((scenarioId) => [scenarioId, parseJsonFile(m4ScenarioPath(scenarioId))]),
  );
  return { suitePath, suite, scenarioIds, scenarios };
}

function m4ScenarioEvidenceSignal(scenarioId, kind, suiteInfo) {
  const source = m4ScenarioPath(scenarioId);
  const scenario = suiteInfo.scenarios[scenarioId];
  const entry = scenario?.evidence?.[kind];
  if (!scenario) {
    return {
      type: 'professional-scenario-evidence',
      status: 'missing',
      source,
      detail: `${scenarioId} scenario is missing.`,
      passes: false,
      reason: `${source} is missing.`,
    };
  }
  if (!entry || typeof entry !== 'object') {
    return {
      type: 'professional-scenario-evidence',
      status: 'missing',
      source,
      detail: `${kind} evidence is missing.`,
      passes: false,
      reason: `${kind} evidence is missing from ${source}.`,
    };
  }
  const status = String(entry.status ?? entry.classification ?? 'missing');
  const classification = String(entry.classification ?? 'missing');
  const artifacts = m4MachineReadableEvidence(entry.artifacts);
  const proof = m4MachineReadableEvidence(entry.proof);
  const evidencePayload = m4MachineReadableEvidence(entry.evidence);
  const metrics = m4MachineReadableEvidence(entry.metrics);
  const validation = m4MachineReadableEvidence(entry.validation);
  const hasPositiveBoolean =
    entry.pass === true || entry.passed === true || entry.ok === true || entry.validated === true;
  const hasMachineReadableEvidence = [artifacts, proof, evidencePayload, metrics, validation].some(
    (value) => value !== undefined,
  );
  const passes =
    ['executable', 'validated-replay'].includes(classification) &&
    isPositiveEvidenceStatus(status) &&
    !isBlockingEvidenceStatus(status) &&
    hasPositiveBoolean &&
    hasMachineReadableEvidence;
  const signal = {
    type: 'professional-scenario-evidence',
    status: passes ? 'passed' : status,
    source,
    scenarioId,
    kind,
    classification,
    detail: `${scenarioId}.${kind}: ${classification} / ${status}`,
    passes,
    reason: passes
      ? ''
      : m4EvidenceRejectionReason(
          status,
          classification,
          hasPositiveBoolean,
          hasMachineReadableEvidence,
        ),
  };
  if (artifacts !== undefined) signal.artifacts = artifacts;
  if (proof !== undefined) signal.proof = proof;
  if (evidencePayload !== undefined) signal.evidence = evidencePayload;
  if (metrics !== undefined) signal.metrics = metrics;
  if (validation !== undefined) signal.validation = validation;
  return signal;
}

function m4MachineReadableEvidence(value) {
  if (Array.isArray(value)) {
    const filtered = value.filter((item) => {
      if (typeof item === 'string') return item.trim().length > 0;
      return item && typeof item === 'object' && Object.keys(item).length > 0;
    });
    return filtered.length ? filtered : undefined;
  }
  if (value && typeof value === 'object' && Object.keys(value).length > 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return undefined;
}

function m4EvidenceRejectionReason(
  status,
  classification,
  hasPositiveBoolean,
  hasMachineReadableEvidence,
) {
  if (!['executable', 'validated-replay'].includes(classification)) {
    return 'scenario evidence must classify as executable or validated-replay';
  }
  if (!hasPositiveBoolean) {
    return 'scenario evidence must include explicit pass=true, passed=true, ok=true, or validated=true';
  }
  if (!hasMachineReadableEvidence) {
    return 'scenario evidence must include non-empty artifacts, proof, evidence, metrics, or validation payload';
  }
  return evidenceRejectionReason(status, classification);
}

function buildM4DomainWorkstream(config, apiLedger, suiteInfo) {
  const descriptorGates = config.requiredSurfaceGroups.map((group) => {
    const evidence = group.acceptedStableIds.map((id) =>
      implementedDescriptorEvidence(apiLedger, [id], SOURCES.apiRegistry),
    );
    const passed = evidence.some((item) => item.passes);
    return m3Gate(
      group.id,
      group.label,
      passed,
      `${group.label} lacks an implemented first-class API/MCP descriptor; raw apply-bundle reachability does not count for M4.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  const scenarioSignals = config.scenarioIds.map((scenarioId) => {
    const scenario = suiteInfo.scenarios[scenarioId];
    return {
      type: 'professional-scenario',
      status: scenario ? 'present' : 'missing',
      source: m4ScenarioPath(scenarioId),
      detail: scenario?.summary ?? `${scenarioId} scenario missing.`,
      passes: Boolean(scenario),
      reason: scenario ? '' : `${m4ScenarioPath(scenarioId)} is missing.`,
    };
  });
  const mcpCliSignals = config.scenarioIds.map((scenarioId) =>
    m4ScenarioEvidenceSignal(scenarioId, 'mcpCli', suiteInfo),
  );
  const uiSignals = config.scenarioIds.flatMap((scenarioId) => [
    m4ScenarioEvidenceSignal(scenarioId, 'ui', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'cmdK', suiteInfo),
  ]);
  const qualitySignals = config.scenarioIds.flatMap((scenarioId) => [
    m4ScenarioEvidenceSignal(scenarioId, 'advisor', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'visual', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'export', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'semanticDiff', suiteInfo),
  ]);
  const gates = [
    ...descriptorGates,
    m3Gate(
      'benchmark-scenario-fixtures',
      'Professional benchmark scenario fixtures',
      scenarioSignals.every((item) => item.passes),
      `${config.label} benchmark scenario fixture(s) are missing from the professional suite.`,
      scenarioSignals,
      scenarioSignals.some((item) => item.passes),
    ),
    m3Gate(
      'mcp-cli-benchmark-evidence',
      'MCP/CLI executable benchmark evidence',
      mcpCliSignals.every((item) => item.passes),
      `${config.label} lacks executable MCP/CLI benchmark evidence.`,
      mcpCliSignals,
      mcpCliSignals.some((item) => item.status !== 'missing'),
    ),
    m3Gate(
      'ui-cmdk-equivalence-evidence',
      'UI and Cmd+K executable or validated replay evidence',
      uiSignals.every((item) => item.passes),
      `${config.label} lacks UI/Cmd+K executable or validated replay evidence; activator-only mappings are excluded.`,
      uiSignals,
      uiSignals.some((item) => item.status !== 'missing'),
    ),
    m3Gate(
      'quality-export-semantic-evidence',
      'Advisor, visual, export, and semantic-diff evidence',
      qualitySignals.every((item) => item.passes),
      `${config.label} lacks accepted advisor, visual, export, or semantic-diff evidence.`,
      qualitySignals,
      qualitySignals.some((item) => item.status !== 'missing'),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    domain: config.domain,
    scenarioIds: config.scenarioIds,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM4AuditWorkstream(domainWorkstreams, suiteInfo) {
  const plannedWorkstreamIds = M4_WAVE1_WORKSTREAMS.map((row) => row.id);
  const observedWorkstreamIds = new Set(domainWorkstreams.map((row) => row.id));
  const suitePresent = Boolean(suiteInfo.suite);
  const suiteScenarioIds = new Set(suiteInfo.scenarioIds);
  const plannedScenarioIds = new Set(M4_WAVE1_WORKSTREAMS.flatMap((row) => row.scenarioIds));
  const scenarioCoverage = [...plannedScenarioIds].every((id) => suiteScenarioIds.has(id));
  const reportInputsComplete = plannedWorkstreamIds.every((id) => observedWorkstreamIds.has(id));
  const gates = [
    m3Gate(
      'professional-suite-manifest',
      'Professional benchmark suite manifest',
      suitePresent && scenarioCoverage,
      'Professional benchmark suite manifest is missing one or more M4 domain scenarios.',
      [
        {
          type: 'professional-suite',
          status: suitePresent ? 'present' : 'missing',
          source: suiteInfo.suitePath,
          detail: `scenario coverage ${suiteInfo.scenarioIds.length} / ${plannedScenarioIds.size}`,
          passes: suitePresent && scenarioCoverage,
        },
      ],
      suitePresent,
    ),
    m3Gate(
      'wave1-workstreams-enumerated',
      'Wave 1 domain workstreams enumerated',
      reportInputsComplete,
      'M4 audit did not enumerate every M4-A through M4-E domain workstream.',
      plannedWorkstreamIds.map((id) => ({
        type: 'audit-workstream',
        status: observedWorkstreamIds.has(id) ? 'present' : 'missing',
        source: 'scripts/audit-ui-mcp-parity.mjs',
        detail: id,
        passes: observedWorkstreamIds.has(id),
      })),
      domainWorkstreams.length > 0,
    ),
    m3Gate(
      'blocker-ledger-derived',
      'Blocker ledger and next wave schedule derived from gates',
      reportInputsComplete,
      'M4 audit cannot derive blocker ledgers until all domain workstream gates are visible.',
      [
        {
          type: 'audit-report',
          status: reportInputsComplete ? 'derived' : 'incomplete',
          source: 'scripts/audit-ui-mcp-parity.mjs',
          detail:
            'Generated M4 reports rank remaining M4-A through M4-E blockers by workstream and gate.',
          passes: reportInputsComplete,
        },
      ],
      domainWorkstreams.length > 0,
    ),
  ];
  return {
    id: 'M4-F',
    label: 'Professional benchmark suite and M4 audit gates',
    domain: 'm4-audit',
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

export function buildM4Wave1(apiLedger) {
  const suiteInfo = loadProfessionalBenchmarkSuite();
  const domainWorkstreams = M4_WAVE1_WORKSTREAMS.map((config) =>
    buildM4DomainWorkstream(config, apiLedger, suiteInfo),
  );
  const workstreams = [...domainWorkstreams, buildM4AuditWorkstream(domainWorkstreams, suiteInfo)];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    suite: {
      source: suiteInfo.suitePath,
      suiteId: suiteInfo.suite?.suiteId ?? 'missing',
      scenarioIds: suiteInfo.scenarioIds,
    },
    workstreams,
    gates,
    blockers,
    nextWaveSchedule: blockers.map((blocker, index) => ({
      order: index + 1,
      sourceBlocker: blocker.id,
      recommendedFocus: blocker.blocker,
    })),
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
      nextWaveItemCount: blockers.length,
    },
  };
}

