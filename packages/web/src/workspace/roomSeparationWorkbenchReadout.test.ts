import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

import {
  buildRoomSeparationEvidenceToken,
  buildRoomSeparationWorkbenchReadout,
  validateAxisAlignedSeparationSegmentMm,
} from './roomSeparationWorkbenchReadout';

function sep(id: string): Extract<Element, { kind: 'room_separation' }> {
  return {
    kind: 'room_separation',
    id,
    name: 'S',
    levelId: 'lvl',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 0, yMm: 2000 },
  };
}

describe('roomSeparationWorkbenchReadout', () => {
  it('validateAxisAlignedSeparationSegmentMm rejects short segments', () => {
    const v = validateAxisAlignedSeparationSegmentMm(0, 0, 40, 0);
    expect(v.ok).toBe(false);
  });

  it('validateAxisAlignedSeparationSegmentMm accepts horizontal segment', () => {
    const v = validateAxisAlignedSeparationSegmentMm(0, 0, 2000, 0);
    expect(v.ok).toBe(true);
  });

  it('buildRoomSeparationWorkbenchReadout merges wire row flags', () => {
    const wire: PlanProjectionPrimitivesV1Wire = {
      format: 'planProjectionPrimitives_v1',
      roomSeparations: [
        {
          id: 'rs-1',
          name: 'S',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 0, y: 2000 },
          lengthMm: 2000,
          axisAlignedBoundarySegmentEligible: true,
          onAuthoritativeDerivedFootprintBoundary: true,
          piercesDerivedRectangleInterior: false,
        },
      ],
    };
    const elements: Record<string, Element> = {
      lvl: { kind: 'level', id: 'lvl', name: 'L1', elevationMm: 0 },
      'rs-1': sep('rs-1'),
    };
    const r = buildRoomSeparationWorkbenchReadout(
      elements['rs-1'] as Extract<Element, { kind: 'room_separation' }>,
      elements,
      wire,
    );
    expect(r.axisAlignedBoundarySegmentEligible).toBe(true);
    expect(r.onAuthoritativeDerivedFootprintBoundary).toBe(true);
    expect(r.piercesDerivedRectangleInterior).toBe(false);
    expect(r.levelName).toBe('L1');
    expect(buildRoomSeparationEvidenceToken(r)).toContain('rs-1');
  });

  it('buildRoomSeparationWorkbenchReadout falls back when wire missing', () => {
    const elements: Record<string, Element> = {
      lvl: { kind: 'level', id: 'lvl', name: 'L1', elevationMm: 0 },
      'rs-d': {
        kind: 'room_separation',
        id: 'rs-d',
        name: 'D',
        levelId: 'lvl',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 3000, yMm: 3000 },
      },
    };
    const r = buildRoomSeparationWorkbenchReadout(
      elements['rs-d'] as Extract<Element, { kind: 'room_separation' }>,
      elements,
      null,
    );
    expect(r.axisAlignedBoundarySegmentEligible).toBe(false);
    expect(r.axisBoundarySegmentExcludedReason).toBe('non_axis_aligned');
  });
});
