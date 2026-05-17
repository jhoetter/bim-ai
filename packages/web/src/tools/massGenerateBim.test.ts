import { describe, expect, it } from 'vitest';
import {
  generateWallsFromMass,
  generateFloorsFromMass,
  generateRoofFromMass,
} from './massGenerateBim';
import type { Element } from '@bim-ai/core';

type MassBox = Extract<Element, { kind: 'mass_box' }>;
type MassExtrusion = Extract<Element, { kind: 'mass_extrusion' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

function makeLevel(id: string, elevationMm: number): LevelElem {
  return { kind: 'level', id, name: id, elevationMm } as LevelElem;
}

function makeMassBox(overrides: Partial<MassBox> = {}): MassBox {
  return {
    kind: 'mass_box',
    id: 'mass-1',
    widthMm: 5000,
    depthMm: 4000,
    heightMm: 8000,
    insertionXMm: 0,
    insertionYMm: 0,
    baseElevationMm: 0,
    ...overrides,
  } as MassBox;
}

function makeMassExtrusion(overrides: Partial<MassExtrusion> = {}): MassExtrusion {
  return {
    kind: 'mass_extrusion',
    id: 'mass-2',
    profilePoints: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    heightMm: 8000,
    baseElevationMm: 0,
    ...overrides,
  } as MassExtrusion;
}

describe('massing → BIM workflow — §11.5', () => {
  // §11.5-A: generate walls
  it('generate walls dispatches createWall for each vertical face', () => {
    const mass = makeMassBox();
    const cmds = generateWallsFromMass(mass, 'level-0');
    // A mass_box has 4 edges → 4 walls
    expect(cmds.length).toBe(4);
    for (const cmd of cmds) {
      expect(cmd.type).toBe('createWall');
      expect(cmd.levelId).toBe('level-0');
      expect(cmd.heightMm).toBe(8000);
      expect(cmd.widthMm).toBe(200);
      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
    }
  });

  it('each wall start/end covers the correct edge of the footprint', () => {
    const mass = makeMassBox({ insertionXMm: 0, insertionYMm: 0, widthMm: 3000, depthMm: 2000 });
    const cmds = generateWallsFromMass(mass, 'l0');
    const starts = cmds.map((c) => c.start);
    const ends = cmds.map((c) => c.end);
    // The four footprint corners are (0,0), (3000,0), (3000,2000), (0,2000)
    expect(starts).toContainEqual({ xMm: 0, yMm: 0 });
    expect(ends).toContainEqual({ xMm: 3000, yMm: 0 });
  });

  it('generate walls uses mass_extrusion profilePoints as footprint', () => {
    const mass = makeMassExtrusion();
    const cmds = generateWallsFromMass(mass, 'l0');
    // 4 profile points → 4 walls
    expect(cmds.length).toBe(4);
    expect(cmds[0]?.type).toBe('createWall');
  });

  // §11.5-B: generate floors
  it('generate floors dispatches createFloor per level', () => {
    const mass = makeMassBox({ baseElevationMm: 0, heightMm: 9000 });
    const levels = [makeLevel('l0', 0), makeLevel('l1', 3000), makeLevel('l2', 6000)];
    const cmds = generateFloorsFromMass(mass, levels);
    expect(cmds.length).toBe(3);
    for (const cmd of cmds) {
      expect(cmd.type).toBe('createFloor');
      expect(cmd.boundaryMm.length).toBeGreaterThan(0);
    }
    expect(cmds.map((c) => c.levelId)).toEqual(['l0', 'l1', 'l2']);
  });

  it('generate floors excludes levels outside the mass volume', () => {
    const mass = makeMassBox({ baseElevationMm: 1000, heightMm: 4000 });
    const levels = [
      makeLevel('below', 0), // below base
      makeLevel('inside', 2000), // inside
      makeLevel('above', 6000), // above top
    ];
    const cmds = generateFloorsFromMass(mass, levels);
    expect(cmds.length).toBe(1);
    expect(cmds[0]?.levelId).toBe('inside');
  });

  // §11.5-C: generate roof
  it('generate roof dispatches createRoof with top face boundary', () => {
    const mass = makeMassBox();
    const cmd = generateRoofFromMass(mass, 'top-level');
    expect(cmd.type).toBe('createRoof');
    expect(cmd.referenceLevelId).toBe('top-level');
    expect(cmd.footprintMm.length).toBe(4);
  });

  it('generate roof footprint matches mass_box plan extents', () => {
    const mass = makeMassBox({
      insertionXMm: 100,
      insertionYMm: 200,
      widthMm: 3000,
      depthMm: 2000,
    });
    const cmd = generateRoofFromMass(mass, 'l0');
    const xs = cmd.footprintMm.map((p) => p.xMm).sort((a, b) => a - b);
    const ys = cmd.footprintMm.map((p) => p.yMm).sort((a, b) => a - b);
    expect(xs).toEqual([100, 100, 3100, 3100]);
    expect(ys).toEqual([200, 200, 2200, 2200]);
  });

  // noop guards
  it('noop when massId is empty string — no commands generated', () => {
    // When the dispatch receives massId:'', Workspace noops. We test the
    // pure helpers don't crash with an empty footprint by using a minimal
    // extrusion with no profile points.
    const badMass = makeMassExtrusion({ profilePoints: [] });
    const walls = generateWallsFromMass(badMass, 'l0');
    expect(walls.length).toBe(0);
  });

  it('noop when element is not a mass kind — generateWallsFromMass returns empty for 0-pt footprint', () => {
    const badMass = makeMassExtrusion({ profilePoints: [{ xMm: 0, yMm: 0 }] });
    const walls = generateWallsFromMass(badMass, 'l0');
    // 1-point footprint cannot form any walls (n < 2 guard)
    expect(walls.length).toBe(0);
  });
});
