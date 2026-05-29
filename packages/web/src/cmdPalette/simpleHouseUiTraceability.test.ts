import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getCommandCapability } from '../workspace/commandCapabilities';
import './defaultCommands';
import './defaultCommandsDisplayAndExtras';
import { getRegistry } from './registry';

type TraceStep = {
  order: number;
  label: string;
  cmdKId: string;
  capabilityId: string | null;
  executionKind: string | null;
  expectedExecutionKind: string;
  expectedSemanticOutputs: string[];
  supportsBenchmarkSemanticOutput: boolean;
  agentCompletionKind?: string;
  agentToolId?: string;
};

type TraceabilityArtifact = {
  schemaVersion: string;
  benchmarkId: string;
  pathKind: string;
  parityClaim: string;
  latestEquivalenceArtifact?: string;
  latestMachineReadableStatus?: string;
  steps: TraceStep[];
  remainingUiBlockers: string[];
};

type CommandBundle = {
  commands: Array<{ type: string }>;
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
  validation: {
    browserAuthoredModel: boolean;
    exactNumericUiInputExecutable: boolean;
  };
  semanticReplayDiff: {
    status: string;
    fixtureCommandCount: number;
    replayedCommandCount: number;
    unmatchedFixtureCommandCount: number;
    unexpectedReplayCommandCount: number;
    countDeltaByCommandType: Record<string, number>;
  };
  cmdKBridgeCoverage: {
    fixtureCommandCount: number;
    fixtureCommandTypesTotal: number;
    deterministicCmdKCommitCommandTypes: string[];
    exactUiExecutableCommandTypes: string[];
    exactUiExecutableOperationCount: number;
    activatorOnlyCommandIds: string[];
    blockedOrUnmappedCommandTypes: string[];
    rows: EquivalenceBridgeRow[];
  };
  remainingUiBlockers: string[];
};

const TRACE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../spec/benchmarks/simple-single-storey-house/ui-cmdk-traceability.json',
);
const EQUIVALENCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../spec/benchmarks/simple-single-storey-house/ui-equivalence.json',
);
const BUNDLE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../spec/benchmarks/simple-single-storey-house/mcp-cli-command-bundle.json',
);

function loadTraceability(): TraceabilityArtifact {
  return JSON.parse(readFileSync(TRACE_PATH, 'utf8')) as TraceabilityArtifact;
}

function loadEquivalence(): EquivalenceArtifact {
  return JSON.parse(readFileSync(EQUIVALENCE_PATH, 'utf8')) as EquivalenceArtifact;
}

function loadCommandBundle(): CommandBundle {
  return JSON.parse(readFileSync(BUNDLE_PATH, 'utf8')) as CommandBundle;
}

function fixtureCommandTypeCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const command of loadCommandBundle().commands) {
    counts.set(command.type, (counts.get(command.type) ?? 0) + 1);
  }
  return counts;
}

