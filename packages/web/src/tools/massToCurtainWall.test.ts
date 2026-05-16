import { describe, expect, it } from 'vitest';
import { massToCurtainWallCmds } from './massToCurtainWall';
import type { Element } from '@bim-ai/core';

type MassBox = Extract<Element, { kind: 'mass_box' }>;
type MassExtrusion = Extract<Element, { kind: 'mass_extrusion' }>;
type MassRevolution = Extract<Element, { kind: 'mass_revolution' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

function makeLevel(id = 'l0', elevationMm = 0): LevelElem {
  return { kind: 'level', id, name: id, elevationMm } as LevelElem;
}

function makeMassBox(overrides: Partial<MassBox> = {}): MassBox {
  return {
    kind: 'mass_box',
    id: 'mass-1',
    widthMm: 5000,
    depthMm: 4000,
    heightMm: 3000,
    insertionXMm: 0,
    insertionYMm: 0,
    baseElevationMm: 0,
    ...overrides,
  } as MassBox;
}

describe('massToCurtainWallCmds — §11.5', () => {
  it('mass_box returns 4 CurtainWallCmds', () => {
    const mass = makeMassBox();
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    expect(cmds.length).toBe(4);
  });

  it('mass_extrusion with 4-point profile returns 4 CurtainWallCmds', () => {
    const mass: MassExtrusion = {
      kind: 'mass_extrusion',
      id: 'mass-2',
      profilePoints: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      heightMm: 3500,
      baseElevationMm: 0,
    } as MassExtrusion;
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    expect(cmds.length).toBe(4);
  });

  it('mass_extrusion with 3-point profile returns 3 CurtainWallCmds', () => {
    const mass: MassExtrusion = {
      kind: 'mass_extrusion',
      id: 'mass-3',
      profilePoints: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 2500, yMm: 4000 },
      ],
      heightMm: 2500,
      baseElevationMm: 0,
    } as MassExtrusion;
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    expect(cmds.length).toBe(3);
  });

  it('each cmd has correct heightMm for mass_box', () => {
    const mass = makeMassBox({ heightMm: 4200 });
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    cmds.forEach((c) => expect(c.heightMm).toBe(4200));
  });

  it('each cmd carries the base level id', () => {
    const mass = makeMassBox();
    const level = makeLevel('ground-floor', 0);
    const cmds = massToCurtainWallCmds(mass, level);
    cmds.forEach((c) => expect(c.levelId).toBe('ground-floor'));
  });

  it('mass_box wall segments form a closed loop', () => {
    const mass = makeMassBox({ insertionXMm: 0, insertionYMm: 0, widthMm: 5000, depthMm: 4000 });
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    // Each wall end should equal next wall start
    const n = cmds.length;
    for (let i = 0; i < n; i++) {
      const cur = cmds[i]!;
      const next = cmds[(i + 1) % n]!;
      expect(cur.endMm.xMm).toBe(next.startMm.xMm);
      expect(cur.endMm.yMm).toBe(next.startMm.yMm);
    }
  });

  it('mass_revolution returns 4 CurtainWallCmds (bounding box)', () => {
    const mass: MassRevolution = {
      kind: 'mass_revolution',
      id: 'mass-rev-1',
      profilePoints: [
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 5000 },
      ],
      axisPt1: { xMm: 0, yMm: 0 },
      axisPt2: { xMm: 0, yMm: 1 },
      baseElevationMm: 0,
    } as MassRevolution;
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    expect(cmds.length).toBe(4);
  });

  it('mass_revolution heightMm derived from profilePoints max y', () => {
    const mass: MassRevolution = {
      kind: 'mass_revolution',
      id: 'mass-rev-2',
      profilePoints: [
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 6000 },
      ],
      axisPt1: { xMm: 0, yMm: 0 },
      axisPt2: { xMm: 0, yMm: 1 },
      baseElevationMm: 0,
    } as MassRevolution;
    const cmds = massToCurtainWallCmds(mass, makeLevel());
    cmds.forEach((c) => expect(c.heightMm).toBe(6000));
  });
});
