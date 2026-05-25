import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';
import { _buildGableGeometry, _buildHalfGableGeometry } from './roofGeometry';

// ISSUE-105 — Krüppelwalmdach (half-hipped) mesh tests. Covers:
// - `_buildHalfGableGeometry` produces a truncated gable triangle plus an
//   extra hip-cap face at each gable end (different vertex topology from the
//   pure gable mesh).
// - Fraction 0 falls back to behavior identical to `_buildGableGeometry`
//   (same ridge height, no hip-cap vertices) so a misconfigured value
//   degrades gracefully.
// - Fraction 1 collapses the ridge to the centerline span (functionally a
//   full hip), eating both gable triangles completely.
// - Fraction 0.5 produces a half-and-half hybrid where the truncation sits
//   at half the gable rise and the ridge is shortened by half the half-span
//   on each end.
// - The `makeRoofMassMesh` dispatcher routes `roofGeometryMode: 'half_gable'`
//   to `_buildHalfGableGeometry`.

type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Ground',
  elevationMm: 0,
};

const wall3m: WallElem = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'wall-1': wall3m,
};

// 8000 mm (X) × 5000 mm (Z) rectangle so the ridge runs along X (longer
// footprint span) and the half-span (perpendicular to the ridge) is 2.5 m.
// Slope 35° → full ridge rise = 2.5 * tan(35°) ≈ 1.751 m. Eave plate Y = 3 m.
const halfGableRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-kw-1',
  name: 'Krüppelwalm Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 5000 },
    { xMm: 0, yMm: 5000 },
  ],
  slopeDeg: 35,
  roofGeometryMode: 'half_gable',
  halfHipHeightFraction: 0.33,
};

const HALF_SPAN_M = 2.5;
const SLOPE_RAD = (35 * Math.PI) / 180;
const FULL_RISE_M = HALF_SPAN_M * Math.tan(SLOPE_RAD);
const EAVE_Y_M = 3.0;
const RIDGE_Y_M = EAVE_Y_M + FULL_RISE_M;

function countUniqueYs(geom: THREE.BufferGeometry, eps = 1e-6): number[] {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const ys: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (!ys.some((yy) => Math.abs(yy - y) < eps)) ys.push(y);
  }
  return ys.sort((a, b) => a - b);
}

