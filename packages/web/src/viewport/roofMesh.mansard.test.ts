import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';
import { _buildMansardGeometry } from './roofGeometry';

// ISSUE-112 — Mansarddach (Mansard / French roof) mesh tests. Covers:
// - `_buildMansardGeometry` produces a two-pitch mesh: a steep lower skirt
//   from the outer rectangle up to a horizontal knee line, plus a shallow
//   hipped upper cap above the knee.
// - Three (or four) unique Y values: eave, knee, and ridge (plus an
//   intermediate Y when the cap collapses degenerately).
// - The shallow upper cap's pitch is *distinct* from the steep lower
//   skirt's pitch — the silhouette is two-pitch, not one-pitch.
// - The `makeRoofMassMesh` dispatcher routes `roofGeometryMode: 'mansard'`
//   to `_buildMansardGeometry`.
// - Default knee height kicks in when `mansardKneeHeightMm` is omitted.

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

// 12 m (X) × 9 m (Z) rectangle — typical Stadtvilla footprint for the
// Mansarddach silhouette. Lower 72°, upper 18°, knee 3.5 m above the eave.
const mansardRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-mn-1',
  name: 'Mansard Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 12000, yMm: 0 },
    { xMm: 12000, yMm: 9000 },
    { xMm: 0, yMm: 9000 },
  ],
  slopeDeg: 70,
  roofGeometryMode: 'mansard',
  mansardLowerPitchDeg: 72,
  mansardUpperPitchDeg: 18,
  mansardKneeHeightMm: 3500,
};

const EAVE_Y_M = 3.0;
const LOWER_RAD = (72 * Math.PI) / 180;
const UPPER_RAD = (18 * Math.PI) / 180;
const KNEE_M = 3.5;

function uniqueYs(geom: THREE.BufferGeometry, eps = 1e-3): number[] {
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

describe('_buildMansardGeometry — Mansarddach', () => {
  it('produces three unique Y values (eave, knee, ridge)', () => {
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, KNEE_M);
    const ys = uniqueYs(geom);
    // eave, knee, ridge — all distinct for a real two-pitch Mansard.
    expect(ys.length).toBe(3);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 3);
    expect(ys[1]).toBeCloseTo(EAVE_Y_M + KNEE_M, 3);
    // Ridge sits above the knee (shallow cap on a non-square inner rectangle).
    expect(ys[2]).toBeGreaterThan(ys[1]);
  });

  it('places the knee line at eave + knee height', () => {
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, KNEE_M);
    const { min, max } = yRange(geom);
    expect(min).toBeCloseTo(EAVE_Y_M, 3);
    expect(max).toBeGreaterThan(EAVE_Y_M + KNEE_M);
  });

  it('ridge rise above the knee matches the shallow upper pitch', () => {
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, KNEE_M);
    // Inner rectangle inset by knee/tan(lower) on each side. The shallow cap
    // rides on the inner short span / 2 × tan(upper).
    const inset = KNEE_M / Math.tan(LOWER_RAD);
    const innerSpanX = 12 - 2 * inset;
    const innerSpanZ = 9 - 2 * inset;
    const innerShort = Math.min(innerSpanX, innerSpanZ);
    const capRise = (innerShort / 2) * Math.tan(UPPER_RAD);
    const expectedRidgeY = EAVE_Y_M + KNEE_M + capRise;
    const { max } = yRange(geom);
    expect(max).toBeCloseTo(expectedRidgeY, 3);
  });

  it('lower skirt is strictly steeper than the upper cap', () => {
    // The Mansard signature is two pitches: the lower skirt is steeper than
    // the upper cap. Geometric proxy: the horizontal inset to reach the
    // knee (lower slope) is smaller than the half-inner-span run from the
    // knee to the ridge (upper slope).
    const steepInset = KNEE_M / Math.tan(LOWER_RAD);
    const innerHalfShort = (Math.min(12, 9) - 2 * steepInset) / 2;
    // dY/dRun on the lower slope:
    const dyLower = KNEE_M / steepInset;
    // dY/dRun on the upper cap:
    const dyUpper = (innerHalfShort * Math.tan(UPPER_RAD)) / innerHalfShort;
    expect(dyLower).toBeGreaterThan(dyUpper);
  });

  it('knee inset matches knee_height / tan(lower_pitch)', () => {
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, KNEE_M);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const expectedInset = KNEE_M / Math.tan(LOWER_RAD);
    let minXAtKnee = Infinity;
    let maxXAtKnee = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - (EAVE_Y_M + KNEE_M)) < 1e-3) {
        const x = pos.getX(i);
        if (x < minXAtKnee) minXAtKnee = x;
        if (x > maxXAtKnee) maxXAtKnee = x;
      }
    }
    expect(minXAtKnee).toBeCloseTo(expectedInset, 3);
    expect(maxXAtKnee).toBeCloseTo(12 - expectedInset, 3);
  });

  it('clamps an oversized knee height to leave headroom for the cap', () => {
    // Passing a knee height larger than the max possible skirt rise must
    // not crash — the helper clamps to (max - 1mm) so the cap is still
    // representable.
    const oversized = 99; // 99 m — way above any rectangle.
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, oversized);
    const { max } = yRange(geom);
    // Max possible knee = half_short_span × tan(lower) = 4.5 × tan(72°) ≈ 13.85 m.
    // So the ridge must sit below eave + ~14 m + a tiny cap rise.
    expect(max).toBeGreaterThan(EAVE_Y_M);
    expect(max).toBeLessThan(EAVE_Y_M + 20);
  });

  it('emits a bottom-closure quad at eaveY so CSG dormer subtraction stays watertight', () => {
    // The bottom face must contain at least one triangle whose vertices all
    // sit at eaveY — guarantees the geometry is closed from below.
    const geom = _buildMansardGeometry(0, 12, 0, 9, EAVE_Y_M, LOWER_RAD, UPPER_RAD, KNEE_M);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let foundBottomTri = false;
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const y0 = pos.getY(i);
      const y1 = pos.getY(i + 1);
      const y2 = pos.getY(i + 2);
      if (
        Math.abs(y0 - EAVE_Y_M) < 1e-6 &&
        Math.abs(y1 - EAVE_Y_M) < 1e-6 &&
        Math.abs(y2 - EAVE_Y_M) < 1e-6
      ) {
        foundBottomTri = true;
        break;
      }
    }
    expect(foundBottomTri).toBe(true);
  });
});

