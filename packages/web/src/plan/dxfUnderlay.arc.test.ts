import { describe, it, expect, vi } from 'vitest';
import { arcToPolylineSegments, renderDxfUnderlay, type LinkDxfElement } from './dxfUnderlay';

function makeMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    font: '',
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const linkAtOrigin = (overrides: Partial<LinkDxfElement> = {}): LinkDxfElement => ({
  kind: 'link_dxf',
  id: 'lx-test',
  name: 'DXF Test',
  levelId: 'lvl-1',
  originMm: { xMm: 0, yMm: 0 },
  rotationDeg: 0,
  scaleFactor: 1,
  linework: [],
  ...overrides,
});

const passthrough = ({ xMm, yMm }: { xMm: number; yMm: number }): [number, number] => [xMm, yMm];

describe('arcToPolylineSegments', () => {
  it('converts a full-circle arc (0-360 deg) to a closed set of polyline segments', () => {
    const pts = arcToPolylineSegments({
      kind: 'arc',
      center: { xMm: 0, yMm: 0 },
      radiusMm: 100,
      startDeg: 0,
      endDeg: 360,
    });
    expect(pts.length).toBeGreaterThan(10);
    expect(pts[0]!.xMm).toBeCloseTo(pts[pts.length - 1]!.xMm, 3);
    expect(pts[0]!.yMm).toBeCloseTo(pts[pts.length - 1]!.yMm, 3);
  });

  it('converts a quarter arc (0-90 deg) to the correct number of segments', () => {
    const pts = arcToPolylineSegments({
      kind: 'arc',
      center: { xMm: 0, yMm: 0 },
      radiusMm: 100,
      startDeg: 0,
      endDeg: 90,
    });
    expect(pts.length).toBe(31);
    expect(pts[0]!.xMm).toBeCloseTo(100, 3);
    expect(pts[0]!.yMm).toBeCloseTo(0, 3);
    expect(pts[pts.length - 1]!.xMm).toBeCloseTo(0, 3);
    expect(pts[pts.length - 1]!.yMm).toBeCloseTo(100, 3);
  });

  it('handles wrap-around when endDeg < startDeg', () => {
    const pts = arcToPolylineSegments({
      kind: 'arc',
      center: { xMm: 0, yMm: 0 },
      radiusMm: 50,
      startDeg: 270,
      endDeg: 90,
    });
    expect(pts.length).toBeGreaterThan(5);
  });
});

describe('renderDxfUnderlay - circle entity', () => {
  it('calls ctx.arc() once for a circle primitive', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({
        linework: [{ kind: 'circle', center: { xMm: 100, yMm: 200 }, radiusMm: 50 }],
      }),
      passthrough,
    );
    const calls = (ctx.arc as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBeCloseTo(100, 3);
    expect(calls[0]![1]).toBeCloseTo(200, 3);
    expect(calls[0]![2]).toBeCloseTo(50, 3);
    expect(calls[0]![3]).toBeCloseTo(0, 6);
    expect(calls[0]![4]).toBeCloseTo(Math.PI * 2, 6);
  });

  it('strokes the circle path', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({ linework: [{ kind: 'circle', center: { xMm: 0, yMm: 0 }, radiusMm: 100 }] }),
      passthrough,
    );
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('scales circle radius correctly through a 2x worldToScreen transform', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({ linework: [{ kind: 'circle', center: { xMm: 0, yMm: 0 }, radiusMm: 100 }] }),
      ({ xMm, yMm }) => [xMm * 2, yMm * 2],
    );
    const calls = (ctx.arc as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![2]).toBeCloseTo(200, 3);
  });
});

describe('renderDxfUnderlay - text entity', () => {
  it('calls ctx.fillText() at the transformed position', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({
        linework: [{ kind: 'text', text: 'NORTH', positionMm: { xMm: 300, yMm: 400 } }],
      }),
      passthrough,
    );
    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe('NORTH');
    expect(calls[0]![1]).toBeCloseTo(300, 3);
    expect(calls[0]![2]).toBeCloseTo(400, 3);
  });

  it('does not call ctx.stroke() for a text entity', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({ linework: [{ kind: 'text', text: 'LABEL', positionMm: { xMm: 0, yMm: 0 } }] }),
      passthrough,
    );
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

describe('renderDxfUnderlay - hatch entity', () => {
  it('strokes each boundary loop as a closed polyline', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({
        linework: [
          {
            kind: 'hatch',
            boundaryPoints: [
              [
                { xMm: 0, yMm: 0 },
                { xMm: 100, yMm: 0 },
                { xMm: 100, yMm: 100 },
              ],
              [
                { xMm: 10, yMm: 10 },
                { xMm: 50, yMm: 10 },
                { xMm: 50, yMm: 50 },
              ],
            ],
          },
        ],
      }),
      passthrough,
    );
    expect((ctx.beginPath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect((ctx.closePath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('skips boundary loops with fewer than 2 points', () => {
    const ctx = makeMockContext();
    renderDxfUnderlay(
      ctx,
      linkAtOrigin({
        linework: [
          {
            kind: 'hatch',
            boundaryPoints: [
              [{ xMm: 0, yMm: 0 }],
              [
                { xMm: 0, yMm: 0 },
                { xMm: 100, yMm: 100 },
              ],
            ],
          },
        ],
      }),
      passthrough,
    );
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
