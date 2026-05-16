import { describe, expect, it } from 'vitest';
import { computeFloorsByLevel, type MassElem, type LevelElem } from './massFloorsByLevel';

const TALL_BOX: MassElem = {
  kind: 'mass',
  id: 'm1',
  levelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  heightMm: 10000,
};

const LEVELS: LevelElem[] = [
  { kind: 'level', id: 'lvl-1', name: 'Ground', elevationMm: 0 },
  { kind: 'level', id: 'lvl-2', name: 'Level 2', elevationMm: 3500 },
  { kind: 'level', id: 'lvl-3', name: 'Level 3', elevationMm: 7000 },
  { kind: 'level', id: 'lvl-4', name: 'Roof', elevationMm: 12000 },
];

describe('computeFloorsByLevel', () => {
  it('creates floors at levels that intersect the mass', () => {
    const floors = computeFloorsByLevel(TALL_BOX, LEVELS, 0);
    // Levels 1, 2, 3 are within 0..10000mm; Level 4 (12000mm) is above
    expect(floors.length).toBe(3);
  });

  it('each floor has the correct level ID', () => {
    const floors = computeFloorsByLevel(TALL_BOX, LEVELS, 0);
    const ids = floors.map((f) => f.levelId);
    expect(ids).toContain('lvl-1');
    expect(ids).toContain('lvl-2');
    expect(ids).toContain('lvl-3');
    expect(ids).not.toContain('lvl-4');
  });

  it('each floor boundary has the mass footprint shape', () => {
    const floors = computeFloorsByLevel(TALL_BOX, LEVELS, 0);
    floors.forEach((f) => {
      expect(f.boundary.length).toBe(4);
    });
  });

  it('no floors when all levels are outside the mass height range', () => {
    const floors = computeFloorsByLevel(TALL_BOX, [LEVELS[3]!], 0);
    expect(floors.length).toBe(0);
  });
});
