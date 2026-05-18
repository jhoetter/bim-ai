import { readFileSync } from 'node:fs';
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
  steps: TraceStep[];
  remainingUiBlockers: string[];
};

const TRACE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../spec/benchmarks/simple-single-storey-house/ui-cmdk-traceability.json',
);

function loadTraceability(): TraceabilityArtifact {
  return JSON.parse(readFileSync(TRACE_PATH, 'utf8')) as TraceabilityArtifact;
}

describe('simple-house UI/Cmd+K traceability', () => {
  it('is explicitly traceability-only and preserves remaining UI blockers', () => {
    const trace = loadTraceability();

    expect(trace.schemaVersion).toBe('bim-ai.benchmark.ui-cmdk-traceability.v1');
    expect(trace.benchmarkId).toBe('simple-single-storey-house');
    expect(trace.pathKind).toBe('traceability-only');
    expect(trace.parityClaim).toBe('none');
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
});
