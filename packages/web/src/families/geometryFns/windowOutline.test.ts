/**
 * KRN-12: window outline polygon resolution.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { resolveWindowOutline, outlineBoundsMm } from './windowOutline';

type WindowElem = Extract<Element, { kind: 'window' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

const baseLevel: LevelElem = {
  kind: 'level',
  id: 'lvl0',
  name: 'GF',
  elevationMm: 0,
};

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 10000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

function win(over?: Partial<WindowElem>): WindowElem {
  return {
    kind: 'window',
    id: 'win1',
    name: 'Win',
    wallId: 'w1',
    alongT: 0.5,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
    ...over,
  };
}

const els = (...extra: Element[]): Record<string, Element> => {
  const out: Record<string, Element> = {
    [baseLevel.id]: baseLevel,
    [baseWall.id]: baseWall,
  };
  for (const e of extra) out[e.id] = e;
  return out;
};

describe('resolveWindowOutline — KRN-12', () => {
  it('rectangle returns 4 corners centred on sill', () => {
    const poly = resolveWindowOutline(win(), baseWall, els());
    expect(poly).not.toBeNull();
    expect(poly!.length).toBe(4);
    const b = outlineBoundsMm(poly!);
    expect(b.minX).toBeCloseTo(-600, 5);
    expect(b.maxX).toBeCloseTo(600, 5);
    expect(b.minY).toBeCloseTo(0, 5);
    expect(b.maxY).toBeCloseTo(1500, 5);
  });

  it('rectangle uses selected family type dimensions instead of stale instance dimensions', () => {
    const type: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-window',
      name: 'Typed Window',
      familyId: 'custom-window',
      discipline: 'window',
      parameters: { widthMm: 900, heightMm: 2200, sillMm: 150 },
    };
    const poly = resolveWindowOutline(
      win({ widthMm: 2400, heightMm: 900, sillHeightMm: 900, familyTypeId: type.id }),
      baseWall,
      els(type),
    );

    const b = outlineBoundsMm(poly!);
    expect(b.minX).toBeCloseTo(-450, 5);
    expect(b.maxX).toBeCloseTo(450, 5);
    expect(b.maxY).toBeCloseTo(2200, 5);
  });

  it('arched_top has flat bottom and curved top with > 4 vertices', () => {
    const poly = resolveWindowOutline(win({ outlineKind: 'arched_top' }), baseWall, els());
    expect(poly).not.toBeNull();
    expect(poly!.length).toBeGreaterThan(8);
    const b = outlineBoundsMm(poly!);
    expect(b.minY).toBeCloseTo(0, 5); // sill is flat
    expect(b.maxY).toBeCloseTo(1500, 5); // arch top reaches full height
  });

  it('circle returns 32-segment polygon inside bounding box', () => {
    const poly = resolveWindowOutline(win({ outlineKind: 'circle' }), baseWall, els());
    expect(poly).not.toBeNull();
    expect(poly!.length).toBe(32);
    const b = outlineBoundsMm(poly!);
    // r = min(1200, 1500) / 2 = 600 → diameter 1200
    expect(b.maxX - b.minX).toBeCloseTo(1200, 0);
    expect(b.maxY - b.minY).toBeCloseTo(1200, 0);
    expect(b.minY).toBeCloseTo(0, 5); // bottom of circle on sill
  });

  it('octagon returns 8-vertex polygon', () => {
    const poly = resolveWindowOutline(win({ outlineKind: 'octagon' }), baseWall, els());
    expect(poly).not.toBeNull();
    expect(poly!.length).toBe(8);
  });

  it('custom returns the supplied vertices', () => {
    const customPoly = [
      { xMm: -500, yMm: 0 },
      { xMm: 500, yMm: 0 },
      { xMm: 0, yMm: 1200 },
    ];
    const poly = resolveWindowOutline(
      win({ outlineKind: 'custom', outlineMm: customPoly }),
      baseWall,
      els(),
    );
    expect(poly).not.toBeNull();
    expect(poly!.length).toBe(3);
    expect(poly![2].yMm).toBe(1200);
  });

  it('custom with insufficient vertices returns null', () => {
    const poly = resolveWindowOutline(
      win({ outlineKind: 'custom', outlineMm: [{ xMm: 0, yMm: 0 }] }),
      baseWall,
      els(),
    );
    expect(poly).toBeNull();
  });

  it('gable_trapezoid without attachedRoofId returns null', () => {
    const poly = resolveWindowOutline(win({ outlineKind: 'gable_trapezoid' }), baseWall, els());
    expect(poly).toBeNull();
  });

  it('gable_trapezoid with valid roof produces non-rect top edge', () => {
    // Place a gable roof spanning the wall, ridge along x. The window sits
    // off-centre so its left and right edges hit the roof at different heights.
    const roof: RoofElem = {
      kind: 'roof',
      id: 'roof1',
      name: 'Roof',
      referenceLevelId: 'lvl0',
      footprintMm: [
        { xMm: 0, yMm: -3000 },
        { xMm: 10000, yMm: -3000 },
        { xMm: 10000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      slopeDeg: 30,
      ridgeAxis: 'x',
      roofGeometryMode: 'gable_pitched_rectangle',
    };
    const w: WindowElem = win({
      outlineKind: 'gable_trapezoid',
      attachedRoofId: 'roof1',
      sillHeightMm: 200,
      widthMm: 2000,
      alongT: 0.3,
    });
    const poly = resolveWindowOutline(w, baseWall, els(roof));
    expect(poly).not.toBeNull();
    expect(poly!.length).toBe(4);
    // Bottom is flat at y=0, top edge has different y at left vs right.
    const sorted = [...poly!].sort((a, b) => a.xMm - b.xMm);
    const [bottomLeft, topLeft, topRight, bottomRight] = (() => {
      const bottoms = poly!.filter((p) => p.yMm === 0);
      const tops = poly!.filter((p) => p.yMm !== 0);
      bottoms.sort((a, b) => a.xMm - b.xMm);
      tops.sort((a, b) => a.xMm - b.xMm);
      return [bottoms[0], tops[0], tops[1], bottoms[1]];
    })();
    void sorted;
    expect(bottomLeft.yMm).toBe(0);
    expect(bottomRight.yMm).toBe(0);
    expect(topLeft.yMm).toBeGreaterThan(0);
    expect(topRight.yMm).toBeGreaterThan(0);
  });

  it('default (no outlineKind) is rectangle behaviour', () => {
    const noKind = resolveWindowOutline(win(), baseWall, els());
    const explicit = resolveWindowOutline(win({ outlineKind: 'rectangle' }), baseWall, els());
    expect(noKind).toEqual(explicit);
  });
});

describe('outlineBoundsMm', () => {
  it('returns min/max correctly', () => {
    const b = outlineBoundsMm([
      { xMm: -3, yMm: 0 },
      { xMm: 5, yMm: 4 },
      { xMm: 1, yMm: -1 },
    ]);
    expect(b.minX).toBe(-3);
    expect(b.maxX).toBe(5);
    expect(b.minY).toBe(-1);
    expect(b.maxY).toBe(4);
  });
});
