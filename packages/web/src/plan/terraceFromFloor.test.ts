import { describe, expect, it } from 'vitest';
import { buildTerraceRailing } from './terraceFromFloor';

describe('terraceFromFloor — §2.9.1', () => {
  const floor: any = {
    id: 'f1',
    kind: 'floor',
    levelId: 'L1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    thicknessMm: 200,
  };

  it('returns null for floor with no boundary', () => {
    expect(buildTerraceRailing({ ...floor, boundaryMm: [] }, 1100)).toBeNull();
  });

  it('returns null for floor with fewer than 3 boundary points', () => {
    expect(
      buildTerraceRailing(
        {
          ...floor,
          boundaryMm: [
            { xMm: 0, yMm: 0 },
            { xMm: 5000, yMm: 0 },
          ],
        },
        1100,
      ),
    ).toBeNull();
  });

  it('returns a railing element for a valid floor', () => {
    const railing = buildTerraceRailing(floor, 1100);
    expect(railing).not.toBeNull();
    expect(railing?.kind).toBe('railing');
    expect(railing?.railingHeightMm).toBe(1100);
  });

  it('railing path closes the boundary (first point repeated)', () => {
    const railing = buildTerraceRailing(floor, 1100);
    const path = railing?.pathMm ?? [];
    expect(path.length).toBe(floor.boundaryMm.length + 1);
    expect(path[path.length - 1]).toEqual(path[0]);
  });

  it('uses specified railing height', () => {
    const railing = buildTerraceRailing(floor, 900);
    expect(railing?.railingHeightMm).toBe(900);
  });
});
