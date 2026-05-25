import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Element } from '@bim-ai/core';

export type XYPt = { xMm: number; yMm: number };

function _xzBoundsMm(poly: Array<{ xMm: number; yMm: number }>): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  spanX: number;
  spanZ: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    minX = Math.min(minX, p.xMm);
    maxX = Math.max(maxX, p.xMm);
    minZ = Math.min(minZ, p.yMm);
    maxZ = Math.max(maxZ, p.yMm);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    spanX: Math.max(maxX - minX, 1),
    spanZ: Math.max(maxZ - minZ, 1),
  };
}

export function _polygonAreaMm2(pts: XYPt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Math.abs(s) / 2;
}

export function _convexHullAreaMm2(pts: XYPt[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  // Gift-wrapping convex hull.
  let start = 0;
  for (let i = 1; i < n; i++) if (pts[i].xMm < pts[start].xMm) start = i;
  const hull: XYPt[] = [];
  let cur = start;
  do {
    hull.push(pts[cur]);
    let next = (cur + 1) % n;
    for (let i = 0; i < n; i++) {
      const cross =
        (pts[next].xMm - pts[cur].xMm) * (pts[i].yMm - pts[cur].yMm) -
        (pts[next].yMm - pts[cur].yMm) * (pts[i].xMm - pts[cur].xMm);
      if (cross < 0) next = i;
    }
    cur = next;
  } while (cur !== start && hull.length <= n);
  return _polygonAreaMm2(hull);
}

/** Returns polygon area / convex hull area. < 0.85 indicates an L-shaped footprint. */
export function _compactnessRatio(pts: XYPt[]): number {
  const hullArea = _convexHullAreaMm2(pts);
  if (hullArea < 1) return 1;
  return _polygonAreaMm2(pts) / hullArea;
}

export function _buildGableGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveY: number,
  slopeRad: number,
  ridgeAlongX: boolean,
): THREE.BufferGeometry {
  const halfSpan = ridgeAlongX ? (oz1 - oz0) / 2 : (ox1 - ox0) / 2;
  const ridgeY = eaveY + halfSpan * Math.tan(slopeRad);
  let positions: number[];
  if (ridgeAlongX) {
    const rz = (oz0 + oz1) / 2;
    positions = [
      // South slope
      ox0,
      eaveY,
      oz0,
      ox1,
      eaveY,
      oz0,
      ox0,
      ridgeY,
      rz,
      ox1,
      eaveY,
      oz0,
      ox1,
      ridgeY,
      rz,
      ox0,
      ridgeY,
      rz,
      // North slope
      ox0,
      ridgeY,
      rz,
      ox1,
      ridgeY,
      rz,
      ox0,
      eaveY,
      oz1,
      ox1,
      ridgeY,
      rz,
      ox1,
      eaveY,
      oz1,
      ox0,
      eaveY,
      oz1,
      // West gable
      ox0,
      eaveY,
      oz0,
      ox0,
      ridgeY,
      rz,
      ox0,
      eaveY,
      oz1,
      // East gable
      ox1,
      eaveY,
      oz0,
      ox1,
      eaveY,
      oz1,
      ox1,
      ridgeY,
      rz,
    ];
  } else {
    const rx = (ox0 + ox1) / 2;
    positions = [
      // West slope
      ox0,
      eaveY,
      oz0,
      ox0,
      eaveY,
      oz1,
      rx,
      ridgeY,
      oz0,
      ox0,
      eaveY,
      oz1,
      rx,
      ridgeY,
      oz1,
      rx,
      ridgeY,
      oz0,
      // East slope
      rx,
      ridgeY,
      oz0,
      rx,
      ridgeY,
      oz1,
      ox1,
      eaveY,
      oz0,
      rx,
      ridgeY,
      oz1,
      ox1,
      eaveY,
      oz1,
      ox1,
      eaveY,
      oz0,
      // South gable
      ox0,
      eaveY,
      oz0,
      rx,
      ridgeY,
      oz0,
      ox1,
      eaveY,
      oz0,
      // North gable
      ox0,
      eaveY,
      oz1,
      ox1,
      eaveY,
      oz1,
      rx,
      ridgeY,
      oz1,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * ISSUE-105 — Krüppelwalmdach (half-hipped roof). Hybrid of a gable and a hip:
 * the full gable triangle is built first, then the TOP fraction of each gable
 * end is trimmed and replaced by a small hip face sloping back to the ridge.
 *
 * `halfHipHeightFraction ∈ [0, 1]`:
 *   - 0 ⇒ pure gable triangle (no hip cap; identical to `_buildGableGeometry`).
 *   - 1 ⇒ full hip (ridge collapses to a point at the centerline; the gable
 *     ends are fully replaced by hip faces).
 *   - 0.33 (typical) ⇒ hip cap covers the top third of the gable end.
 *
 * Geometry preserves the eave plate and the two main slopes of the gable; the
 * gable end face becomes a trapezoid (clipped triangle) and a new hip face
 * triangle is inserted between the trapezoid's top edge and the (shortened)
 * ridge endpoint.
 */
export function _buildHalfGableGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveY: number,
  slopeRad: number,
  ridgeAlongX: boolean,
  halfHipHeightFraction: number,
): THREE.BufferGeometry {
  // Clamp into [0, 1]; NaN / null callers degrade gracefully to full gable.
  let f = halfHipHeightFraction;
  if (!Number.isFinite(f)) f = 0;
  f = Math.max(0, Math.min(1, f));

  // Full-gable fallback: identical mesh to _buildGableGeometry. Keeps the
  // misconfigured-input contract from the spec (fraction == 0 ⇒ pure gable).
  if (f <= 1e-9) {
    return _buildGableGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
  }

  const halfSpan = ridgeAlongX ? (oz1 - oz0) / 2 : (ox1 - ox0) / 2;
  const fullRise = halfSpan * Math.tan(slopeRad);
  // truncationY is the elevation at which the gable triangle is clipped.
  // At fraction = 1 we trim down to the eave (full hip); at fraction = 0 we
  // do not trim at all (handled above). For intermediate fractions, the hip
  // cap covers the top `fraction` of the gable rise.
  const truncationY = eaveY + fullRise * (1 - f);
  const ridgeY = eaveY + fullRise;
  // Across-the-ridge half-width where the truncation line crosses the slope.
  // Similar triangles: at truncationY, the slope-side X (relative to center)
  // moves inward proportionally to (1 - fraction) is the *vertical* fraction;
  // for the across direction we scale by f (the trimmed amount) because the
  // slope eats half_span × f across to reach the truncation line.
  // Concretely: y(x) = eaveY + (halfSpan - |x|) * tan(slope)
  //   → at y = truncationY = eaveY + halfSpan * (1-f) * tan(slope),
  //     halfSpan - |x| = halfSpan * (1-f), so |x| = halfSpan * f.
  // That's the lateral inset where the gable triangle is clipped.
  const lateralInset = halfSpan * f;
  // Along the ridge axis, the hip cap pulls the ridge endpoints inward by
  // the same lateral inset (so the hip face has the same slope as the eaves;
  // this matches a true Krüppelwalmdach where the hip pitch equals the
  // gable-side pitch).
  const ridgeShortenEachEnd = lateralInset;

  const positions: number[] = [];
  if (ridgeAlongX) {
    const rz = (oz0 + oz1) / 2;
    const ridgeX0 = ox0 + ridgeShortenEachEnd;
    const ridgeX1 = ox1 - ridgeShortenEachEnd;

    // South main slope — split at the ridge truncation. The slope panel is
    // now a hexagon (eave at the bottom, ridge in the middle, two hip-cap
    // notches at the top corners that fold up to the hip apex). We split it
    // into 4 triangles: 2 for the central trapezoid, 1 for each end triangle.
    // South: eaveZ = oz0, ridgeZ = rz.
    // Vertices on south slope (in world coords):
    //   sE0 = (ox0, eaveY, oz0), sE1 = (ox1, eaveY, oz0)      (eave corners)
    //   sR0 = (ridgeX0, ridgeY, rz), sR1 = (ridgeX1, ridgeY, rz) (ridge endpoints)
    //   sT0 = (ox0, truncationY, rz - halfSpan * (1-f))         (south-west truncation)
    //   sT1 = (ox1, truncationY, rz - halfSpan * (1-f))         (south-east truncation)
    // Wait — for ridgeAlongX, the slope runs across Z (south↔ridge). The
    // truncation in elevation removes the top of the gable end, which is
    // the gable-end *face* (the EW faces, NOT the slope panels). So the
    // slope panels (south + north) are TRAPEZOIDS not hexagons.
    // South slope trapezoid: eave edge sE0→sE1 (full length), ridge edge
    // sR0→sR1 (shortened by lateralInset on each end), connected by sloped
    // edges sE0→sR0 and sE1→sR1.
    const sE0: [number, number, number] = [ox0, eaveY, oz0];
    const sE1: [number, number, number] = [ox1, eaveY, oz0];
    const sR0: [number, number, number] = [ridgeX0, ridgeY, rz];
    const sR1: [number, number, number] = [ridgeX1, ridgeY, rz];
    // Two triangles for the south slope trapezoid.
    positions.push(...sE0, ...sE1, ...sR1, ...sE0, ...sR1, ...sR0);

    // North slope trapezoid (mirrors south).
    const nE0: [number, number, number] = [ox0, eaveY, oz1];
    const nE1: [number, number, number] = [ox1, eaveY, oz1];
    const nR0: [number, number, number] = [ridgeX0, ridgeY, rz];
    const nR1: [number, number, number] = [ridgeX1, ridgeY, rz];
    // Winding flipped vs south so the outward normal points +Z.
    positions.push(...nR0, ...nR1, ...nE1, ...nR0, ...nE1, ...nE0);

    // Gable end face on the west (ox0 plane): a trapezoid clipped at
    // truncationY (was a triangle for a full gable). Corners (in the
    // ox0 plane):
    //   wE0 = (ox0, eaveY, oz0)   (south eave)
    //   wE1 = (ox0, eaveY, oz1)   (north eave)
    //   wT0 = (ox0, truncationY, rz - halfSpan * (1 - f)) — south truncation
    //   wT1 = (ox0, truncationY, rz + halfSpan * (1 - f)) — north truncation
    const wE0: [number, number, number] = [ox0, eaveY, oz0];
    const wE1: [number, number, number] = [ox0, eaveY, oz1];
    const wT0: [number, number, number] = [ox0, truncationY, rz - halfSpan * (1 - f)];
    const wT1: [number, number, number] = [ox0, truncationY, rz + halfSpan * (1 - f)];
    positions.push(...wE0, ...wT0, ...wT1, ...wE0, ...wT1, ...wE1);
    // West hip cap: a triangle from wT0–wT1 up to the (shortened) west ridge
    // end (ridgeX0, ridgeY, rz). This is the new face that replaces the
    // top of the gable triangle.
    positions.push(...wT0, ...sR0, ...wT1);

    // Gable end face on the east (ox1 plane): mirror of west.
    const eE0: [number, number, number] = [ox1, eaveY, oz0];
    const eE1: [number, number, number] = [ox1, eaveY, oz1];
    const eT0: [number, number, number] = [ox1, truncationY, rz - halfSpan * (1 - f)];
    const eT1: [number, number, number] = [ox1, truncationY, rz + halfSpan * (1 - f)];
    // Winding flipped so outward normal points +X.
    positions.push(...eE0, ...eE1, ...eT1, ...eE0, ...eT1, ...eT0);
    // East hip cap.
    positions.push(...eT0, ...eT1, ...sR1);
  } else {
    // Ridge runs along Z; slopes face ±X. Mirror of the above with X↔Z swapped.
    const rx = (ox0 + ox1) / 2;
    const ridgeZ0 = oz0 + ridgeShortenEachEnd;
    const ridgeZ1 = oz1 - ridgeShortenEachEnd;

    // West slope trapezoid (eave at ox0, ridge along rx).
    const wE0: [number, number, number] = [ox0, eaveY, oz0];
    const wE1: [number, number, number] = [ox0, eaveY, oz1];
    const wR0: [number, number, number] = [rx, ridgeY, ridgeZ0];
    const wR1: [number, number, number] = [rx, ridgeY, ridgeZ1];
    positions.push(...wE0, ...wE1, ...wR1, ...wE0, ...wR1, ...wR0);

    // East slope trapezoid (eave at ox1, ridge along rx).
    const eE0: [number, number, number] = [ox1, eaveY, oz0];
    const eE1: [number, number, number] = [ox1, eaveY, oz1];
    const eR0: [number, number, number] = [rx, ridgeY, ridgeZ0];
    const eR1: [number, number, number] = [rx, ridgeY, ridgeZ1];
    positions.push(...eR0, ...eR1, ...eE1, ...eR0, ...eE1, ...eE0);

    // South gable end face (oz0 plane): trapezoid + hip-cap triangle.
    const sE0: [number, number, number] = [ox0, eaveY, oz0];
    const sE1: [number, number, number] = [ox1, eaveY, oz0];
    const sT0: [number, number, number] = [rx - halfSpan * (1 - f), truncationY, oz0];
    const sT1: [number, number, number] = [rx + halfSpan * (1 - f), truncationY, oz0];
    positions.push(...sE0, ...sT0, ...sT1, ...sE0, ...sT1, ...sE1);
    // South hip cap: from sT0–sT1 up to the (shortened) south ridge end.
    positions.push(...sT0, ...wR0, ...sT1);

    // North gable end face (oz1 plane).
    const nE0: [number, number, number] = [ox0, eaveY, oz1];
    const nE1: [number, number, number] = [ox1, eaveY, oz1];
    const nT0: [number, number, number] = [rx - halfSpan * (1 - f), truncationY, oz1];
    const nT1: [number, number, number] = [rx + halfSpan * (1 - f), truncationY, oz1];
    positions.push(...nE0, ...nE1, ...nT1, ...nE0, ...nT1, ...nT0);
    // North hip cap.
    positions.push(...nT0, ...nT1, ...wR1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * ISSUE-112 — Mansarddach (Mansard / French roof). Two-pitch silhouette:
 * a steep lower skirt that encloses the DG (Mansardgauben sit on it) plus a
 * shallow upper cap (hipped) that closes the roof at the top.
 *
 * Inputs:
 *   - `(ox0, ox1, oz0, oz1)` outer rectangle bounds in world meters.
 *   - `eaveY`               elevation of the lower skirt's bottom edge.
 *   - `lowerPitchRad`       pitch of the steep skirt (≈ 70° default).
 *   - `upperPitchRad`       pitch of the shallow cap (≈ 20° default).
 *   - `kneeHeightM`         elevation (above `eaveY`) where the skirt
 *                           transitions into the cap. Must be < the height
 *                           at which the four skirts meet at the centre
 *                           (renderer clamps to that headroom).
 *
 * Geometry:
 *   - Lower skirt: 4 quadrilateral panels (trapezoids) sloping inward from
 *     the outer rectangle at `eaveY` to an inner rectangle at
 *     `eaveY + kneeHeightM`. The inward inset on each side equals
 *     `kneeHeightM / tan(lowerPitchRad)`.
 *   - Upper cap: hipped pyramid on the inner rectangle, sloping at
 *     `upperPitchRad`. Ridge runs along the longer inner span. If the
 *     inner rectangle degenerates (zero-width along an axis) the cap
 *     collapses to a single ridge line — handled gracefully.
 *   - Bottom closure: a flat quad spanning the outer rectangle at the
 *     eave so three-bvh-csg's SUBTRACTION can cleanly carve the
 *     Mansardgauben out of the steep skirt.
 */
export function _buildMansardGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveY: number,
  lowerPitchRad: number,
  upperPitchRad: number,
  kneeHeightM: number,
): THREE.BufferGeometry {
  const spanX = Math.max(0, ox1 - ox0);
  const spanZ = Math.max(0, oz1 - oz0);
  const shortSpan = Math.min(spanX, spanZ);
  const lowerTan = Math.tan(lowerPitchRad);
  // Headroom: the steep skirts of opposite edges meet when the inset
  // reaches half the SHORT span. Leave at least 1 mm of headroom for
  // the upper cap so the geometry stays representable.
  const maxKnee = (shortSpan / 2) * lowerTan - 1e-3;
  const knee = Math.max(0.001, Math.min(maxKnee, kneeHeightM));
  // Lateral inset of the inner rectangle from each outer edge.
  const inset = lowerTan > 1e-9 ? knee / lowerTan : 0;
  const ix0 = ox0 + inset;
  const ix1 = ox1 - inset;
  const iz0 = oz0 + inset;
  const iz1 = oz1 - inset;
  const kneeY = eaveY + knee;

  // Inner rectangle spans for the upper hipped cap.
  const innerSpanX = Math.max(0, ix1 - ix0);
  const innerSpanZ = Math.max(0, iz1 - iz0);
  const ridgeAlongInnerX = innerSpanX >= innerSpanZ;
  const upperHalfSpan = (ridgeAlongInnerX ? innerSpanZ : innerSpanX) / 2;
  const capRise = upperHalfSpan * Math.tan(upperPitchRad);
  const ridgeY = kneeY + capRise;

  const positions: number[] = [];

  // ------- Lower skirt: 4 trapezoidal panels (sloping inward) -------
  // Each panel is a quad → 2 triangles. Winding chosen so outward normals
  // point away from the centre.

  // South skirt (oz = oz0): outer corners at (ox0,eaveY,oz0)–(ox1,eaveY,oz0)
  // → inner corners at (ix0,kneeY,iz0)–(ix1,kneeY,iz0).
  positions.push(
    ox0,
    eaveY,
    oz0,
    ix1,
    kneeY,
    iz0,
    ox1,
    eaveY,
    oz0,
    ox0,
    eaveY,
    oz0,
    ix0,
    kneeY,
    iz0,
    ix1,
    kneeY,
    iz0,
  );

  // North skirt (oz = oz1).
  positions.push(
    ox0,
    eaveY,
    oz1,
    ox1,
    eaveY,
    oz1,
    ix1,
    kneeY,
    iz1,
    ox0,
    eaveY,
    oz1,
    ix1,
    kneeY,
    iz1,
    ix0,
    kneeY,
    iz1,
  );

  // West skirt (ox = ox0).
  positions.push(
    ox0,
    eaveY,
    oz0,
    ox0,
    eaveY,
    oz1,
    ix0,
    kneeY,
    iz1,
    ox0,
    eaveY,
    oz0,
    ix0,
    kneeY,
    iz1,
    ix0,
    kneeY,
    iz0,
  );

  // East skirt (ox = ox1).
  positions.push(
    ox1,
    eaveY,
    oz0,
    ix1,
    kneeY,
    iz0,
    ix1,
    kneeY,
    iz1,
    ox1,
    eaveY,
    oz0,
    ix1,
    kneeY,
    iz1,
    ox1,
    eaveY,
    oz1,
  );

  // ------- Upper cap: hipped pyramid on the inner rectangle -------
  // The cap has a ridge along the longer inner span. When the inner
  // rectangle is square the ridge collapses to a point (pure pyramid).
  if (innerSpanX > 1e-6 && innerSpanZ > 1e-6) {
    if (ridgeAlongInnerX) {
      // Ridge runs along X at z = (iz0+iz1)/2, y = ridgeY.
      const ridgeShorten = upperHalfSpan; // = innerSpanZ / 2
      const rz = (iz0 + iz1) / 2;
      const ridgeX0 = ix0 + ridgeShorten;
      const ridgeX1 = ix1 - ridgeShorten;

      // South slope: trapezoid eave iz0..iz0, ridge at rz.
      positions.push(
        ix0,
        kneeY,
        iz0,
        ix1,
        kneeY,
        iz0,
        ridgeX1,
        ridgeY,
        rz,
        ix0,
        kneeY,
        iz0,
        ridgeX1,
        ridgeY,
        rz,
        ridgeX0,
        ridgeY,
        rz,
      );
      // North slope.
      positions.push(
        ridgeX0,
        ridgeY,
        rz,
        ridgeX1,
        ridgeY,
        rz,
        ix1,
        kneeY,
        iz1,
        ridgeX0,
        ridgeY,
        rz,
        ix1,
        kneeY,
        iz1,
        ix0,
        kneeY,
        iz1,
      );
      // West hip triangle.
      positions.push(ix0, kneeY, iz0, ridgeX0, ridgeY, rz, ix0, kneeY, iz1);
      // East hip triangle.
      positions.push(ix1, kneeY, iz0, ix1, kneeY, iz1, ridgeX1, ridgeY, rz);
    } else {
      // Ridge runs along Z.
      const ridgeShorten = upperHalfSpan; // = innerSpanX / 2
      const rx = (ix0 + ix1) / 2;
      const ridgeZ0 = iz0 + ridgeShorten;
      const ridgeZ1 = iz1 - ridgeShorten;

      // West slope.
      positions.push(
        ix0,
        kneeY,
        iz0,
        ix0,
        kneeY,
        iz1,
        rx,
        ridgeY,
        ridgeZ1,
        ix0,
        kneeY,
        iz0,
        rx,
        ridgeY,
        ridgeZ1,
        rx,
        ridgeY,
        ridgeZ0,
      );
      // East slope.
      positions.push(
        rx,
        ridgeY,
        ridgeZ0,
        rx,
        ridgeY,
        ridgeZ1,
        ix1,
        kneeY,
        iz1,
        rx,
        ridgeY,
        ridgeZ0,
        ix1,
        kneeY,
        iz1,
        ix1,
        kneeY,
        iz0,
      );
      // South hip triangle.
      positions.push(ix0, kneeY, iz0, rx, ridgeY, ridgeZ0, ix1, kneeY, iz0);
      // North hip triangle.
      positions.push(ix0, kneeY, iz1, ix1, kneeY, iz1, rx, ridgeY, ridgeZ1);
    }
  }

  // ------- Bottom closure (eave plane) -------
  // Two triangles spanning the outer rectangle at eaveY. Faces -Y so
  // three-bvh-csg's SUBTRACTION cleanly cuts Mansardgauben through the
  // steep skirt above without leaving a sliver.
  positions.push(ox0, eaveY, oz0, ox1, eaveY, oz1, ox1, eaveY, oz0);
  positions.push(ox0, eaveY, oz0, ox0, eaveY, oz1, ox1, eaveY, oz1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

// Asymmetric gable: ridge offset transversely from the rectangle center, with
// optional independent eave heights on each side. Ridge height is derived from
// the LEFT slope: `ridgeY = eaveLeftY + (halfSpan + offset) * tan(slopeRad)`.
// The right slope angle is implicit (steeper or shallower depending on offset
// sign and per-side eave heights).
//
// Watertightness: the geometry is closed by a 2-triangle non-planar bottom
// quad spanning the (potentially split) eave levels. Without this closure
// three-bvh-csg silently fails when the dormer cutter is subtracted.
export function _buildAsymmetricGableGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveLeftY: number,
  eaveRightY: number,
  slopeRad: number,
  ridgeAlongX: boolean,
  ridgeOffsetM: number,
): THREE.BufferGeometry {
  let positions: number[];
  if (ridgeAlongX) {
    const halfSpan = (oz1 - oz0) / 2;
    const center = (oz0 + oz1) / 2;
    const offset = Math.max(-halfSpan + 1e-6, Math.min(halfSpan - 1e-6, ridgeOffsetM));
    const rz = center + offset;
    const leftRun = halfSpan + offset;
    const ridgeY = eaveLeftY + leftRun * Math.tan(slopeRad);
    positions = [
      ox0,
      eaveLeftY,
      oz0,
      ox1,
      eaveLeftY,
      oz0,
      ox0,
      ridgeY,
      rz,
      ox1,
      eaveLeftY,
      oz0,
      ox1,
      ridgeY,
      rz,
      ox0,
      ridgeY,
      rz,
      ox0,
      ridgeY,
      rz,
      ox1,
      ridgeY,
      rz,
      ox0,
      eaveRightY,
      oz1,
      ox1,
      ridgeY,
      rz,
      ox1,
      eaveRightY,
      oz1,
      ox0,
      eaveRightY,
      oz1,
      ox0,
      eaveLeftY,
      oz0,
      ox0,
      ridgeY,
      rz,
      ox0,
      eaveRightY,
      oz1,
      ox1,
      eaveLeftY,
      oz0,
      ox1,
      eaveRightY,
      oz1,
      ox1,
      ridgeY,
      rz,
      // Bottom closure (2 triangles, faces -Y). Non-planar quad spanning the
      // possibly-split eave heights. Without this the geometry is open from
      // below and three-bvh-csg's SUBTRACTION silently no-ops.
      ox0,
      eaveLeftY,
      oz0,
      ox0,
      eaveRightY,
      oz1,
      ox1,
      eaveRightY,
      oz1,
      ox0,
      eaveLeftY,
      oz0,
      ox1,
      eaveRightY,
      oz1,
      ox1,
      eaveLeftY,
      oz0,
    ];
  } else {
    const halfSpan = (ox1 - ox0) / 2;
    const center = (ox0 + ox1) / 2;
    const offset = Math.max(-halfSpan + 1e-6, Math.min(halfSpan - 1e-6, ridgeOffsetM));
    const rx = center + offset;
    const leftRun = halfSpan + offset;
    const ridgeY = eaveLeftY + leftRun * Math.tan(slopeRad);
    positions = [
      ox0,
      eaveLeftY,
      oz0,
      ox0,
      eaveLeftY,
      oz1,
      rx,
      ridgeY,
      oz0,
      ox0,
      eaveLeftY,
      oz1,
      rx,
      ridgeY,
      oz1,
      rx,
      ridgeY,
      oz0,
      rx,
      ridgeY,
      oz0,
      rx,
      ridgeY,
      oz1,
      ox1,
      eaveRightY,
      oz0,
      rx,
      ridgeY,
      oz1,
      ox1,
      eaveRightY,
      oz1,
      ox1,
      eaveRightY,
      oz0,
      ox0,
      eaveLeftY,
      oz0,
      rx,
      ridgeY,
      oz0,
      ox1,
      eaveRightY,
      oz0,
      ox0,
      eaveLeftY,
      oz1,
      ox1,
      eaveRightY,
      oz1,
      rx,
      ridgeY,
      oz1,
      // Bottom closure (2 triangles, faces -Y). Eaves run along the Z axis at
      // x=ox0 (left) and x=ox1 (right), so the bottom quad is non-planar
      // when eaveLeftY ≠ eaveRightY.
      ox0,
      eaveLeftY,
      oz0,
      ox1,
      eaveRightY,
      oz0,
      ox1,
      eaveRightY,
      oz1,
      ox0,
      eaveLeftY,
      oz0,
      ox1,
      eaveRightY,
      oz1,
      ox0,
      eaveLeftY,
      oz1,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * ISSUE-53 — Pultdach (mono-pitch) roof: a single tilted slab spanning the
 * footprint, eave at the low edge, ridge at the high edge.
 *
 * The high edge sits on the side identified by `highEdge` ('n'|'e'|'s'|'w').
 * For `highEdge ∈ {'n','s'}` the ridge runs along world-X and the slab tilts
 * across world-Z; for `{'e','w'}` it's swapped. The full footprint span
 * perpendicular to the ridge is the slope run (NOT half-span, unlike a
 * symmetric gable).
 *
 * Returns a triangular-prism BufferGeometry (low-eave triangle + high-ridge
 * triangle + four side quads) so it's watertight for any downstream CSG.
 */
export function _buildMonoPitchGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveY: number,
  slopeRad: number,
  highEdge: 'n' | 'e' | 's' | 'w',
): THREE.BufferGeometry {
  const ridgeAlongX = highEdge === 'n' || highEdge === 's';
  const spanX = ox1 - ox0;
  const spanZ = oz1 - oz0;
  const runM = ridgeAlongX ? spanZ : spanX;
  const ridgeY = eaveY + runM * Math.tan(slopeRad);

  // Pick the (low, high) world coordinates along the across-ridge axis so the
  // high edge sits on the requested compass side.
  //   n → high at +Z (oz1), low at -Z (oz0)
  //   s → high at -Z (oz0), low at +Z (oz1)
  //   e → high at +X (ox1), low at -X (ox0)
  //   w → high at -X (ox0), low at +X (ox1)
  let lowX = ox0,
    highX = ox1,
    lowZ = oz0,
    highZ = oz1;
  if (ridgeAlongX) {
    if (highEdge === 'n') {
      lowZ = oz0;
      highZ = oz1;
    } else {
      lowZ = oz1;
      highZ = oz0;
    }
  } else {
    if (highEdge === 'e') {
      lowX = ox0;
      highX = ox1;
    } else {
      lowX = ox1;
      highX = ox0;
    }
  }

  // Four world-space corners: two at the low eave (y=eaveY), two at the high
  // ridge (y=ridgeY). Triangulated into two top-face triangles, plus four
  // side quads (low eave, high ridge, two gable triangles) that close the
  // prism so it's watertight.
  let positions: number[];
  if (ridgeAlongX) {
    // Top face spans from (any x, lowZ, eaveY) → (any x, highZ, ridgeY).
    // Vertices (CCW from above for outward +Y normals):
    //   A = (ox0, eaveY, lowZ)   B = (ox1, eaveY, lowZ)
    //   C = (ox1, ridgeY, highZ) D = (ox0, ridgeY, highZ)
    const A: [number, number, number] = [ox0, eaveY, lowZ];
    const B: [number, number, number] = [ox1, eaveY, lowZ];
    const C: [number, number, number] = [ox1, ridgeY, highZ];
    const D: [number, number, number] = [ox0, ridgeY, highZ];
    // Bottom-face corners (close the prism at y=eaveY so it's watertight).
    const A2: [number, number, number] = [ox0, eaveY, lowZ];
    const B2: [number, number, number] = [ox1, eaveY, lowZ];
    const C2: [number, number, number] = [ox1, eaveY, highZ];
    const D2: [number, number, number] = [ox0, eaveY, highZ];
    positions = [
      // Top tilted slab (A-B-C, A-C-D)
      ...A,
      ...B,
      ...C,
      ...A,
      ...C,
      ...D,
      // Low eave gable triangle (under the eave edge AB) — needed for valid
      // ridge-side face. Closes the eave-edge wall: AB + A2-B2.
      ...A2,
      ...B,
      ...A,
      ...A2,
      ...B2,
      ...B,
      // High ridge wall (between top-edge CD and bottom-edge C2-D2)
      ...D,
      ...C,
      ...C2,
      ...D,
      ...C2,
      ...D2,
      // Left gable (ox0 face): triangle A2-D2-D-A (split into 2 tris)
      ...A2,
      ...A,
      ...D,
      ...A2,
      ...D,
      ...D2,
      // Right gable (ox1 face): triangle B2-B-C-C2 (split into 2 tris)
      ...B2,
      ...C2,
      ...C,
      ...B2,
      ...C,
      ...B,
      // Bottom closure quad facing -Y (A2-D2-C2-B2 split into 2 tris)
      ...A2,
      ...D2,
      ...C2,
      ...A2,
      ...C2,
      ...B2,
    ];
  } else {
    // Ridge runs along Z; across-ridge axis is X.
    const A: [number, number, number] = [lowX, eaveY, oz0];
    const B: [number, number, number] = [lowX, eaveY, oz1];
    const C: [number, number, number] = [highX, ridgeY, oz1];
    const D: [number, number, number] = [highX, ridgeY, oz0];
    const A2: [number, number, number] = [lowX, eaveY, oz0];
    const B2: [number, number, number] = [lowX, eaveY, oz1];
    const C2: [number, number, number] = [highX, eaveY, oz1];
    const D2: [number, number, number] = [highX, eaveY, oz0];
    positions = [
      ...A,
      ...B,
      ...C,
      ...A,
      ...C,
      ...D,
      // Low eave wall
      ...A2,
      ...B,
      ...A,
      ...A2,
      ...B2,
      ...B,
      // High ridge wall
      ...D,
      ...C,
      ...C2,
      ...D,
      ...C2,
      ...D2,
      // South gable (oz0 face)
      ...A2,
      ...A,
      ...D,
      ...A2,
      ...D,
      ...D2,
      // North gable (oz1 face)
      ...B2,
      ...C2,
      ...C,
      ...B2,
      ...C,
      ...B,
      // Bottom closure
      ...A2,
      ...D2,
      ...C2,
      ...A2,
      ...C2,
      ...B2,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * ISSUE-101 — Versetztes Pultdach (offset double mono-pitch). Build a Group
 * with two tilted slabs at different elevations + one vertical clerestory
 * wall band between them.
 *
 * Inputs (all metres / radians):
 * - ox0/ox1/oz0/oz1: rectangle bounds (incl. overhang) in world XZ.
 * - frontEaveY/rearEaveY: eave plate elevations for the two slabs.
 * - frontPitchRad/rearPitchRad: independent pitches.
 * - clerestoryBandM: vertical band height between the slabs.
 * - stepFracAlongLong: 0..1 partition fraction along the LONG axis.
 * - longAlongX: when true, the long axis is world-X and the step partitions
 *   at world-X = ox0 + stepFracAlongLong * (ox1 - ox0). When false, the long
 *   axis is world-Z.
 *
 * Geometry contract: front slab's low eave sits at frontEaveY at the
 * min-corner edge of the long axis; its top edge at the step is
 * `frontEaveY + frontRun * tan(frontPitchRad)`. Rear slab's low eave sits at
 * rearEaveY at the far end of the long axis; its top edge at the step is
 * `rearEaveY + rearRun * tan(rearPitchRad)`. The clerestory band is a
 * vertical wall slab spanning the full transverse width, sitting between
 * the front slab top and the rear slab top at the step (band height is
 * clamped to at least 0).
 */
export function _buildMonoPitchOffsetGroup(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  frontEaveY: number,
  rearEaveY: number,
  frontPitchRad: number,
  rearPitchRad: number,
  clerestoryBandM: number,
  stepFracAlongLong: number,
  longAlongX: boolean,
): THREE.Group {
  const group = new THREE.Group();

  const longSpan = longAlongX ? ox1 - ox0 : oz1 - oz0;
  const stepFrac = Math.min(0.99, Math.max(0.01, stepFracAlongLong));
  const stepLong = stepFrac * longSpan; // distance from the min-corner edge
  const frontRun = stepLong;
  const rearRun = longSpan - stepLong;

  const frontTopAtStep = frontEaveY + frontRun * Math.tan(frontPitchRad);
  const rearTopAtStep = rearEaveY + rearRun * Math.tan(rearPitchRad);

  const bandH = Math.max(0, clerestoryBandM);
  const bandLowerY = frontTopAtStep;
  const bandUpperY = bandLowerY + bandH;
  // If the rear slab top sits below the band top, lift the rear slab top so
  // it meets the band top (geometric contract: rear top edge ≥ front top +
  // band height). This keeps the body watertight.
  const rearTopY = Math.max(rearTopAtStep, bandUpperY);

  // Build the two slab geometries (each a triangular prism, watertight) and
  // the clerestory band as a thin vertical slab.
  const slabThicknessHint = 0.0; // we model the slabs as zero-thickness tilted
  // top faces with full prism closure (matches mono_pitch helper convention).

  function makeSlabGeom(
    lowLow: [number, number, number],
    lowHigh: [number, number, number],
    highHigh: [number, number, number],
    highLow: [number, number, number],
    eaveY: number,
  ): THREE.BufferGeometry {
    // Triangular-prism with the top tilted from (lowLow, lowHigh) at eaveY to
    // (highHigh, highLow) at the higher Y. Bottom closure sits at eaveY.
    const A = lowLow;
    const B = lowHigh;
    const C = highHigh;
    const D = highLow;
    const A2: [number, number, number] = [A[0], eaveY, A[2]];
    const B2: [number, number, number] = [B[0], eaveY, B[2]];
    const C2: [number, number, number] = [C[0], eaveY, C[2]];
    const D2: [number, number, number] = [D[0], eaveY, D[2]];
    const positions = [
      ...A,
      ...B,
      ...C,
      ...A,
      ...C,
      ...D,
      // Eave wall (low side)
      ...A2,
      ...B,
      ...A,
      ...A2,
      ...B2,
      ...B,
      // Ridge wall (high side, at step)
      ...D,
      ...C,
      ...C2,
      ...D,
      ...C2,
      ...D2,
      // Side gable triangles (along the transverse axis)
      ...A2,
      ...A,
      ...D,
      ...A2,
      ...D,
      ...D2,
      ...B2,
      ...C2,
      ...C,
      ...B2,
      ...C,
      ...B,
      // Bottom closure quad (faces -Y)
      ...A2,
      ...D2,
      ...C2,
      ...A2,
      ...C2,
      ...B2,
    ];
    void slabThicknessHint;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }

  // Geometry layout. The "low" / "high" labels refer to the across-step axis
  // (long axis). The transverse axis is perpendicular and spans the band.
  let frontGeom: THREE.BufferGeometry;
  let rearGeom: THREE.BufferGeometry;
  let bandGeom: THREE.BufferGeometry;
  const bandThickness = Math.max(0.05, Math.min(0.4, longSpan / 200));

  if (longAlongX) {
    const stepX = ox0 + stepLong;
    // Front slab spans [ox0..stepX], low at ox0 eave, high at stepX.
    frontGeom = makeSlabGeom(
      [ox0, frontEaveY, oz0],
      [ox0, frontEaveY, oz1],
      [stepX, frontTopAtStep, oz1],
      [stepX, frontTopAtStep, oz0],
      frontEaveY,
    );
    // Rear slab spans [stepX..ox1], low at ox1 eave, high at stepX.
    rearGeom = makeSlabGeom(
      [ox1, rearEaveY, oz0],
      [ox1, rearEaveY, oz1],
      [stepX, rearTopY, oz1],
      [stepX, rearTopY, oz0],
      rearEaveY,
    );
    // Clerestory band: vertical wall slab perpendicular to long axis at
    // stepX, full transverse span, height = bandH.
    bandGeom = new THREE.BoxGeometry(bandThickness, Math.max(bandH, 1e-6), oz1 - oz0);
    bandGeom.translate(stepX, bandLowerY + Math.max(bandH, 1e-6) / 2, (oz0 + oz1) / 2);
  } else {
    const stepZ = oz0 + stepLong;
    frontGeom = makeSlabGeom(
      [ox0, frontEaveY, oz0],
      [ox1, frontEaveY, oz0],
      [ox1, frontTopAtStep, stepZ],
      [ox0, frontTopAtStep, stepZ],
      frontEaveY,
    );
    rearGeom = makeSlabGeom(
      [ox0, rearEaveY, oz1],
      [ox1, rearEaveY, oz1],
      [ox1, rearTopY, stepZ],
      [ox0, rearTopY, stepZ],
      rearEaveY,
    );
    bandGeom = new THREE.BoxGeometry(ox1 - ox0, Math.max(bandH, 1e-6), bandThickness);
    bandGeom.translate((ox0 + ox1) / 2, bandLowerY + Math.max(bandH, 1e-6) / 2, stepZ);
  }

  const mat = new THREE.MeshStandardMaterial({
    color: '#a3a3a3',
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: '#d4d4d4',
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const front = new THREE.Mesh(frontGeom, mat);
  front.userData.bimRoofSlot = 'front';
  const rear = new THREE.Mesh(rearGeom, mat);
  rear.userData.bimRoofSlot = 'rear';
  const band = new THREE.Mesh(bandGeom, bandMat);
  band.userData.bimRoofSlot = 'clerestory_band';
  group.add(front);
  group.add(rear);
  group.add(band);
  return group;
}

export function _buildHipGeometry(
  ox0: number,
  ox1: number,
  oz0: number,
  oz1: number,
  eaveY: number,
  slopeRad: number,
  ridgeAlongX: boolean,
): THREE.BufferGeometry {
  let positions: number[];
  if (ridgeAlongX) {
    const halfSpanZ = (oz1 - oz0) / 2;
    const ridgeY = eaveY + halfSpanZ * Math.tan(slopeRad);
    const midZ = (oz0 + oz1) / 2;
    const rx0 = ox0 + halfSpanZ;
    const rx1 = ox1 - halfSpanZ;

    if (rx0 >= rx1) {
      // Square or near-square → pyramid
      const px = (ox0 + ox1) / 2;
      positions = [
        ox0,
        eaveY,
        oz0,
        ox1,
        eaveY,
        oz0,
        px,
        ridgeY,
        midZ,
        ox1,
        eaveY,
        oz1,
        ox0,
        eaveY,
        oz1,
        px,
        ridgeY,
        midZ,
        ox0,
        eaveY,
        oz1,
        ox0,
        eaveY,
        oz0,
        px,
        ridgeY,
        midZ,
        ox1,
        eaveY,
        oz0,
        ox1,
        eaveY,
        oz1,
        px,
        ridgeY,
        midZ,
      ];
    } else {
      positions = [
        // South slope (trapezoid)
        ox0,
        eaveY,
        oz0,
        ox1,
        eaveY,
        oz0,
        rx1,
        ridgeY,
        midZ,
        ox0,
        eaveY,
        oz0,
        rx1,
        ridgeY,
        midZ,
        rx0,
        ridgeY,
        midZ,
        // North slope (trapezoid)
        ox1,
        eaveY,
        oz1,
        ox0,
        eaveY,
        oz1,
        rx0,
        ridgeY,
        midZ,
        ox1,
        eaveY,
        oz1,
        rx0,
        ridgeY,
        midZ,
        rx1,
        ridgeY,
        midZ,
        // West hip (triangle)
        ox0,
        eaveY,
        oz0,
        ox0,
        eaveY,
        oz1,
        rx0,
        ridgeY,
        midZ,
        // East hip (triangle)
        ox1,
        eaveY,
        oz0,
        rx1,
        ridgeY,
        midZ,
        ox1,
        eaveY,
        oz1,
      ];
    }
  } else {
    const halfSpanX = (ox1 - ox0) / 2;
    const ridgeY = eaveY + halfSpanX * Math.tan(slopeRad);
    const midX = (ox0 + ox1) / 2;
    const rz0 = oz0 + halfSpanX;
    const rz1 = oz1 - halfSpanX;

    if (rz0 >= rz1) {
      const pz = (oz0 + oz1) / 2;
      positions = [
        ox0,
        eaveY,
        oz0,
        ox1,
        eaveY,
        oz0,
        midX,
        ridgeY,
        pz,
        ox1,
        eaveY,
        oz1,
        ox0,
        eaveY,
        oz1,
        midX,
        ridgeY,
        pz,
        ox0,
        eaveY,
        oz1,
        ox0,
        eaveY,
        oz0,
        midX,
        ridgeY,
        pz,
        ox1,
        eaveY,
        oz0,
        ox1,
        eaveY,
        oz1,
        midX,
        ridgeY,
        pz,
      ];
    } else {
      positions = [
        // West slope (trapezoid)
        ox0,
        eaveY,
        oz0,
        ox0,
        eaveY,
        oz1,
        midX,
        ridgeY,
        rz1,
        ox0,
        eaveY,
        oz0,
        midX,
        ridgeY,
        rz1,
        midX,
        ridgeY,
        rz0,
        // East slope (trapezoid)
        ox1,
        eaveY,
        oz1,
        ox1,
        eaveY,
        oz0,
        midX,
        ridgeY,
        rz0,
        ox1,
        eaveY,
        oz1,
        midX,
        ridgeY,
        rz0,
        midX,
        ridgeY,
        rz1,
        // South hip (triangle)
        ox0,
        eaveY,
        oz0,
        midX,
        ridgeY,
        rz0,
        ox1,
        eaveY,
        oz0,
        // North hip (triangle)
        ox0,
        eaveY,
        oz1,
        ox1,
        eaveY,
        oz1,
        midX,
        ridgeY,
        rz1,
      ];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * KRN-03 — pavilion hip mesh for arbitrary convex polygon footprints (≥ 5 vertices).
 *
 * Each polygon edge becomes a sloped triangular face whose apex is the polygon
 * centroid lifted by `inradius * tan(slope)`. All edges share the same pitch,
 * so for regular polygons the apex is a single point; for irregular convex
 * polygons the result is a pyramidal hip with all edges sloping inward.
 */
export function _buildHipPolygonGeometry(
  pts: XYPt[],
  eaveY: number,
  slopeRad: number,
): THREE.BufferGeometry {
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.xMm;
    cz += p.yMm;
  }
  cx /= n;
  cz /= n;

  // Inradius proxy: minimum perpendicular distance from centroid to each edge.
  let minDist = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.xMm - a.xMm;
    const dz = b.yMm - a.yMm;
    const len = Math.hypot(dx, dz) || 1;
    const dist = Math.abs((cx - a.xMm) * dz - (cz - a.yMm) * dx) / len;
    if (dist < minDist) minDist = dist;
  }
  const apexY = eaveY + (minDist / 1000) * Math.tan(slopeRad);
  const apexXm = cx / 1000;
  const apexZm = cz / 1000;

  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    positions.push(
      a.xMm / 1000,
      eaveY,
      a.yMm / 1000,
      b.xMm / 1000,
      eaveY,
      b.yMm / 1000,
      apexXm,
      apexY,
      apexZm,
    );
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Split an L-shaped footprint into two overlapping rectangles, build a gable
 * geometry for each, and merge them. Adds a triangular valley face at the
 * internal junction.
 */
export function _buildLShapeGeometry(
  rawPts: XYPt[],
  ovMm: number,
  eaveY: number,
  slopeRad: number,
): THREE.BufferGeometry {
  const b = _xzBoundsMm(rawPts);
  const tol = Math.max((b.spanX + b.spanZ) * 0.02, 5); // 2% of span

  // Find which AABB corner is absent from the polygon — that tells us the
  // missing rectangle and which vertex is the reflex step.
  const aabbCorners = [
    { side: 'sw', x: b.minX, y: b.minZ },
    { side: 'se', x: b.maxX, y: b.minZ },
    { side: 'nw', x: b.minX, y: b.maxZ },
    { side: 'ne', x: b.maxX, y: b.maxZ },
  ] as const;

  let missingSide: 'sw' | 'se' | 'nw' | 'ne' = 'ne';
  for (const c of aabbCorners) {
    if (!rawPts.some((p) => Math.abs(p.xMm - c.x) < tol && Math.abs(p.yMm - c.y) < tol)) {
      missingSide = c.side;
      break;
    }
  }

  // Find the reflex vertex (the step vertex adjacent to the missing corner).
  // It shares one coordinate with each of the two AABB corners flanking the missing one.
  let rv: XYPt = rawPts[0];
  {
    let area2 = 0;
    const n = rawPts.length;
    for (let i = 0; i < n; i++) {
      const a = rawPts[i],
        c = rawPts[(i + 1) % n];
      area2 += a.xMm * c.yMm - c.xMm * a.yMm;
    }
    const wsign = area2 > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const A = rawPts[(i - 1 + n) % n];
      const B = rawPts[i];
      const C = rawPts[(i + 1) % n];
      const cross = (B.xMm - A.xMm) * (C.yMm - B.yMm) - (B.yMm - A.yMm) * (C.xMm - B.xMm);
      if (cross * wsign < 0) {
        rv = B;
        break;
      }
    }
  }

  const ovOff = ovMm > 0 ? ovMm : 0;

  // Build the two sub-rectangle AABB bounds (in mm) then convert to metres with overhang.
  let r1: { x0: number; x1: number; z0: number; z1: number };
  let r2: { x0: number; x1: number; z0: number; z1: number };

  // Strategy: the two rectangles share one full dimension and each covers the
  // "arm" of the L.  We choose the split so the rectangles overlap at the step.
  switch (missingSide) {
    case 'ne': // missing top-right → step at (rv.xMm, rv.yMm)
      r1 = { x0: b.minX, x1: b.maxX, z0: b.minZ, z1: rv.yMm }; // full-width bottom
      r2 = { x0: b.minX, x1: rv.xMm, z0: b.minZ, z1: b.maxZ }; // left-arm full height
      break;
    case 'nw': // missing top-left
      r1 = { x0: b.minX, x1: b.maxX, z0: b.minZ, z1: rv.yMm };
      r2 = { x0: rv.xMm, x1: b.maxX, z0: b.minZ, z1: b.maxZ };
      break;
    case 'se': // missing bottom-right
      r1 = { x0: b.minX, x1: b.maxX, z0: rv.yMm, z1: b.maxZ };
      r2 = { x0: b.minX, x1: rv.xMm, z0: b.minZ, z1: b.maxZ };
      break;
    case 'sw': // missing bottom-left
    default:
      r1 = { x0: b.minX, x1: b.maxX, z0: rv.yMm, z1: b.maxZ };
      r2 = { x0: rv.xMm, x1: b.maxX, z0: b.minZ, z1: b.maxZ };
      break;
  }

  function toM(r: { x0: number; x1: number; z0: number; z1: number }) {
    return {
      ox0: r.x0 / 1000 - ovOff / 1000,
      ox1: r.x1 / 1000 + ovOff / 1000,
      oz0: r.z0 / 1000 - ovOff / 1000,
      oz1: r.z1 / 1000 + ovOff / 1000,
    };
  }

  const m1 = toM(r1),
    m2 = toM(r2);
  const ax1 = m1.ox1 - m1.ox0 >= m1.oz1 - m1.oz0;
  const ax2 = m2.ox1 - m2.ox0 >= m2.oz1 - m2.oz0;

  const g1 = _buildGableGeometry(m1.ox0, m1.ox1, m1.oz0, m1.oz1, eaveY, slopeRad, ax1);
  const g2 = _buildGableGeometry(m2.ox0, m2.ox1, m2.oz0, m2.oz1, eaveY, slopeRad, ax2);

  // Valley face — triangular face connecting the inner eave corner to the two ridges.
  const rvxM = rv.xMm / 1000,
    rvzM = rv.yMm / 1000;
  const halfSpan1 = ax1 ? (m1.oz1 - m1.oz0) / 2 : (m1.ox1 - m1.ox0) / 2;
  const ridgeY1 = eaveY + halfSpan1 * Math.tan(slopeRad);
  const ridgeMid1x = ax1 ? rvxM : (m1.ox0 + m1.ox1) / 2;
  const ridgeMid1z = ax1 ? (m1.oz0 + m1.oz1) / 2 : rvzM;
  const halfSpan2 = ax2 ? (m2.oz1 - m2.oz0) / 2 : (m2.ox1 - m2.ox0) / 2;
  const ridgeY2 = eaveY + halfSpan2 * Math.tan(slopeRad);
  const ridgeMid2x = ax2 ? rvxM : (m2.ox0 + m2.ox1) / 2;
  const ridgeMid2z = ax2 ? (m2.oz0 + m2.oz1) / 2 : rvzM;

  const valleyPositions = [
    rvxM,
    eaveY,
    rvzM,
    ridgeMid1x,
    ridgeY1,
    ridgeMid1z,
    ridgeMid2x,
    ridgeY2,
    ridgeMid2z,
  ];
  const gv = new THREE.BufferGeometry();
  gv.setAttribute('position', new THREE.Float32BufferAttribute(valleyPositions, 3));
  gv.computeVertexNormals();

  const merged = mergeGeometries([g1, g2, gv]);
  if (!merged) {
    // mergeGeometries can return null if all inputs are empty.
    return g1;
  }
  return merged;
}

export function _buildAsymmetricGableGeometryWithRoofOpenings(
  roof: Extract<Element, { kind: 'roof' }>,
  roofOpenings: Array<Extract<Element, { kind: 'roof_opening' }>>,
  boundsMm: ReturnType<typeof _xzBoundsMm>,
  refElev: number,
  slopeRad: number,
  ridgeAlongX: boolean,
): THREE.BufferGeometry | null {
  if (ridgeAlongX || roofOpenings.length !== 1 || (roof.footprintMm ?? []).length !== 4) {
    return null;
  }

  const opening = roofOpenings[0];
  const rawBounds = _xzBoundsMm(roof.footprintMm ?? []);
  const xs = opening.boundaryMm.map((p) => p.xMm);
  const zs = opening.boundaryMm.map((p) => p.yMm);
  const tolMm = 2;
  const edgeAware = (v: number, rawMin: number, rawMax: number, outMin: number, outMax: number) => {
    if (Math.abs(v - rawMin) <= tolMm) return outMin;
    if (Math.abs(v - rawMax) <= tolMm) return outMax;
    return v;
  };

  const ox0 = boundsMm.minX / 1000;
  const ox1 = boundsMm.maxX / 1000;
  const oz0 = boundsMm.minZ / 1000;
  const oz1 = boundsMm.maxZ / 1000;
  const holeX0 =
    edgeAware(Math.min(...xs), rawBounds.minX, rawBounds.maxX, boundsMm.minX, boundsMm.maxX) / 1000;
  const holeX1 =
    edgeAware(Math.max(...xs), rawBounds.minX, rawBounds.maxX, boundsMm.minX, boundsMm.maxX) / 1000;
  const holeZ0 =
    edgeAware(Math.min(...zs), rawBounds.minZ, rawBounds.maxZ, boundsMm.minZ, boundsMm.maxZ) / 1000;
  const holeZ1 =
    edgeAware(Math.max(...zs), rawBounds.minZ, rawBounds.maxZ, boundsMm.minZ, boundsMm.maxZ) / 1000;

  const halfSpan = (ox1 - ox0) / 2;
  const center = (ox0 + ox1) / 2;
  const offset = THREE.MathUtils.clamp(
    (roof.ridgeOffsetTransverseMm ?? 0) / 1000,
    -halfSpan + 1e-6,
    halfSpan - 1e-6,
  );
  const rx = center + offset;
  const eaveLeftY =
    roof.eaveHeightLeftMm != null ? refElev + roof.eaveHeightLeftMm / 1000 : refElev;
  const eaveRightY =
    roof.eaveHeightRightMm != null ? refElev + roof.eaveHeightRightMm / 1000 : refElev;
  const ridgeY = eaveLeftY + (halfSpan + offset) * Math.tan(slopeRad);

  const cutIsOnEastSlope = holeX0 > rx && holeX1 >= ox1 - 1e-4;
  const cutInsideDepth = holeZ0 > oz0 && holeZ1 < oz1 && holeZ0 < holeZ1;
  if (!cutIsOnEastSlope || !cutInsideDepth) return null;

  const yAtX = (x: number) => {
    if (x <= rx) {
      const t = (x - ox0) / Math.max(rx - ox0, 1e-6);
      return THREE.MathUtils.lerp(eaveLeftY, ridgeY, t);
    }
    const t = (x - rx) / Math.max(ox1 - rx, 1e-6);
    return THREE.MathUtils.lerp(ridgeY, eaveRightY, t);
  };

  const positions: number[] = [];
  const addTopRect = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 - x0 <= 1e-5 || z1 - z0 <= 1e-5) return;
    positions.push(
      x0,
      yAtX(x0),
      z0,
      x0,
      yAtX(x0),
      z1,
      x1,
      yAtX(x1),
      z0,
      x0,
      yAtX(x0),
      z1,
      x1,
      yAtX(x1),
      z1,
      x1,
      yAtX(x1),
      z0,
    );
  };

  addTopRect(ox0, rx, oz0, oz1);
  addTopRect(rx, ox1, oz0, holeZ0);
  addTopRect(rx, holeX0, holeZ0, holeZ1);
  addTopRect(rx, ox1, holeZ1, oz1);

  // Keep the visible south/north gable end caps; the target opening is an
  // internal east-slope subtraction and does not intersect either end cap.
  positions.push(
    ox0,
    eaveLeftY,
    oz0,
    rx,
    ridgeY,
    oz0,
    ox1,
    eaveRightY,
    oz0,
    ox0,
    eaveLeftY,
    oz1,
    ox1,
    eaveRightY,
    oz1,
    rx,
    ridgeY,
    oz1,
  );

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}
