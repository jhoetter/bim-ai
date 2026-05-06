import { describe, expect, it } from 'vitest';
import {
  meshFromSweep,
  sketchLinesToPath,
  sketchLinesToShape,
  sweepBoundingBox,
} from './sweepGeometry';
import type { SketchLine, SweepGeometryNode } from './types';

function rectangleProfile(widthMm: number, heightMm: number): SketchLine[] {
  const halfW = widthMm / 2;
  const halfH = heightMm / 2;
  const tl = { xMm: -halfW, yMm: halfH };
  const tr = { xMm: halfW, yMm: halfH };
  const br = { xMm: halfW, yMm: -halfH };
  const bl = { xMm: -halfW, yMm: -halfH };
  return [
    { startMm: tl, endMm: tr },
    { startMm: tr, endMm: br },
    { startMm: br, endMm: bl },
    { startMm: bl, endMm: tl },
  ];
}

function straightPath(lengthMm: number): SketchLine[] {
  return [
    {
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: lengthMm, yMm: 0 },
    },
  ];
}

describe('sketchLinesToPath', () => {
  it('chains contiguous lines into vertex list', () => {
    const lines: SketchLine[] = [
      { startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 100, yMm: 0 } },
      { startMm: { xMm: 100, yMm: 0 }, endMm: { xMm: 100, yMm: 100 } },
    ];
    expect(sketchLinesToPath(lines)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(sketchLinesToPath([])).toEqual([]);
  });
});

describe('sketchLinesToShape', () => {
  it('builds a closed Three.Shape from a 4-vertex profile', () => {
    const shape = sketchLinesToShape(rectangleProfile(100, 200));
    const pts = shape.getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });

  it('throws on degenerate profiles', () => {
    expect(() => sketchLinesToShape([])).toThrow();
    expect(() =>
      sketchLinesToShape([{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 100, yMm: 0 } }]),
    ).toThrow();
  });
});

describe('meshFromSweep — straight path', () => {
  it('produces non-empty geometry for a 100×200 profile along a 1000mm path', () => {
    const node: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: straightPath(1000),
      profile: rectangleProfile(100, 200),
      profilePlane: 'normal_to_path_start',
    };
    const geom = meshFromSweep(node);
    const positions = geom.getAttribute('position');
    expect(positions).toBeTruthy();
    expect(positions.count).toBeGreaterThan(0);
    geom.dispose();
  });

  it('bounding box for a window-handle-style cylinder approximation', () => {
    // 4-vertex pseudo-circle profile (square stand-in) of side 20mm,
    // swept along a 200mm path.
    const node: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: straightPath(200),
      profile: rectangleProfile(20, 20),
      profilePlane: 'normal_to_path_start',
    };
    const bb = sweepBoundingBox(node);
    // Sweep is along +X (path is (0,0)→(200,0)), with the profile
    // perpendicular (in Y/Z), so bbox spans 0..200 in X.
    expect(bb.min.x).toBeCloseTo(0, 1);
    expect(bb.max.x).toBeCloseTo(200, 1);
    // Profile extents map to the perpendicular plane → ~±10 in Y and Z.
    expect(bb.min.y).toBeLessThanOrEqual(-9);
    expect(bb.max.y).toBeGreaterThanOrEqual(9);
  });

  it('rotates the extrusion to follow the path direction', () => {
    // Path goes from (100, 50) to (100, 250) — pure +Y direction.
    const node: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: [{ startMm: { xMm: 100, yMm: 50 }, endMm: { xMm: 100, yMm: 250 } }],
      profile: rectangleProfile(40, 40),
      profilePlane: 'normal_to_path_start',
    };
    const bb = sweepBoundingBox(node);
    expect(bb.min.y).toBeCloseTo(50, 1);
    expect(bb.max.y).toBeCloseTo(250, 1);
    // Width spans ~80mm centred on path → ~60..140 in X.
    expect(bb.min.x).toBeLessThanOrEqual(85);
    expect(bb.max.x).toBeGreaterThanOrEqual(115);
  });
});

describe('meshFromSweep — work-plane mode', () => {
  it('extrudes along path with profile in work plane', () => {
    const node: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: straightPath(500),
      profile: rectangleProfile(80, 80),
      profilePlane: 'work_plane',
    };
    const geom = meshFromSweep(node);
    expect(geom.getAttribute('position').count).toBeGreaterThan(0);
    geom.dispose();
  });
});

describe('meshFromSweep — error paths', () => {
  it('throws on path with single vertex', () => {
    expect(() =>
      meshFromSweep({
        kind: 'sweep',
        pathLines: [],
        profile: rectangleProfile(10, 10),
        profilePlane: 'normal_to_path_start',
      }),
    ).toThrow();
  });

  it('throws on zero-length path', () => {
    expect(() =>
      meshFromSweep({
        kind: 'sweep',
        pathLines: [{ startMm: { xMm: 100, yMm: 100 }, endMm: { xMm: 100, yMm: 100 } }],
        profile: rectangleProfile(10, 10),
        profilePlane: 'normal_to_path_start',
      }),
    ).toThrow();
  });
});

describe('meshFromSweep — multi-segment path', () => {
  it('produces non-empty geometry along an L-shaped path', () => {
    const node: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: [
        { startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 500, yMm: 0 } },
        { startMm: { xMm: 500, yMm: 0 }, endMm: { xMm: 500, yMm: 500 } },
      ],
      profile: rectangleProfile(40, 40),
      profilePlane: 'normal_to_path_start',
    };
    const geom = meshFromSweep(node);
    expect(geom.getAttribute('position').count).toBeGreaterThan(0);
    geom.dispose();
  });
});
