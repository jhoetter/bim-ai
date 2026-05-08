import { describe, expect, it, vi } from 'vitest';
import {
  dormerFootprintVerticesMm,
  dormerPlanGroup,
  renderDormerPlanSymbol,
} from './dormerPlanSymbol';
import type { Element } from '@bim-ai/core';

type DormerElement = Extract<Element, { kind: 'dormer' }>;
type RoofElement = Extract<Element, { kind: 'roof' }>;

const ROOF: RoofElement = {
  kind: 'roof',
  id: 'r1',
  name: 'main',
  referenceLevelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  ridgeOffsetTransverseMm: 1500,
  eaveHeightLeftMm: 1500,
  eaveHeightRightMm: 4000,
};

const DORMER: DormerElement = {
  kind: 'dormer',
  id: 'd1',
  hostRoofId: 'r1',
  positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
  widthMm: 2400,
  wallHeightMm: 2400,
  depthMm: 2000,
  dormerRoofKind: 'flat',
};

describe('dormerFootprintVerticesMm', () => {
  it('returns four corners around the dormer centre', () => {
    const verts = dormerFootprintVerticesMm(DORMER, ROOF);
    expect(verts).toHaveLength(4);
    expect(verts[0].xMm).toBeCloseTo(2500, 6);
    expect(verts[0].yMm).toBeCloseTo(800, 6);
    expect(verts[2].xMm).toBeCloseTo(4500, 6);
    expect(verts[2].yMm).toBeCloseTo(3200, 6);
  });
});

describe('renderDormerPlanSymbol', () => {
  it('strokes the outline and writes the "DR" label via the supplied ctx', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: '' as CanvasTextAlign,
      textBaseline: '' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;
    const worldToScreen = (xy: { xMm: number; yMm: number }): [number, number] => [
      xy.xMm / 10,
      xy.yMm / 10,
    ];
    renderDormerPlanSymbol(ctx, DORMER, ROOF, worldToScreen);
    expect(ctx.beginPath as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(ctx.closePath as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(ctx.stroke as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    const fillTextMock = ctx.fillText as unknown as ReturnType<typeof vi.fn>;
    expect(fillTextMock).toHaveBeenCalledTimes(1);
    expect(fillTextMock.mock.calls[0][0]).toBe('DR');
  });
});

describe('dormerPlanGroup', () => {
  it('returns null when host roof is missing', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
    };
    expect(dormerPlanGroup(DORMER, elementsById, 'lvl-1')).toBeNull();
  });

  it('returns null when active level differs from the host roof reference level', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      'lvl-2': { kind: 'level', id: 'lvl-2', name: 'L2', elevationMm: 6000 },
      r1: ROOF,
    };
    expect(dormerPlanGroup(DORMER, elementsById, 'lvl-2')).toBeNull();
  });

  it('returns a group with outline when level matches', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const g = dormerPlanGroup(DORMER, elementsById, 'lvl-1');
    expect(g).not.toBeNull();
    expect(g!.userData.bimPickId).toBe('d1');
    expect(g!.children.length).toBeGreaterThanOrEqual(1);
  });
});
