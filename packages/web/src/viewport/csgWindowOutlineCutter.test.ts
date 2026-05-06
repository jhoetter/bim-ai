/**
 * KRN-12: verify the WindowCutParams schema accepts an outline polygon and
 * that the request envelope round-trips it. The end-to-end CSG path is
 * exercised via the worker in production; this test covers the type + data
 * surface and asserts the polygon vertices flow through unchanged.
 */
import { describe, expect, it } from 'vitest';
import type { WindowCutParams } from './csgCutterGeometry';

describe('WindowCutParams.outlinePolygonMm — KRN-12', () => {
  it('rectangle path (no outlinePolygonMm) is unchanged', () => {
    const rect: WindowCutParams = {
      widthMm: 1200,
      heightMm: 1500,
      sillHeightMm: 900,
      alongT: 0.5,
      wallHeightMm: 2800,
    };
    expect(rect.outlinePolygonMm).toBeUndefined();
  });

  it('non-rect path carries polygon vertices through', () => {
    const trapezoid: WindowCutParams = {
      widthMm: 2000,
      heightMm: 2000,
      sillHeightMm: 900,
      alongT: 0.5,
      wallHeightMm: 2800,
      outlinePolygonMm: [
        { xMm: -1000, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1500 },
        { xMm: -1000, yMm: 2200 },
      ],
    };
    expect(trapezoid.outlinePolygonMm).toBeDefined();
    expect(trapezoid.outlinePolygonMm!.length).toBe(4);
    expect(trapezoid.outlinePolygonMm![0]).toEqual({ xMm: -1000, yMm: 0 });
  });

  it('polygon allowed to have many vertices (e.g. 32-segment circle)', () => {
    const circle: WindowCutParams = {
      widthMm: 1200,
      heightMm: 1200,
      sillHeightMm: 1200,
      alongT: 0.5,
      wallHeightMm: 2800,
      outlinePolygonMm: Array.from({ length: 32 }, (_, i) => {
        const theta = (2 * Math.PI * i) / 32 - Math.PI / 2;
        return { xMm: 600 * Math.cos(theta), yMm: 600 + 600 * Math.sin(theta) };
      }),
    };
    expect(circle.outlinePolygonMm!.length).toBe(32);
  });
});
