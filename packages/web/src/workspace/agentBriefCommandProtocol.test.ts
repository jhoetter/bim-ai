import { describe, expect, it } from 'vitest';

import {
  formatAgentBriefCommandProtocolReadout,
  parseAgentBriefCommandProtocolV1,
  type AgentBriefCommandProtocolV1,
} from './agentBriefCommandProtocol';

const minimalProtocol = (): AgentBriefCommandProtocolV1 => ({
  format: 'agentBriefCommandProtocol_v1',
  schemaVersion: 1,
  sourceBrief: { briefKind: 'bcf', briefId: 'b1', briefTitle: 'T' },
  assumptionIds: ['z', 'a'],
  deviationIds: [],
  missingAssumptionReferences: [],
  proposedCommandCount: 2,
  commandTypeHistogram: { createWall: 2, createLevel: 1 },
  validationRuleIds: ['b', 'a'],
  validationTargetElementIds: ['e1', 'd1'],
  unresolvedBlockers: ['b'],
});

describe('parseAgentBriefCommandProtocolV1', () => {
  it('accepts a well-formed payload', () => {
    const raw = {
      format: 'agentBriefCommandProtocol_v1',
      schemaVersion: 1,
      sourceBrief: { briefKind: 'bcf', briefId: 'x', briefTitle: 'y' },
      assumptionIds: [],
      deviationIds: [],
      missingAssumptionReferences: [],
      proposedCommandCount: 0,
      commandTypeHistogram: {},
      validationRuleIds: [],
      validationTargetElementIds: [],
      unresolvedBlockers: [],
    };
    expect(parseAgentBriefCommandProtocolV1(raw)).toEqual(raw);
  });

  it('returns null on wrong format', () => {
    expect(parseAgentBriefCommandProtocolV1({ format: 'nope' })).toBeNull();
    expect(parseAgentBriefCommandProtocolV1(null)).toBeNull();
  });
});

describe('formatAgentBriefCommandProtocolReadout', () => {
  it('returns placeholder when protocol is null', () => {
    expect(formatAgentBriefCommandProtocolReadout(null)).toEqual(['(no protocol)']);
  });

  it('sorts histogram lines and lists deterministically', () => {
    const lines = formatAgentBriefCommandProtocolReadout(minimalProtocol());
    expect(lines.some((l) => l.includes('hist createLevel: 1'))).toBe(true);
    expect(lines.some((l) => l.includes('hist createWall: 2'))).toBe(true);
    const idxLevel = lines.findIndex((l) => l.includes('hist createLevel'));
    const idxWall = lines.findIndex((l) => l.includes('hist createWall'));
    expect(idxLevel).toBeLessThan(idxWall);
    expect(lines.some((l) => l.startsWith('validationRuleIds:'))).toBe(true);
    const ruleLine = lines.find((l) => l.startsWith('validationRuleIds:'));
    expect(ruleLine).toMatch(/b, a/);
  });

  it('formats missing assumption references', () => {
    const p = minimalProtocol();
    p.missingAssumptionReferences = [
      { deviationId: 'dv2', relatedAssumptionId: 'z' },
      { deviationId: 'dv1', relatedAssumptionId: 'a' },
    ];
    const lines = formatAgentBriefCommandProtocolReadout(p);
    expect(lines.some((l) => l.includes('missingRef dv1 -> a'))).toBe(true);
    expect(lines.some((l) => l.includes('missingRef dv2 -> z'))).toBe(true);
  });
});