describe('simple-house UI/Cmd+K traceability', () => {
  it('keeps the legacy traceability catalog linked to the validated replay artifact', () => {
    const trace = loadTraceability();

    expect(trace.schemaVersion).toBe('bim-ai.benchmark.ui-cmdk-traceability.v1');
    expect(trace.benchmarkId).toBe('simple-single-storey-house');
    expect(trace.pathKind).toBe('traceability-only');
    expect(trace.parityClaim).toBe('none');
    expect(trace.latestEquivalenceArtifact).toBe('ui-equivalence.json');
    expect(trace.latestMachineReadableStatus).toBe('validated-replay');
    expect(trace.remainingUiBlockers.length).toBeGreaterThanOrEqual(3);
  });

  it('references registered Cmd+K entries and existing capability ids when metadata exists', () => {
    const trace = loadTraceability();
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));

    for (const step of trace.steps) {
      const entry = registryById.get(step.cmdKId);
      expect(entry, step.label).toBeTruthy();

      if (step.capabilityId === null) {
        expect(
          getCommandCapability(step.cmdKId),
          `${step.label} should remain documented as missing capability metadata`,
        ).toBeUndefined();
        continue;
      }

      const capability = getCommandCapability(step.cmdKId);
      expect(capability, step.label).toBeTruthy();
      expect(entry?.capabilityId, step.label).toBe(step.capabilityId);
      expect(capability?.capabilityId, step.label).toBe(step.capabilityId);
      expect(entry?.executionKind, step.label).toBe(step.expectedExecutionKind);
      expect(capability?.executionKind, step.label).toBe(step.expectedExecutionKind);
    }
  });

  it('does not classify activator, dialog, or navigation steps as benchmark semantic commits', () => {
    const trace = loadTraceability();
    const nonCommitKinds = new Set([
      'activates-tool',
      'opens-dialog',
      'navigates',
      'local-ui-only',
    ]);

    for (const step of trace.steps) {
      if (nonCommitKinds.has(step.expectedExecutionKind)) {
        expect(step.supportsBenchmarkSemanticOutput, step.label).toBe(false);
        continue;
      }

      expect(step.expectedExecutionKind, step.label).toBe('commits-command');
      expect(step.supportsBenchmarkSemanticOutput, step.label).toBe(true);
    }
  });

  it('maps every expected benchmark command surface to at least one Cmd+K step', () => {
    const trace = loadTraceability();
    const coveredSemanticOutputs = new Set(
      trace.steps.flatMap((step) => step.expectedSemanticOutputs),
    );

    for (const semanticOutput of [
      'createLevel',
      'createFloor',
      'createWallChain',
      'insertDoorOnWall',
      'insertWindowOnWall',
      'createRoomOutline',
      'createRoof',
      'saveViewpoint',
      'CreateSheet',
      'PlaceViewOnSheet',
      'create_schedule_view',
      'placeTag',
      'createDimension',
    ]) {
      expect(coveredSemanticOutputs.has(semanticOutput), semanticOutput).toBe(true);
    }
  });

  it('keeps committed semantic steps tied to non-browser agent equivalents when metadata declares them', () => {
    const trace = loadTraceability();
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));

    for (const step of trace.steps.filter((candidate) => candidate.agentToolId)) {
      const entry = registryById.get(step.cmdKId);
      expect(entry?.agentEquivalent?.toolId, step.label).toBe(step.agentToolId);
      expect(entry?.agentEquivalent?.completionKind, step.label).toBe(step.agentCompletionKind);
    }
  });

  it('publishes a machine-readable validated replay status and exact fixture replay diff', () => {
    const equivalence = loadEquivalence();
    const bundle = loadCommandBundle();
    const fixtureCounts = fixtureCommandTypeCounts();
    const diffTypes = Object.keys(equivalence.semanticReplayDiff.countDeltaByCommandType).sort();

    expect(equivalence.schemaVersion).toBe('bim-ai.benchmark.ui-cmdk-equivalence.v1');
    expect(equivalence.benchmarkId).toBe('simple-single-storey-house');
    expect(['executable', 'validated-replay', 'traceability-only']).toContain(
      equivalence.auditClassification,
    );
    expect(equivalence.status).toBe('validated-replay');
    expect(equivalence.pathKind).toBe('validated-replay');
    expect(equivalence.parityClaim).toBe('partial-ui-cmdk-equivalence');
    expect(equivalence.validation.browserAuthoredModel).toBe(false);
    expect(equivalence.validation.exactNumericUiInputExecutable).toBe(false);
    expect(equivalence.remainingUiBlockers.length).toBeGreaterThanOrEqual(5);

    expect(equivalence.semanticReplayDiff.status).toBe('matches-mcp-cli-fixture');
    expect(equivalence.semanticReplayDiff.fixtureCommandCount).toBe(bundle.commands.length);
    expect(equivalence.semanticReplayDiff.replayedCommandCount).toBe(bundle.commands.length);
    expect(equivalence.semanticReplayDiff.unmatchedFixtureCommandCount).toBe(0);
    expect(equivalence.semanticReplayDiff.unexpectedReplayCommandCount).toBe(0);
    expect(diffTypes).toEqual([...fixtureCounts.keys()].sort());
    for (const [commandType, count] of fixtureCounts) {
      expect(equivalence.semanticReplayDiff.countDeltaByCommandType[commandType]).toBe(0);
      const row = equivalence.cmdKBridgeCoverage.rows.find(
        (candidate) => candidate.commandType === commandType,
      );
      expect(row?.fixtureCount, commandType).toBe(count);
      expect(row?.validatedReplayCount, commandType).toBe(count);
    }
  });

  it('validates UI equivalence bridge rows against registered Cmd+K and capability metadata', () => {
    const equivalence = loadEquivalence();
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));
    const fixtureCounts = fixtureCommandTypeCounts();
    const deterministicCommandTypes = new Set(
      equivalence.cmdKBridgeCoverage.deterministicCmdKCommitCommandTypes,
    );
    const completedRows = equivalence.cmdKBridgeCoverage.rows.filter((row) => row.completedByCmdK);

    expect(equivalence.cmdKBridgeCoverage.fixtureCommandCount).toBe(
      loadCommandBundle().commands.length,
    );
    expect(equivalence.cmdKBridgeCoverage.fixtureCommandTypesTotal).toBe(fixtureCounts.size);
    expect(equivalence.cmdKBridgeCoverage.rows).toHaveLength(fixtureCounts.size);
    expect(new Set(completedRows.map((row) => row.commandType))).toEqual(deterministicCommandTypes);
    expect(equivalence.cmdKBridgeCoverage.exactUiExecutableCommandTypes).toEqual([]);
    expect(equivalence.cmdKBridgeCoverage.exactUiExecutableOperationCount).toBe(0);

    for (const row of equivalence.cmdKBridgeCoverage.rows) {
      expect(fixtureCounts.has(row.commandType), row.commandType).toBe(true);
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
        expect(entry?.executionKind, `${row.commandType}:${cmdKId}`).toBe('commits-command');
        expect(row.completedByCmdK, row.commandType).toBe(true);
        expect(row.exactFixturePayloadExecutable, row.commandType).toBe(false);
      }
    }
  });

  it('does not count activator-only commands as completed semantic operations', () => {
    const equivalence = loadEquivalence();
    const registryById = new Map(getRegistry().map((entry) => [entry.id, entry]));
    const deterministicCmdKIds = new Set(
      equivalence.cmdKBridgeCoverage.rows.flatMap((row) => row.deterministicCmdKIds ?? []),
    );

    for (const cmdKId of equivalence.cmdKBridgeCoverage.activatorOnlyCommandIds) {
      const entry = registryById.get(cmdKId);
      expect(entry?.executionKind, cmdKId).toBe('activates-tool');
      expect(deterministicCmdKIds.has(cmdKId), cmdKId).toBe(false);
    }

    for (const row of equivalence.cmdKBridgeCoverage.rows.filter((candidate) =>
      candidate.bridgeStatus.includes('activator-only'),
    )) {
      expect(row.completedByCmdK, row.commandType).toBe(false);
      expect(row.deterministicCmdKIds ?? [], row.commandType).toEqual([]);
      expect(row.blocker, row.commandType).toBeTruthy();
    }
  });
});
