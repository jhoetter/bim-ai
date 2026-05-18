import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getCommandCapability } from '../workspace/commandCapabilities';
import './defaultCommands';
import { getRegistry } from './registry';

type TraceStep = {
  order: number;
  label: string;
  cmdKId: string;
  alternateCmdKIds?: string[];
  capabilityId: string | null;
  expectedExecutionKind: string;
  expectedSemanticOutputs: string[];
  supportsBenchmarkSemanticOutput: boolean;
};

type TraceabilityArtifact = {
  schemaVersion: string;
  benchmarkId: string;
  pathKind: string;
  parityClaim: string;
  latestEquivalenceArtifact?: string;
  latestValidatedReplayArtifact?: string;
  latestMachineReadableStatus?: string;
  steps: TraceStep[];
  remainingUiBlockers: string[];
};

type CommandBundle = {
  commands: Array<Record<string, unknown> & { type: string; id?: string }>;
};

type ExpectedSemantics = {
  paths: {
    ui: {
      status: string;
      traceability: string;
      equivalence?: string;
      validatedReplay?: string;
    };
  };
  evidenceExpectations: {
    commandSurfaceUsage: {
      mustInclude: string[];
      rawBundleOnlyForNow: string[];
      forbidden: string[];
    };
  };
};

type EquivalenceBridgeRow = {
  commandType: string;
  fixtureCount: number;
  validatedReplayCount: number;
  cmdKIds: string[];
  deterministicCmdKIds?: string[];
  activatorOnlyCmdKIds?: string[];
  bridgeStatus: string;
  completedByCmdK: boolean;
  exactFixturePayloadExecutable?: boolean;
  blocker?: string;
};

type EquivalenceArtifact = {
  schemaVersion: string;
  benchmarkId: string;
  status: string;
  pathKind: string;
  auditClassification: string;
  parityClaim: string;
  uiEquivalentEvidence: boolean;
  validation: {
    browserAuthoredModel: boolean;
    exactNumericUiInputExecutable: boolean;
    exactSemanticFixtureEquivalence?: boolean;
    validatedReplayArtifact?: string;
  };
  semanticReplayDiff: {
    status: string;
    validatedReplaySource?: string;
    fixtureCommandSequenceSha256?: string;
    replayCommandSequenceSha256?: string;
    payloadDigestMismatches?: unknown[];
    fixtureCommandCount: number;
    replayedCommandCount: number;
    unmatchedFixtureCommandCount: number;
    unexpectedReplayCommandCount: number;
    countDeltaByCommandType: Record<string, number>;
  };
  cmdKBridgeCoverage: {
    fixtureCommandCount: number;
    fixtureCommandTypesTotal: number;
    directPayloadCommandIds?: string[];
    directPayloadCoversCommandTypes?: string[];
    deterministicCmdKCommitCommandTypes: string[];
    exactUiExecutableCommandTypes: string[];
    exactUiExecutableOperationCount: number;
    activatorOnlyCommandIds: string[];
    blockedOrUnmappedCommandTypes: string[];
    rows: EquivalenceBridgeRow[];
  };
  remainingUiBlockers: string[];
};

type ReplayInputMappingRow = {
  replayStep: number;
  fixtureCommandIndex: number;
  commandType: string;
  commandId: string | null;
  payloadSha256: string;
  inputSource: string;
  uiInputMapping: string;
};

type ValidatedReplayArtifact = {
  schemaVersion: string;
  benchmarkId: string;
  classification: string;
  replayKind: string;
  semanticFixture: string;
  equivalenceArtifact: string;
  proof: {
    fixtureCommandCount: number;
    replayCommandCount: number;
    fixtureCommandSequenceSha256: string;
    replayCommandSequenceSha256: string;
    bundleSha256: string;
    payloadDigestMismatches: unknown[];
    sequenceMismatchCount: number;
    unmatchedFixtureCommandCount: number;
    unexpectedReplayCommandCount: number;
  };
  inputMapping: ReplayInputMappingRow[];
  remainingHumanGestureLimitations: string[];
};

const BENCHMARK_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../spec/benchmarks/two-storey-house-with-stair',
);
const TRACE_PATH = resolve(BENCHMARK_DIR, 'ui-cmdk-traceability.json');
const EQUIVALENCE_PATH = resolve(BENCHMARK_DIR, 'ui-equivalence.json');
const VALIDATED_REPLAY_PATH = resolve(BENCHMARK_DIR, 'ui-validated-replay.json');
const BUNDLE_PATH = resolve(BENCHMARK_DIR, 'mcp-cli-command-bundle.json');
const EXPECTED_PATH = resolve(BENCHMARK_DIR, 'expected-semantics.json');

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function fixtureCommandTypeCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const command of loadJson<CommandBundle>(BUNDLE_PATH).commands) {
    counts.set(command.type, (counts.get(command.type) ?? 0) + 1);
  }
  return counts;
}

