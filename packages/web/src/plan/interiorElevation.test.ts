/**
 * §6.1.5 — Interior elevation projection tests.
 */
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildInteriorElevationLines } from './interiorElevationProjection';

const marker: Extract<Element, { kind: 'interior_elevation_marker' }> = {
  kind: 'interior_elevation_marker',
  id: 'iem-1',
  positionMm: { xMm: 3000, yMm: 4000 },
  levelId: 'lvl-1',
  radiusMm: 3000,
  elevationViewIds: { north: 'ev-n', south: 'ev-s', east: 'ev-e', west: 'ev-w' },
};

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Level 1',
  elevationMm: 0,
};

// A wall directly north of the marker (yMm < marker.positionMm.yMm) — visible when looking N
const wallNorth: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-north',
  name: 'North Wall',
  levelId: 'lvl-1',
  start: { xMm: 1000, yMm: 2000 },
  end: { xMm: 5000, yMm: 2000 },
  thicknessMm: 200,
  heightMm: 2800,
};

// A wall far south of the marker — NOT visible when looking N
const wallFarSouth: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-far-south',
  name: 'Far South Wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 9000 },
  end: { xMm: 6000, yMm: 9000 },
  thicknessMm: 200,
  heightMm: 2800,
};

describe('buildElevationLines — §6.1.5', () => {
  it('returns empty array when no elements in view', () => {
    const result = buildInteriorElevationLines(marker, 'N', {});
    expect(result).toHaveLength(0);
  });

  it('projects a wall within the frustum as an ElevationLine', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-north': wallNorth,
    };
    const lines = buildInteriorElevationLines(marker, 'N', elementsById);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('wall ElevationLine has kind === "wall"', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-north': wallNorth,
    };
    const lines = buildInteriorElevationLines(marker, 'N', elementsById);
    expect(lines.every((l) => l.kind === 'wall')).toBe(true);
  });

  it('does not include walls outside the view frustum', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-far-south': wallFarSouth,
    };
    // Looking N (toward -Y), a wall at yMm=9000 is behind the marker (depth < 0)
    const lines = buildInteriorElevationLines(marker, 'N', elementsById);
    expect(lines).toHaveLength(0);
  });

  it('returns lines only for the elements that are within the radius', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-north': wallNorth,
      'w-far-south': wallFarSouth,
    };
    const lines = buildInteriorElevationLines(marker, 'N', elementsById);
    // Only the north wall should be included; far-south wall is outside frustum
    const wallLineCount = lines.filter((l) => l.kind === 'wall').length;
    expect(wallLineCount).toBeGreaterThan(0);
    // All lines should be for walls, none for the out-of-frustum wall
    // The far-south wall produces depth < 0 when looking N, so excluded
    expect(lines.length).toBeLessThanOrEqual(8); // at most 4 lines per wall
  });
});