function yRange(geom: THREE.BufferGeometry): { min: number; max: number } {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

function vertexCount(geom: THREE.BufferGeometry): number {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  return pos.count;
}

describe('_buildHalfGableGeometry — Krüppelwalmdach', () => {
  it('preserves the full ridge height at the centerline', () => {
    // Truncation only clips the gable END faces — the ridge sits at the
    // same elevation as the parent gable mode.
    const geom = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 0.33);
    const { min, max } = yRange(geom);
    expect(min).toBeCloseTo(EAVE_Y_M, 6);
    expect(max).toBeCloseTo(RIDGE_Y_M, 6);
  });

  it('introduces a truncation Y between the eave and the ridge', () => {
    // The truncation height defines a third unique Y value (gable mode only
    // has two: eaveY and ridgeY).
    const geom = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 0.33);
    const ys = countUniqueYs(geom);
    expect(ys.length).toBe(3);
    const truncY = ys[1];
    const expectedTrunc = EAVE_Y_M + FULL_RISE_M * (1 - 0.33);
    expect(truncY).toBeCloseTo(expectedTrunc, 6);
  });

  it('adds extra triangles beyond the pure gable mesh (truncated end + hip cap)', () => {
    const gable = _buildGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true);
    const halfGable = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 0.33);
    // _buildGableGeometry emits 10 triangles (2 main slopes × 2 tris + 2
    // gable-end triangles × 1 tri ... actually 12: 4 quad-tris on slopes
    // + 2 gable triangles). The half-gable variant must include the
    // additional hip-cap triangles (one per gable end), so the vertex
    // count is strictly larger.
    expect(vertexCount(halfGable)).toBeGreaterThan(vertexCount(gable));
  });

  it('fraction = 0 falls back to the pure gable mesh (same Y range, two unique Ys)', () => {
    const geom = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 0);
    const ys = countUniqueYs(geom);
    expect(ys.length).toBe(2);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 6);
    expect(ys[1]).toBeCloseTo(RIDGE_Y_M, 6);

    // Vertex count matches the pure gable mesh (same triangulation).
    const gable = _buildGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true);
    expect(vertexCount(geom)).toBe(vertexCount(gable));
  });

  it('fraction = 1 collapses the ridge inward by the full half-span on each end (functional hip)', () => {
    const geom = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 1);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    // Find every vertex at the ridge elevation and check its X coordinate
    // sits inside [ridgeShortenEachEnd, 8 - ridgeShortenEachEnd]. For the
    // 8×5 m rectangle, half-span = 2.5 m and fraction = 1, so the ridge
    // collapses to the segment [2.5, 5.5] along X.
    const shorten = HALF_SPAN_M * 1; // = 2.5 m
    const ridgeXMin = shorten;
    const ridgeXMax = 8 - shorten;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (Math.abs(y - RIDGE_Y_M) < 1e-6) {
        const x = pos.getX(i);
        expect(x).toBeGreaterThanOrEqual(ridgeXMin - 1e-6);
        expect(x).toBeLessThanOrEqual(ridgeXMax + 1e-6);
      }
    }
  });

  it('fraction = 0.5 produces a half-and-half hybrid (truncation at half the rise)', () => {
    const geom = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 0.5);
    const ys = countUniqueYs(geom);
    expect(ys.length).toBe(3);
    const truncY = ys[1];
    expect(truncY).toBeCloseTo(EAVE_Y_M + FULL_RISE_M * 0.5, 6);

    // Ridge endpoints shrink inward by half_span * 0.5 = 1.25 m on each
    // end — so the ridge spans X ∈ [1.25, 6.75] in the 8-m-wide rectangle.
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let ridgeXmin = Infinity;
    let ridgeXmax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - RIDGE_Y_M) < 1e-6) {
        const x = pos.getX(i);
        if (x < ridgeXmin) ridgeXmin = x;
        if (x > ridgeXmax) ridgeXmax = x;
      }
    }
    expect(ridgeXmin).toBeCloseTo(1.25, 6);
    expect(ridgeXmax).toBeCloseTo(6.75, 6);
  });

  it('ridge-along-Z mirror produces the same three-Y topology', () => {
    const geom = _buildHalfGableGeometry(0, 5, 0, 8, EAVE_Y_M, SLOPE_RAD, false, 0.33);
    const ys = countUniqueYs(geom);
    expect(ys.length).toBe(3);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 6);
    expect(ys[2]).toBeCloseTo(RIDGE_Y_M, 6);
  });

  it('clamps fractions > 1 down to 1 (graceful degrade, no crash)', () => {
    // Should produce the same mesh as fraction = 1 (full hip).
    const a = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 5);
    const b = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, 1);
    expect(vertexCount(a)).toBe(vertexCount(b));
  });

  it('clamps fractions < 0 up to 0 (graceful degrade to pure gable)', () => {
    const a = _buildHalfGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true, -0.5);
    const gable = _buildGableGeometry(0, 8, 0, 5, EAVE_Y_M, SLOPE_RAD, true);
    expect(vertexCount(a)).toBe(vertexCount(gable));
  });
});

describe('makeRoofMassMesh — half_gable dispatch', () => {
  it('routes roofGeometryMode "half_gable" through _buildHalfGableGeometry', () => {
    const mesh = makeRoofMassMesh(
      halfGableRoof,
      { ...elementsById, 'roof-kw-1': halfGableRoof },
      null,
    );
    expect(mesh).toBeTruthy();
    const geom = mesh!.geometry as THREE.BufferGeometry;
    const ys = countUniqueYs(geom);
    // Half-gable has 3 unique Ys (eave / truncation / ridge); a pure gable
    // mesh would only have 2.
    expect(ys.length).toBe(3);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 4);
    expect(ys[2]).toBeCloseTo(RIDGE_Y_M, 4);
  });

  it('falls back to the pure gable mesh when halfHipHeightFraction is 0', () => {
    const flatToZeroFraction: RoofElem = { ...halfGableRoof, halfHipHeightFraction: 0 };
    const mesh = makeRoofMassMesh(
      flatToZeroFraction,
      { ...elementsById, 'roof-kw-1': flatToZeroFraction },
      null,
    );
    const geom = mesh!.geometry as THREE.BufferGeometry;
    const ys = countUniqueYs(geom);
    expect(ys.length).toBe(2);
  });

  it('uses a sensible default fraction when halfHipHeightFraction is omitted', () => {
    const omittedFraction: RoofElem = {
      ...halfGableRoof,
      halfHipHeightFraction: undefined,
    };
    const mesh = makeRoofMassMesh(
      omittedFraction,
      { ...elementsById, 'roof-kw-1': omittedFraction },
      null,
    );
    const geom = mesh!.geometry as THREE.BufferGeometry;
    const ys = countUniqueYs(geom);
    // Default fraction is 0.33 → still produces a half-gable (3 unique Ys).
    expect(ys.length).toBe(3);
  });
});