function cmdKIdsForStep(step: TraceStep): string[] {
  return [step.cmdKId, ...(step.alternateCmdKIds ?? [])];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

describe('two-storey UI/Cmd+K equivalence replay', () => {
  it('links traceability to the validated replay artifact without claiming browser-authored parity', () => {
    const trace = loadJson<TraceabilityArtifact>(TRACE_PATH);
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const expected = loadJson<ExpectedSemantics>(EXPECTED_PATH);

    expect(trace.schemaVersion).toBe('bim-ai.benchmark.ui-cmdk-traceability.v1');
    expect(trace.benchmarkId).toBe('two-storey-house-with-stair');
    expect(trace.pathKind).toBe('validated-replay');
    expect(trace.parityClaim).toBe('partial-cmdk-equivalence');
    expect(trace.latestEquivalenceArtifact).toBe('ui-equivalence.json');
    expect(trace.latestValidatedReplayArtifact).toBe('ui-validated-replay.json');
    expect(trace.latestMachineReadableStatus).toBe('validated-replay');

    expect(equivalence.schemaVersion).toBe('bim-ai.benchmark.ui-cmdk-equivalence.v1');
    expect(equivalence.status).toBe('validated-replay');
    expect(equivalence.pathKind).toBe('validated-replay');
    expect(equivalence.auditClassification).toBe('validated-replay');
    expect(equivalence.parityClaim).toBe('partial-ui-cmdk-equivalence');
    expect(equivalence.uiEquivalentEvidence).toBe(true);
    expect(equivalence.validation.browserAuthoredModel).toBe(false);
    expect(equivalence.validation.exactNumericUiInputExecutable).toBe(false);
    expect(equivalence.validation.exactSemanticFixtureEquivalence).toBe(true);
    expect(equivalence.validation.validatedReplayArtifact).toBe('ui-validated-replay.json');
    expect(equivalence.semanticReplayDiff.validatedReplaySource).toBe('ui-validated-replay.json');
    expect(equivalence.remainingUiBlockers.length).toBeGreaterThanOrEqual(6);

    expect(expected.paths.ui.status).toBe('validated-replay');
    expect(expected.paths.ui.traceability).toBe('ui-cmdk-traceability.json');
    expect(expected.paths.ui.equivalence).toBe('ui-equivalence.json');
    expect(expected.paths.ui.validatedReplay).toBe('ui-validated-replay.json');
  });

  it('validates replay command counts against the two-storey semantic fixture', () => {
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const bundle = loadJson<CommandBundle>(BUNDLE_PATH);
    const fixtureCounts = fixtureCommandTypeCounts();

    expect(equivalence.semanticReplayDiff.status).toBe('matches-mcp-cli-fixture');
    expect(equivalence.semanticReplayDiff.fixtureCommandCount).toBe(bundle.commands.length);
    expect(equivalence.semanticReplayDiff.replayedCommandCount).toBe(bundle.commands.length);
    expect(equivalence.semanticReplayDiff.fixtureCommandSequenceSha256).toBe(
      sha256(bundle.commands),
    );
    expect(equivalence.semanticReplayDiff.replayCommandSequenceSha256).toBe(
      sha256(bundle.commands),
    );
    expect(equivalence.semanticReplayDiff.payloadDigestMismatches).toEqual([]);
    expect(equivalence.semanticReplayDiff.unmatchedFixtureCommandCount).toBe(0);
    expect(equivalence.semanticReplayDiff.unexpectedReplayCommandCount).toBe(0);
    expect(Object.keys(equivalence.semanticReplayDiff.countDeltaByCommandType).sort()).toEqual(
      [...fixtureCounts.keys()].sort(),
    );

    for (const [commandType, count] of fixtureCounts) {
      const row = equivalence.cmdKBridgeCoverage.rows.find(
        (candidate) => candidate.commandType === commandType,
      );
      expect(equivalence.semanticReplayDiff.countDeltaByCommandType[commandType]).toBe(0);
      expect(row?.fixtureCount, commandType).toBe(count);
      expect(row?.validatedReplayCount, commandType).toBe(count);
    }
  });

  it('validates exact fixture payload replay input mapping with deterministic digests', () => {
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const replay = loadJson<ValidatedReplayArtifact>(VALIDATED_REPLAY_PATH);
    const bundle = loadJson<CommandBundle>(BUNDLE_PATH);

    expect(replay.schemaVersion).toBe('bim-ai.benchmark.ui-validated-replay.v1');
    expect(replay.benchmarkId).toBe('two-storey-house-with-stair');
    expect(replay.classification).toBe('validated-replay');
    expect(replay.replayKind).toBe('fixture-payload-replay');
    expect(replay.semanticFixture).toBe('mcp-cli-command-bundle.json');
    expect(replay.equivalenceArtifact).toBe('ui-equivalence.json');
    expect(replay.remainingHumanGestureLimitations.length).toBeGreaterThanOrEqual(3);

    expect(replay.proof.fixtureCommandCount).toBe(bundle.commands.length);
    expect(replay.proof.replayCommandCount).toBe(bundle.commands.length);
    expect(replay.proof.fixtureCommandSequenceSha256).toBe(sha256(bundle.commands));
    expect(replay.proof.replayCommandSequenceSha256).toBe(sha256(bundle.commands));
    expect(replay.proof.bundleSha256).toBe(sha256(bundle));
    expect(replay.proof.payloadDigestMismatches).toEqual([]);
    expect(replay.proof.sequenceMismatchCount).toBe(0);
    expect(replay.proof.unmatchedFixtureCommandCount).toBe(0);
    expect(replay.proof.unexpectedReplayCommandCount).toBe(0);
    expect(replay.inputMapping).toHaveLength(bundle.commands.length);

    replay.inputMapping.forEach((row, index) => {
      const command = bundle.commands[index];
      expect(row.replayStep, `${row.commandType}:${index}`).toBe(index + 1);
      expect(row.fixtureCommandIndex, `${row.commandType}:${index}`).toBe(index);
      expect(row.commandType, `${row.commandType}:${index}`).toBe(command.type);
      expect(row.commandId, `${row.commandType}:${index}`).toBe(command.id ?? null);
      expect(row.payloadSha256, `${row.commandType}:${index}`).toBe(sha256(command));
      expect(row.inputSource, `${row.commandType}:${index}`).toBe(
        `mcp-cli-command-bundle.json#/commands/${index}`,
      );
    });

    expect(equivalence.semanticReplayDiff.fixtureCommandSequenceSha256).toBe(
      replay.proof.fixtureCommandSequenceSha256,
    );
    expect(equivalence.semanticReplayDiff.replayCommandSequenceSha256).toBe(
      replay.proof.replayCommandSequenceSha256,
    );
  });

  it('maps every expected command surface to registered Cmd+K operations', () => {
    const trace = loadJson<TraceabilityArtifact>(TRACE_PATH);
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const expected = loadJson<ExpectedSemantics>(EXPECTED_PATH);
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));
    const fixtureCounts = fixtureCommandTypeCounts();
    const coveredTraceOutputs = new Set(
      trace.steps.flatMap((step) => step.expectedSemanticOutputs),
    );

    expect(equivalence.cmdKBridgeCoverage.fixtureCommandCount).toBe(
      loadJson<CommandBundle>(BUNDLE_PATH).commands.length,
    );
    expect(equivalence.cmdKBridgeCoverage.fixtureCommandTypesTotal).toBe(fixtureCounts.size);
    expect(equivalence.cmdKBridgeCoverage.rows).toHaveLength(fixtureCounts.size);
    expect(equivalence.cmdKBridgeCoverage.blockedOrUnmappedCommandTypes).toEqual([]);
    expect(equivalence.cmdKBridgeCoverage.directPayloadCommandIds).toEqual([
      'benchmark.two-storey-stair.replay-fixture',
    ]);
    expect(new Set(equivalence.cmdKBridgeCoverage.directPayloadCoversCommandTypes)).toEqual(
      new Set(fixtureCounts.keys()),
    );

    for (const commandType of expected.evidenceExpectations.commandSurfaceUsage.mustInclude) {
      expect(fixtureCounts.has(commandType), commandType).toBe(true);
      expect(coveredTraceOutputs.has(commandType), commandType).toBe(true);
      expect(
        equivalence.cmdKBridgeCoverage.rows.some((row) => row.commandType === commandType),
        commandType,
      ).toBe(true);
    }

    for (const commandType of expected.evidenceExpectations.commandSurfaceUsage.forbidden) {
      expect(fixtureCounts.has(commandType), commandType).toBe(false);
    }

    for (const step of trace.steps) {
      for (const cmdKId of cmdKIdsForStep(step)) {
        const entry = registryById.get(cmdKId);
        expect(entry, `${step.label}:${cmdKId}`).toBeTruthy();
        expect(getCommandCapability(cmdKId), `${step.label}:${cmdKId}`).toBeTruthy();
      }

      const primaryEntry = registryById.get(step.cmdKId);
      expect(primaryEntry?.executionKind, step.label).toBe(step.expectedExecutionKind);
      if (step.capabilityId !== null) {
        expect(primaryEntry?.capabilityId, step.label).toBe(step.capabilityId);
      }
    }
  });

  it('validates bridge rows against capability metadata and completed Cmd+K semantics', () => {
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));
    const deterministicCommandTypes = new Set(
      equivalence.cmdKBridgeCoverage.deterministicCmdKCommitCommandTypes,
    );
    const directPayloadCommandIds = new Set(
      equivalence.cmdKBridgeCoverage.directPayloadCommandIds ?? [],
    );
    const completedRows = equivalence.cmdKBridgeCoverage.rows.filter((row) => row.completedByCmdK);

    expect(new Set(completedRows.map((row) => row.commandType))).toEqual(deterministicCommandTypes);
    expect(equivalence.cmdKBridgeCoverage.exactUiExecutableCommandTypes).toEqual([]);
    expect(equivalence.cmdKBridgeCoverage.exactUiExecutableOperationCount).toBe(0);

    for (const row of equivalence.cmdKBridgeCoverage.rows) {
      expect(row.cmdKIds.length, row.commandType).toBeGreaterThan(0);
      for (const cmdKId of row.cmdKIds) {
        const entry = registryById.get(cmdKId);
        const capability = getCommandCapability(cmdKId);
        expect(entry, `${row.commandType}:${cmdKId}`).toBeTruthy();
        expect(capability, `${row.commandType}:${cmdKId}`).toBeTruthy();
        expect(entry?.capabilityId, `${row.commandType}:${cmdKId}`).toBe(capability?.capabilityId);
        expect(entry?.executionKind, `${row.commandType}:${cmdKId}`).toBe(
          capability?.executionKind,
        );
      }

      for (const cmdKId of row.deterministicCmdKIds ?? []) {
        const entry = registryById.get(cmdKId);
        expect(['commits-command', 'commits-bundle']).toContain(entry?.executionKind);
        expect(row.completedByCmdK, row.commandType).toBe(true);
      }
      expect(row.completedByCmdK, row.commandType).toBe(true);
      expect(row.exactFixturePayloadExecutable, row.commandType).toBe(true);
      expect(
        (row.deterministicCmdKIds ?? []).some((cmdKId) => directPayloadCommandIds.has(cmdKId)),
        row.commandType,
      ).toBe(true);
    }
  });

  it('keeps activator-only vertical-circulation commands out of completed semantics', () => {
    const equivalence = loadJson<EquivalenceArtifact>(EQUIVALENCE_PATH);
    const expected = loadJson<ExpectedSemantics>(EXPECTED_PATH);
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));
    const deterministicCmdKIds = new Set(
      equivalence.cmdKBridgeCoverage.rows.flatMap((row) => row.deterministicCmdKIds ?? []),
    );

    for (const cmdKId of equivalence.cmdKBridgeCoverage.activatorOnlyCommandIds) {
      const entry = registryById.get(cmdKId);
      expect(entry?.executionKind, cmdKId).toBe('activates-tool');
      expect(deterministicCmdKIds.has(cmdKId), cmdKId).toBe(false);
    }

    for (const commandType of expected.evidenceExpectations.commandSurfaceUsage
      .rawBundleOnlyForNow) {
      const row = equivalence.cmdKBridgeCoverage.rows.find(
        (candidate) => candidate.commandType === commandType,
      );
      expect(row?.completedByCmdK, commandType).toBe(true);
      expect(row?.bridgeStatus, commandType).toBe('validated-replay-exact-fixture-payload');
      expect(row?.deterministicCmdKIds ?? [], commandType).toContain(
        'benchmark.two-storey-stair.replay-fixture',
      );
      expect(row?.activatorOnlyCmdKIds ?? [], commandType).not.toEqual([]);
      for (const cmdKId of row?.activatorOnlyCmdKIds ?? []) {
        expect(deterministicCmdKIds.has(cmdKId), `${commandType}:${cmdKId}`).toBe(false);
      }
      expect(row?.blocker, commandType).toBeUndefined();
    }
  });
});
