import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  DXF_UNDERLAY_OPACITY,
  DXF_UNDERLAY_STROKE,
  makeDxfLinkTransform,
  renderDxfUnderlay,
  resolveDxfLayerRows,
  resolveDxfAlignmentAnchorMm,
  selectDxfUnderlaysForLevel,
  type LinkDxfElement,
} from './dxfUnderlay';

function makeMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const linkAtOrigin = (overrides: Partial<LinkDxfElement> = {}): LinkDxfElement => ({
  kind: 'link_dxf',
  id: 'lx-1',
  name: 'DXF',
  levelId: 'lvl-1',
  originMm: { xMm: 0, yMm: 0 },
  rotationDeg: 0,
  scaleFactor: 1,
  linework: [],
  ...overrides,
});

describe('renderDxfUnderlay', () => {
  it('strokes a single line primitive once with the underlay style', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      linework: [{ kind: 'line', start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } }],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm / 10, yMm / 10]);

    expect((ctx.beginPath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 0]]);
    expect((ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([[100, 0]]);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(ctx.strokeStyle).toBe(DXF_UNDERLAY_STROKE);
    expect(ctx.globalAlpha).toBe(DXF_UNDERLAY_OPACITY);
  });

  it('uses configured overlay colour and opacity for linked underlays', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      colorMode: 'custom',
      customColor: '#ff00aa',
      overlayOpacity: 0.25,
      linework: [{ kind: 'line', start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } }],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm / 10, yMm / 10]);

    expect(ctx.strokeStyle).toBe('#ff00aa');
    expect(ctx.globalAlpha).toBe(0.25);
  });

  it('skips primitives whose DXF layer is hidden on the link', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      hiddenLayerNames: ['A-WALL'],
      linework: [
        {
          kind: 'line',
          layerName: 'A-WALL',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 1000, yMm: 0 },
        },
        {
          kind: 'line',
          layerName: 'A-DOOR',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 0, yMm: 1000 },
        },
      ],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm / 10, yMm / 10]);

    expect((ctx.beginPath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 100]]);
  });

  it('derives queryable layer rows from linework when dxfLayers is absent', () => {
    const link = linkAtOrigin({
      linework: [
        {
          kind: 'line',
          layerName: 'A-WALL',
          layerColor: '#ff0000',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 1, yMm: 1 },
        },
        {
          kind: 'line',
          layerName: 'A-WALL',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 2, yMm: 2 },
        },
      ],
    });
    expect(resolveDxfLayerRows(link)).toEqual([
      { name: 'A-WALL', color: '#ff0000', primitiveCount: 2 },
    ]);
  });

  it('walks every vertex of an open polyline and adds a closing edge when closed', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      linework: [
        {
          kind: 'polyline',
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 100, yMm: 0 },
            { xMm: 100, yMm: 100 },
          ],
          closed: true,
        },
      ],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm, yMm]);

    expect((ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 0]]);
    expect((ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect((ctx.closePath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('tessellates an arc into multiple line segments', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      linework: [
        {
          kind: 'arc',
          center: { xMm: 0, yMm: 0 },
          radiusMm: 100,
          startDeg: 0,
          endDeg: 90,
        },
      ],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm, yMm]);
    expect((ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      10,
    );
  });

  it('applies originMm + rotationDeg + scaleFactor before projection', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      originMm: { xMm: 100, yMm: 50 },
      rotationDeg: 90,
      scaleFactor: 2,
      linework: [{ kind: 'line', start: { xMm: 0, yMm: 0 }, end: { xMm: 10, yMm: 0 } }],
    });
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm, yMm]);

    const moveCalls = (ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const lineCalls = (ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(moveCalls[0][0]).toBeCloseTo(100, 6);
    expect(moveCalls[0][1]).toBeCloseTo(50, 6);
    expect(lineCalls[0][0]).toBeCloseTo(100, 6);
    expect(lineCalls[0][1]).toBeCloseTo(70, 6);
  });

  it('aligns DXF origin to the host project base point when requested', () => {
    const ctx = makeMockContext();
    const link = linkAtOrigin({
      originAlignmentMode: 'project_origin',
      originMm: { xMm: 25, yMm: 50 },
      linework: [{ kind: 'line', start: { xMm: 0, yMm: 0 }, end: { xMm: 100, yMm: 0 } }],
    });
    const elementsById: Record<string, Element> = {
      pbp: {
        kind: 'project_base_point',
        id: 'pbp',
        positionMm: { xMm: 1000, yMm: 2000, zMm: 0 },
        angleToTrueNorthDeg: 0,
      },
    };
    renderDxfUnderlay(ctx, link, ({ xMm, yMm }) => [xMm, yMm], elementsById);

    const moveCalls = (ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const lineCalls = (ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(moveCalls[0]).toEqual([1025, 2050]);
    expect(lineCalls[0]).toEqual([1125, 2050]);
  });

  it('aligns DXF origin to the host survey point when shared coordinates are requested', () => {
    const link = linkAtOrigin({
      originAlignmentMode: 'shared_coords',
      originMm: { xMm: -10, yMm: 15 },
    });
    const elementsById: Record<string, Element> = {
      sp: {
        kind: 'survey_point',
        id: 'sp',
        positionMm: { xMm: 300, yMm: 700, zMm: 0 },
        sharedElevationMm: 0,
      },
    };
    expect(resolveDxfAlignmentAnchorMm(link, elementsById)).toEqual({ xMm: 290, yMm: 715 });
    expect(makeDxfLinkTransform(link, elementsById)({ xMm: 20, yMm: 30 })).toEqual({
      xMm: 310,
      yMm: 745,
    });
  });

  it('does nothing when linework is empty', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(ctx, linkAtOrigin({ linework: [] }), () => [0, 0]);
    expect((ctx.beginPath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

describe('selectDxfUnderlaysForLevel', () => {
  it('returns only link_dxf elements that match the supplied levelId', () => {
    const a: LinkDxfElement = {
      kind: 'link_dxf',
      id: 'a',
      levelId: 'lvl-1',
      originMm: { xMm: 0, yMm: 0 },
      linework: [],
    };
    const b: LinkDxfElement = {
      kind: 'link_dxf',
      id: 'b',
      levelId: 'lvl-2',
      originMm: { xMm: 0, yMm: 0 },
      linework: [],
    };
    const elementsById: Record<string, Element> = {
      a,
      b,
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 0 },
    };
    expect(selectDxfUnderlaysForLevel(elementsById, 'lvl-1').map((e) => e.id)).toEqual(['a']);
    expect(selectDxfUnderlaysForLevel(elementsById, 'lvl-2').map((e) => e.id)).toEqual(['b']);
  });

  it('returns [] when levelId is undefined', () => {
    const elementsById: Record<string, Element> = {
      a: {
        kind: 'link_dxf',
        id: 'a',
        levelId: 'lvl-1',
        originMm: { xMm: 0, yMm: 0 },
        linework: [],
      },
    };
    expect(selectDxfUnderlaysForLevel(elementsById, undefined)).toEqual([]);
  });
});
