import { describe, expect, it } from 'vitest';
import { massToFloorCmds } from './massToFloors';
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

describe('massToFloorCmds — §11.5', () => {
  it('mass_box with 2 levels in range returns 2 FloorCmds', () => {
    const mass = makeMassBox({ baseElevationMm: 0, heightMm: 6000 });
    const levels = [makeLevel('l0', 0), makeLevel('l1', 3000), makeLevel('l2', 9000)];
    const cmds = massToFloorCmds(mass, levels);
    expect(cmds.length).toBe(2);
  });

  it('mass_box footprint has 4 corners', () => {
    const mass = makeMassBox({ baseElevationMm: 0, heightMm: 6000 });
    const levels = [makeLevel('l0', 0)];
    const cmds = massToFloorCmds(mass, levels);
    expect(cmds[0]?.boundary.length).toBe(4);
  });

  it('mass_box footprint corners match insertion + dimensions', () => {
    const mass = makeMassBox({
      insertionXMm: 1000,
      insertionYMm: 2000,
      widthMm: 3000,
      depthMm: 4000,
      baseElevationMm: 0,
      heightMm: 5000,
    });
    const levels = [makeLevel('l0', 0)];
    const [cmd] = massToFloorCmds(mass, levels);
    const xs = cmd!.boundary.map((p) => p.xMm).sort((a, b) => a - b);
    const ys = cmd!.boundary.map((p) => p.yMm).sort((a, b) => a - b);
    expect(xs).toEqual([1000, 1000, 4000, 4000]);
    expect(ys).toEqual([2000, 2000, 6000, 6000]);
  });

  it('mass_extrusion uses profilePoints as boundary', () => {
    const profilePoints = [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 3000 },
      { xMm: 0, yMm: 3000 },
    ];
    const mass: MassExtrusion = {
      kind: 'mass_extrusion',
      id: 'mass-2',
      profilePoints,
      heightMm: 4000,
      baseElevationMm: 0,
    } as MassExtrusion;
    const levels = [makeLevel('l0', 0)];
    const [cmd] = massToFloorCmds(mass, levels);
    expect(cmd?.boundary).toEqual(profilePoints);
  });

  it('level below base elevation is excluded', () => {
    const mass = makeMassBox({ baseElevationMm: 3000, heightMm: 5000 });
    const belowLevel = makeLevel('l-below', 0);
    const cmds = massToFloorCmds(mass, [belowLevel]);
    expect(cmds.length).toBe(0);
  });

  it('level above top is excluded', () => {
    const mass = makeMassBox({ baseElevationMm: 0, heightMm: 5000 });
    const aboveLevel = makeLevel('l-above', 6000);
    const cmds = massToFloorCmds(mass, [aboveLevel]);
    expect(cmds.length).toBe(0);
  });

  it('level at exact base elevation is included', () => {
    const mass = makeMassBox({ baseElevationMm: 3000, heightMm: 5000 });
    const atBase = makeLevel('l-base', 3000);
    const cmds = massToFloorCmds(mass, [atBase]);
    expect(cmds.length).toBe(1);
    expect(cmds[0]?.levelId).toBe('l-base');
  });

  it('each FloorCmd carries the correct levelId and elevationMm', () => {
    const mass = makeMassBox({ baseElevationMm: 0, heightMm: 10000 });
    const levels = [makeLevel('ground', 0), makeLevel('first', 3500), makeLevel('second', 7000)];
    const cmds = massToFloorCmds(mass, levels);
    const levelIds = cmds.map((c) => c.levelId);
    expect(levelIds).toContain('ground');
    expect(levelIds).toContain('first');
    expect(levelIds).toContain('second');
    expect(cmds.find((c) => c.levelId === 'first')?.elevationMm).toBe(3500);
  });
});
