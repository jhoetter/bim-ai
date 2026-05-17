/**
 * §6.1.4 — Elevation view geometry projection tests.
 */
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildElevationLines } from './elevationProjection';

const view: Extract<Element, { kind: 'elevation_view' }> = {
  kind: 'elevation_view',
  id: 'ev-N',
  name: 'North Elevation',
  direction: 'north',
};

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-1',
  name: 'W1',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Level 1',
  elevationMm: 0,
};

describe('elevation projection — §6.1.4', () => {
  it('returns empty array when no elements', () => {
    const result = buildElevationLines(view, {});
    expect(result).toHaveLength(0);
  });

  it('builds lines for a single wall in N direction', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-1': wall,
    };
    const lines = buildElevationLines(view, elementsById);
    // A wall produces 4 lines: bottom, top, left end, right end
    expect(lines.length).toBe(4);
  });

  it('wall facing N produces 4 lines (top/bottom/left/right)', () => {
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-1': wall,
    };
    const lines = buildElevationLines(view, elementsById);
    expect(lines.length).toBe(4);
    // Bottom line: y1 = y2 = 0, x1=0, x2=4000
    const bottom = lines.find((l) => l.y1 === 0 && l.y2 === 0 && l.x1 !== l.x2);
    expect(bottom).toBeDefined();
    // Top line: y1 = y2 = 3000
    const top = lines.find((l) => l.y1 === 3000 && l.y2 === 3000 && l.x1 !== l.x2);
    expect(top).toBeDefined();
    // Left vertical: x1 = x2 = 0
    const left = lines.find((l) => l.x1 === 0 && l.x2 === 0 && l.y1 !== l.y2);
    expect(left).toBeDefined();
    // Right vertical: x1 = x2 = 4000
    const right = lines.find((l) => l.x1 === 4000 && l.x2 === 4000 && l.y1 !== l.y2);
    expect(right).toBeDefined();
  });

  it('S direction mirrors X axis', () => {
    const southView: Extract<Element, { kind: 'elevation_view' }> = {
      ...view,
      direction: 'south',
    };
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'w-1': wall,
    };
    const lines = buildElevationLines(southView, elementsById);
    expect(lines.length).toBe(4);
    // In south direction, xMm is negated: start x=0 → 0, end x=4000 → -4000
    const bottom = lines.find((l) => l.y1 === 0 && l.y2 === 0 && l.x1 !== l.x2);
    expect(bottom).toBeDefined();
    expect(bottom?.x1).toBe(0);
    expect(bottom?.x2).toBe(-4000);
  });

  it('floor boundary produces horizontal lines at base elevation', () => {
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'f-1',
      name: 'Floor 1',
      levelId: 'lvl-1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 6000, yMm: 0 },
        { xMm: 6000, yMm: 4000 },
        { xMm: 0, yMm: 4000 },
      ],
      thicknessMm: 300,
    };
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': level,
      'f-1': floor,
    };
    const lines = buildElevationLines(view, elementsById);
    // 4 boundary points → 4 horizontal lines at y = 0
    expect(lines.length).toBe(4);
    for (const l of lines) {
      expect(l.y1).toBe(0);
      expect(l.y2).toBe(0);
    }
  });

  it('uses level elevationMm as wall base elevation', () => {
    const elevatedLevel: Extract<Element, { kind: 'level' }> = {
      ...level,
      elevationMm: 3500,
    };
    const elementsById: Record<string, Element | undefined> = {
      'lvl-1': elevatedLevel,
      'w-1': wall,
    };
    const lines = buildElevationLines(view, elementsById);
    const bottom = lines.find((l) => l.y1 === l.y2 && l.x1 !== l.x2 && l.y1 === 3500);
    expect(bottom).toBeDefined();
    const top = lines.find((l) => l.y1 === l.y2 && l.x1 !== l.x2 && l.y1 === 3500 + wall.heightMm);
    expect(top).toBeDefined();
  });
});