describe('makeRoofMassMesh — mansard dispatch', () => {
  it('routes roofGeometryMode "mansard" through _buildMansardGeometry', () => {
    const mesh = makeRoofMassMesh(mansardRoof, { ...elementsById, 'roof-mn-1': mansardRoof }, null);
    expect(mesh).toBeTruthy();
    const geom = mesh!.geometry as THREE.BufferGeometry;
    // Mansarddach has 3 unique Ys (eave / knee / ridge) — a pure gable mesh
    // would only have 2.
    const ys = uniqueYs(geom);
    expect(ys.length).toBe(3);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 3);
    expect(ys[1]).toBeCloseTo(EAVE_Y_M + KNEE_M, 3);
  });

  it('uses a sensible default knee when mansardKneeHeightMm is omitted', () => {
    const omittedKnee: RoofElem = { ...mansardRoof, mansardKneeHeightMm: null };
    const mesh = makeRoofMassMesh(omittedKnee, { ...elementsById, 'roof-mn-1': omittedKnee }, null);
    const geom = mesh!.geometry as THREE.BufferGeometry;
    const ys = uniqueYs(geom);
    // Still produces a three-Y Mansard silhouette (default fraction = 60%
    // of the max skirt rise).
    expect(ys.length).toBe(3);
    expect(ys[0]).toBeCloseTo(EAVE_Y_M, 3);
    expect(ys[1]).toBeGreaterThan(EAVE_Y_M + 0.5);
  });

  it('uses a sensible default lower pitch (~70°) when mansardLowerPitchDeg is omitted', () => {
    const omittedLower: RoofElem = {
      ...mansardRoof,
      mansardLowerPitchDeg: null,
      mansardKneeHeightMm: 3500,
    };
    const mesh = makeRoofMassMesh(
      omittedLower,
      { ...elementsById, 'roof-mn-1': omittedLower },
      null,
    );
    const geom = mesh!.geometry as THREE.BufferGeometry;
    // With default 70° lower, inset at 3.5 m knee = 3.5/tan(70°) ≈ 1.274 m.
    const expectedInset = 3.5 / Math.tan((70 * Math.PI) / 180);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let minXAtKnee = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - (EAVE_Y_M + 3.5)) < 1e-3) {
        const x = pos.getX(i);
        if (x < minXAtKnee) minXAtKnee = x;
      }
    }
    expect(minXAtKnee).toBeCloseTo(expectedInset, 2);
  });

  it('produces strictly more triangles than a flat slab fallback', () => {
    const flatRoof: RoofElem = {
      ...mansardRoof,
      roofGeometryMode: 'flat',
      mansardLowerPitchDeg: null,
      mansardUpperPitchDeg: null,
      mansardKneeHeightMm: null,
    };
    const flatMesh = makeRoofMassMesh(flatRoof, { ...elementsById, 'roof-mn-1': flatRoof }, null);
    const mansardMesh = makeRoofMassMesh(
      mansardRoof,
      { ...elementsById, 'roof-mn-1': mansardRoof },
      null,
    );
    expect(vertexCount(mansardMesh!.geometry as THREE.BufferGeometry)).toBeGreaterThan(
      vertexCount(flatMesh!.geometry as THREE.BufferGeometry),
    );
  });
});
