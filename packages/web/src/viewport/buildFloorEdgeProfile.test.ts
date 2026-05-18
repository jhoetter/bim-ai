import { describe, expect, it } from 'vitest';
import { buildFloorEdgeProfileMesh } from './buildFloorEdgeProfile';
import type { Element } from '@bim-ai/core';

function makeFloor(
  edgeProfileMm?: { xMm: number; yMm: number }[],
): Extract<Element, { kind: 'floor' }> {
  return {
    kind: 'floor',
    id: 'f1',
    levelId: 'l1',
    thicknessMm: 250,
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    edgeProfileMm,
  } as unknown as Extract<Element, { kind: 'floor' }>;
}

describe('buildFloorEdgeProfileMesh — §2.4.2', () => {
  it('returns null when edgeProfileMm is undefined', () => {
    const floor = makeFloor(undefined);
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });

  it('returns null when edgeProfileMm has fewer than 2 points', () => {
    const floor = makeFloor([{ xMm: 0, yMm: 0 }]);
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });

  it('returns a mesh when edgeProfileMm has 2+ points', () => {
    const floor = makeFloor([
      { xMm: 0, yMm: 0 },
      { xMm: 100, yMm: 0 },
      { xMm: 100, yMm: 250 },
      { xMm: 0, yMm: 250 },
    ]);
    const result = buildFloorEdgeProfileMesh(floor, 250, 0);
    expect(result).not.toBeNull();
  });

  it('returns null when boundary has fewer than 3 points', () => {
    const floor = {
      kind: 'floor',
      id: 'f1',
      levelId: 'l1',
      thicknessMm: 250,
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
      ],
      edgeProfileMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 250 },
      ],
    } as unknown as Extract<Element, { kind: 'floor' }>;
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });
});
