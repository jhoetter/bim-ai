import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { groupDormersByOverlap } from './dormerGrouping';

type DormerElem = Extract<Element, { kind: 'dormer' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

const ROOF: RoofElem = {
  kind: 'roof',
  id: 'r1',
  name: 'main',
  referenceLevelId: 'lvl-1',
  // Long axis along plan-Y → ridgeAlongX=false.
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 12000 },
    { xMm: 0, yMm: 12000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  ridgeOffsetTransverseMm: 1500,
  eaveHeightLeftMm: 1500,
  eaveHeightRightMm: 4000,
};

function makeDormer(id: string, alongRidgeMm: number, widthMm = 2400, depthMm = 2000): DormerElem {
  return {
    kind: 'dormer',
    id,
    hostRoofId: 'r1',
    positionOnRoof: { alongRidgeMm, acrossRidgeMm: 1000 },
    widthMm,
    depthMm,
    wallHeightMm: 2400,
    dormerRoofKind: 'shed',
  };
}

describe('groupDormersByOverlap', () => {
  it('returns one group per dormer when they are far apart', () => {
    const a = makeDormer('a', -3000);
    const b = makeDormer('b', +3000);
    const groups = groupDormersByOverlap([a, b], ROOF);
    expect(groups).toHaveLength(2);
    expect(groups.flatMap((g) => g.memberIds).sort()).toEqual(['a', 'b']);
  });

  it('merges two dormers whose footprints are within the threshold (testhouse-1 south facade)', () => {
    // Ridge along plan-Y. Width=2400 runs along Y. Place two dormers along
    // the ridge with a 900mm gap edge-to-edge (centres 3300mm apart).
    const a = makeDormer('a', -1650);
    const b = makeDormer('b', +1650);
    const groups = groupDormersByOverlap([a, b], ROOF, 1000);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.memberIds.sort()).toEqual(['a', 'b']);
    // Merged AABB spans both: 2*1650 + width = 5700mm along Y.
    expect(g.mergedFootprint.maxY - g.mergedFootprint.minY).toBeCloseTo(5700, 1);
  });

  it('picks the larger dormer as the group primary (so the surviving body fills the merged opening)', () => {
    const small = makeDormer('small', -500, 1600, 1400);
    const large = makeDormer('large', +500, 2800, 2000);
    const groups = groupDormersByOverlap([small, large], ROOF);
    expect(groups).toHaveLength(1);
    expect(groups[0].primaryId).toBe('large');
  });

  it('uses the max wall height for the merged cluster', () => {
    const tall: DormerElem = { ...makeDormer('tall', -500), wallHeightMm: 2800 };
    const short: DormerElem = { ...makeDormer('short', +500), wallHeightMm: 2000 };
    const groups = groupDormersByOverlap([tall, short], ROOF);
    expect(groups[0].mergedWallHeightMm).toBe(2800);
  });

  it('keeps three dormers separate when they are pairwise far apart', () => {
    const a = makeDormer('a', -5000);
    const b = makeDormer('b', 0);
    const c = makeDormer('c', +5000);
    const groups = groupDormersByOverlap([a, b, c], ROOF, 200);
    expect(groups).toHaveLength(3);
  });
});
