import { describe, expect, it } from 'vitest';
import { generateCurtainWallsFromMass } from './massGenerateBim';
import type { Element } from '@bim-ai/core';

type MassBox = Extract<Element, { kind: 'mass_box' }>;
type MassExtrusion = Extract<Element, { kind: 'mass_extrusion' }>;

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

describe('generateCurtainWallsFromMass — §11.5', () => {
  it('returns walls for each vertical face of a mass_box', () => {
    const mass = makeMassBox();
    const cmds = generateCurtainWallsFromMass(mass, 'level-0');
    // A mass_box has 4 edges → 4 curtain walls
    expect(cmds.length).toBe(4);
    for (const cmd of cmds) {
      expect(cmd.type).toBe('createWall');
      expect(cmd.levelId).toBe('level-0');
      expect(cmd.heightMm).toBe(8000);
      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
    }
  });

  it('each generated wall has curtainWallData set', () => {
    const mass = makeMassBox();
    const cmds = generateCurtainWallsFromMass(mass, 'level-0');
    for (const cmd of cmds) {
      expect(cmd.isCurtainWall).toBe(true);
      expect(cmd.curtainWallData).toBeDefined();
      expect(cmd.curtainWallData.gridH.count).toBe(2);
      expect(cmd.curtainWallData.gridV.count).toBe(3);
      expect(cmd.curtainWallData.panelType).toBe('glass');
      expect(cmd.curtainWallData.mullionType).toBe('rectangular');
    }
  });

  it('generated wall lengthMm matches face width', () => {
    const mass = makeMassBox({ insertionXMm: 0, insertionYMm: 0, widthMm: 3000, depthMm: 2000 });
    const cmds = generateCurtainWallsFromMass(mass, 'l0');
    // For a rectangular footprint: two sides of 3000 and two sides of 2000
    const lengths = cmds.map((c) =>
      Math.round(
        Math.sqrt(Math.pow(c.end.xMm - c.start.xMm, 2) + Math.pow(c.end.yMm - c.start.yMm, 2)),
      ),
    );
    expect(lengths).toContain(3000);
    expect(lengths).toContain(2000);
  });

  it('returns empty array for zero-volume mass', () => {
    const mass = makeMassExtrusion({ profilePoints: [] });
    const cmds = generateCurtainWallsFromMass(mass, 'l0');
    expect(cmds).toHaveLength(0);
  });

  it('works with mass_extrusion profilePoints as footprint', () => {
    const mass = makeMassExtrusion();
    const cmds = generateCurtainWallsFromMass(mass, 'l0');
    // 4 profile points → 4 curtain walls
    expect(cmds.length).toBe(4);
    expect(cmds[0]?.isCurtainWall).toBe(true);
  });
});
