import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CsgRequest, CsgResponse } from './csgWorker';
import type { Element } from '@bim-ai/core';
import { buildDoorGeometry } from '../families/geometryFns/doorGeometry';
import { buildWindowGeometry } from '../families/geometryFns/windowGeometry';
import { getFamilyById, getTypeById } from '../families/familyCatalog';
import type { ViewportPaintBundle } from './materials';
import { categoryColorOr, addEdges, readToken } from './sceneHelpers';
import { roofHeightAtPoint } from './roofHeightSampler';

export type WallElem = Extract<Element, { kind: 'wall' }>;

// CSG wall-opening cuts: enabled by default; set VITE_ENABLE_CSG=false to disable.
export const CSG_ENABLED = import.meta.env.VITE_ENABLE_CSG !== 'false';

/** Footprints use world XZ with z ← plan yMm */

export function xzBoundsMm(poly: Array<{ xMm: number; yMm: number }>): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
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

  const spanX = Math.max(maxX - minX, 1);

  const spanZ = Math.max(maxZ - minZ, 1);

  return {
    minX,

    maxX,

    minZ,

    maxZ,

    cx: (minX + maxX) / 2,

    cz: (minZ + maxZ) / 2,

    spanX,

    spanZ,
  };
}

export function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lvl = elementsById[levelId];
  if (!lvl || lvl.kind !== 'level') return 0;
  return lvl.elevationMm / 1000;
}

export function hostedXZ(
  hosted: Extract<Element, { kind: 'door' } | { kind: 'window' }>,
  wall: WallElem,
): { px: number; pz: number } {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const dx = wall.end.xMm / 1000 - sx;
  const dz = wall.end.yMm / 1000 - sz;
  const len = Math.max(1e-6, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  return {
    px: sx + ux * hosted.alongT * len,
    pz: sz + uz * hosted.alongT * len,
  };
}

export function wallYaw(wall: WallElem) {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  return Math.atan2(ez - sz, ex - sx);
}

export function makeFloorSlabMesh(
  floor: Extract<Element, { kind: 'floor' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const elev = elevationMForLevel(floor.levelId, elementsById);
  const th = THREE.MathUtils.clamp(floor.thicknessMm / 1000, 0.05, 1.8);
  const boundary = floor.boundaryMm ?? [];

  // Build shape in shape-XY (plan X→shape X, plan Y negated→shape Y).
  // After ExtrudeGeometry + rotateX(-π/2): shape X→world X, extrude depth→world Y, −shapeY→world Z.
  const shape = new THREE.Shape(
    boundary.length >= 3
      ? boundary.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000))
      : [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(6, 0),
          new THREE.Vector2(6, -6),
          new THREE.Vector2(0, -6),
        ],
  );

  // Punch holes for any slab openings hosted by this floor.
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'slab_opening' || el.hostFloorId !== floor.id) continue;
    const hPts = el.boundaryMm ?? [];
    if (hPts.length < 3) continue;
    shape.holes.push(
      new THREE.Path(hPts.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000))),
    );
  }

  const geom = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: categoryColorOr(paint, 'floor'),
      roughness: paint?.categories.floor.roughness ?? 0.9,
      transparent: true,
      opacity: 0.92,
    }),
  );
  mesh.position.set(0, elev, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.bimPickId = floor.id;
  addEdges(mesh, 20);
  return mesh;
}

// ─── Roof geometry helpers ────────────────────────────────────────────────────

export type XYPt = { xMm: number; yMm: number };

/**
 * Offset each edge of a convex (or mildly concave) polygon outward by `dist` mm.
 * Shifts each edge line outward and intersects adjacent offset lines to get corners.
 */
export function offsetPolygonMm(pts: XYPt[], dist: number): XYPt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();

  // Signed area: positive = CCW in standard (right-hand) plan coordinates.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n];
    area2 += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  const sign = area2 > 0 ? 1 : -1; // +1 CCW, −1 CW

  const result: XYPt[] = [];
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n];
    const B = pts[i];
    const C = pts[(i + 1) % n];

    // Outward unit normal of edge A→B: right-perpendicular for CCW.
    const dx1 = B.xMm - A.xMm,
      dy1 = B.yMm - A.yMm;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const nx1 = (sign * dy1) / len1,
      ny1 = (-sign * dx1) / len1;

    // Outward unit normal of edge B→C.
    const dx2 = C.xMm - B.xMm,
      dy2 = C.yMm - B.yMm;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const nx2 = (sign * dy2) / len2,
      ny2 = (-sign * dx2) / len2;

    // Offset origin of each edge line.
    const ox1 = A.xMm + nx1 * dist,
      oy1 = A.yMm + ny1 * dist;
    const ox2 = B.xMm + nx2 * dist,
      oy2 = B.yMm + ny2 * dist;
    const ux1 = dx1 / len1,
      uy1 = dy1 / len1;
    const ux2 = dx2 / len2,
      uy2 = dy2 / len2;

    // Intersect the two offset lines.
    const det = ux1 * uy2 - uy1 * ux2;
    if (Math.abs(det) < 1e-9) {
      result.push({ xMm: ox2, yMm: oy2 });
    } else {
      const t = ((ox2 - ox1) * uy2 - (oy2 - oy1) * ux2) / det;
      result.push({ xMm: ox1 + t * ux1, yMm: oy1 + t * uy1 });
    }
  }
  return result;
}

function _polygonAreaMm2(pts: XYPt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Math.abs(s) / 2;
}

function _convexHullAreaMm2(pts: XYPt[]): number {
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
function _compactnessRatio(pts: XYPt[]): number {
  const hullArea = _convexHullAreaMm2(pts);
  if (hullArea < 1) return 1;
  return _polygonAreaMm2(pts) / hullArea;
}

function _buildGableGeometry(
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

function _buildHipGeometry(
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
 * Split an L-shaped footprint into two overlapping rectangles, build a gable
 * geometry for each, and merge them. Adds a triangular valley face at the
 * internal junction.
 */
function _buildLShapeGeometry(
  rawPts: XYPt[],
  ovMm: number,
  eaveY: number,
  slopeRad: number,
): THREE.BufferGeometry {
  const b = xzBoundsMm(rawPts);
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

// ─── makeRoofMassMesh ────────────────────────────────────────────────────────

export function makeRoofMassMesh(
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const rawPts = roof.footprintMm ?? [];

  const ovMm = THREE.MathUtils.clamp(roof.overhangMm ?? 0, 0, 5000);

  // Offset footprint outward in plan space, then derive AABB for simple cases.
  const offsetPts = ovMm > 0 && rawPts.length >= 3 ? offsetPolygonMm(rawPts, ovMm) : rawPts;
  const b = xzBoundsMm(offsetPts.length >= 3 ? offsetPts : rawPts);

  const refElev = elevationMForLevel(roof.referenceLevelId, elementsById);
  // Eave plate = top of the tallest wall at the reference level.
  const wallsAtRefLevel = Object.values(elementsById).filter(
    (e): e is WallElem => e.kind === 'wall' && (e as WallElem).levelId === roof.referenceLevelId,
  );
  const wallTopM =
    wallsAtRefLevel.length > 0
      ? Math.max(...wallsAtRefLevel.map((w) => (w.heightMm ?? 0) / 1000))
      : 0;
  const eaveY = refElev + wallTopM;

  const ox0 = b.minX / 1000;
  const ox1 = b.maxX / 1000;
  const oz0 = b.minZ / 1000;
  const oz1 = b.maxZ / 1000;

  let geom: THREE.BufferGeometry;
  if (roof.roofGeometryMode === 'flat') {
    const slabThick = 0.15;
    geom = new THREE.BoxGeometry(ox1 - ox0, slabThick, oz1 - oz0);
    geom.translate((ox0 + ox1) / 2, eaveY + slabThick / 2, (oz0 + oz1) / 2);
  } else {
    const slopeRad = (THREE.MathUtils.clamp(Number(roof.slopeDeg ?? 25), 5, 70) * Math.PI) / 180;
    const spanXm = b.spanX / 1000;
    const spanZm = b.spanZ / 1000;

    // Ridge axis: explicit field takes priority; else use longer plan axis.
    let ridgeAlongX: boolean;
    if (roof.ridgeAxis === 'x') ridgeAlongX = true;
    else if (roof.ridgeAxis === 'z') ridgeAlongX = false;
    else ridgeAlongX = spanXm >= spanZm;

    // L-shape detection: polygon area / convex hull area < 0.85
    const isLShape = rawPts.length >= 6 && _compactnessRatio(rawPts) < 0.85;

    if (isLShape) {
      geom = _buildLShapeGeometry(rawPts, ovMm, eaveY, slopeRad);
    } else if (roof.roofGeometryMode === 'hip') {
      geom = _buildHipGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
    } else {
      geom = _buildGableGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
    }
  }

  const roofColor =
    roof.roofGeometryMode === 'flat'
      ? (roof.materialKey ?? '#d8d8d4')
      : categoryColorOr(paint, 'roof');

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: roofColor,
      transparent: true,
      opacity: 0.94,
      roughness: paint?.categories.roof.roughness ?? 0.74,
      metalness: paint?.categories.roof.metalness ?? 0.0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.userData.bimPickId = roof.id;
  addEdges(mesh);
  return mesh;
}

export function makeStairVolumeMesh(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();

  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const runLen = Math.max(1e-3, Math.hypot(dx, dz));
  const stairWidth = THREE.MathUtils.clamp(stair.widthMm / 1000, 0.3, 4);

  const baseLevelElev = elevationMForLevel(stair.baseLevelId, elementsById);
  const topLevelElev = elevationMForLevel(stair.topLevelId, elementsById);
  const totalRise = Math.max(Math.abs(topLevelElev - baseLevelElev), 0.1);

  const riserCount = Math.max(
    Math.round((totalRise * 1000) / (stair.riserMm > 0 ? stair.riserMm : 175)),
    2,
  );
  const riserH = totalRise / riserCount;
  const treadDepth = runLen / riserCount;
  const treadThick = 0.04;
  const angle = Math.atan2(dz, dx);

  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'stair'),
    roughness: paint?.categories.stair.roughness ?? 0.85,
  });

  const treadGeom = new THREE.BoxGeometry(treadDepth, treadThick, stairWidth);
  for (let i = 0; i < riserCount; i++) {
    const treadMesh = new THREE.Mesh(treadGeom, mat);
    const cx = sx + ((i + 0.5) / riserCount) * dx;
    const cz = sz + ((i + 0.5) / riserCount) * dz;
    // top surface of tread i sits at baseLevelElev + (i+1)*riserH
    const cy = baseLevelElev + (i + 1) * riserH - treadThick / 2;
    treadMesh.position.set(cx, cy, cz);
    treadMesh.rotation.y = angle;
    treadMesh.castShadow = true;
    treadMesh.receiveShadow = true;
    treadMesh.userData.bimPickId = stair.id;
    addEdges(treadMesh);
    group.add(treadMesh);
  }

  // Side stringer plates offset laterally by ±stairWidth/2 along local Z
  // Local Z world direction for rotation.y = angle: (sin angle, 0, cos angle) = (dz/runLen, 0, dx/runLen)
  const stringerGeom = new THREE.BoxGeometry(runLen, totalRise, 0.025);
  const midCx = (sx + ex) / 2;
  const midCz = (sz + ez) / 2;
  const midCy = baseLevelElev + totalRise / 2;
  const perpX = dz / runLen;
  const perpZ = dx / runLen;

  for (const side of [-1, 1] as const) {
    const stringer = new THREE.Mesh(stringerGeom, mat);
    stringer.position.set(
      midCx + perpX * side * (stairWidth / 2),
      midCy,
      midCz + perpZ * side * (stairWidth / 2),
    );
    stringer.rotation.y = angle;
    stringer.castShadow = true;
    stringer.receiveShadow = true;
    stringer.userData.bimPickId = stair.id;
    addEdges(stringer);
    group.add(stringer);
  }

  group.userData.bimPickId = stair.id;
  return group;
}

export function addCladdingBoards(
  mesh: THREE.Mesh,
  wallLenM: number,
  wallHeightM: number,
  wallThickM: number,
  boardWidthMm = 120,
  gapMm = 10,
  colorOverride?: string,
): void {
  const pitchM = (boardWidthMm + gapMm) / 1000;
  const count = Math.max(1, Math.floor(wallLenM / pitchM));
  const boardProtrude = 0.012; // 12 mm proud of wall face
  const boardH = wallHeightM - 0.05;
  const boardD = pitchM - 0.002; // slight gap between boards
  const color = colorOverride ?? readToken('--cat-timber-cladding', '#8B6340');
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0 });

  for (let i = 0; i < count; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(boardD, boardH, boardProtrude), mat);
    board.position.set((i + 0.5) * pitchM - wallLenM / 2, 0, wallThickM / 2 + boardProtrude / 2);
    addEdges(board);
    mesh.add(board);
  }
}

export function makeSlopedWallMesh(
  wall: WallElem,
  roof: Extract<Element, { kind: 'roof' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById: Record<string, Element>,
): THREE.Mesh {
  const sx = wall.start.xMm;
  const sz = wall.start.yMm;
  const ex = wall.end.xMm;
  const ez = wall.end.yMm;

  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(1, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;

  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const halfT = thick / 2;

  const hStart = roofHeightAtPoint(roof, elementsById, sx, sz);
  const hEnd = roofHeightAtPoint(roof, elementsById, ex, ez);

  const yBase = elevM;

  const sxF = sx / 1000 + nx * halfT;
  const szF = sz / 1000 + nz * halfT;
  const exF = ex / 1000 + nx * halfT;
  const ezF = ez / 1000 + nz * halfT;
  const sxB = sx / 1000 - nx * halfT;
  const szB = sz / 1000 - nz * halfT;
  const exB = ex / 1000 - nx * halfT;
  const ezB = ez / 1000 - nz * halfT;

  const positions = new Float32Array([
    sxF,
    yBase,
    szF, // 0 start-front-base
    exF,
    yBase,
    ezF, // 1 end-front-base
    exF,
    hEnd,
    ezF, // 2 end-front-top
    sxF,
    hStart,
    szF, // 3 start-front-top
    sxB,
    yBase,
    szB, // 4 start-back-base
    exB,
    yBase,
    ezB, // 5 end-back-base
    exB,
    hEnd,
    ezB, // 6 end-back-top
    sxB,
    hStart,
    szB, // 7 start-back-top
  ]);

  const indices = new Uint16Array([
    0,
    1,
    2,
    0,
    2,
    3, // front face
    5,
    4,
    7,
    5,
    7,
    6, // back face
    4,
    0,
    3,
    4,
    3,
    7, // left cap (start)
    1,
    5,
    6,
    1,
    6,
    2, // right cap (end)
    4,
    5,
    1,
    4,
    1,
    0, // bottom
    3,
    2,
    6,
    3,
    6,
    7, // top (sloped)
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.85,
    metalness: paint?.categories.wall.metalness ?? 0.0,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  return mesh;
}

export function makeWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Mesh {
  if (wall.roofAttachmentId && elementsById) {
    const roof = elementsById[wall.roofAttachmentId];
    if (roof?.kind === 'roof') {
      return makeSlopedWallMesh(
        wall,
        roof as Extract<Element, { kind: 'roof' }>,
        elevM,
        paint,
        elementsById,
      );
    }
  }
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const wallBaseColor =
    wall.materialKey === 'white_cladding' || wall.materialKey === 'white_render'
      ? '#f4f4f0'
      : categoryColorOr(paint, 'wall');
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, height, thick),
    new THREE.MeshStandardMaterial({
      color: wallBaseColor,
      roughness: paint?.categories.wall.roughness ?? 0.85,
      metalness: paint?.categories.wall.metalness ?? 0.0,
    }),
  );
  mesh.position.set(sx + dx / 2, elevM + height / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dz, dx);
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  if (wall.materialKey === 'timber_cladding') addCladdingBoards(mesh, len, height, thick);
  else if (wall.materialKey === 'white_cladding')
    addCladdingBoards(mesh, len, height, thick, 120, 10, '#f4f4f0');

  // Slab edge strip: thin horizontal band at the base of every elevated wall,
  // expressing the floor plate at the level transition (e.g. 1st→2nd floor).
  if (elevM > 0.01) {
    const edgeH = 0.12; // 120 mm deep band
    const edgeP = 0.03; // 30 mm projection proud of wall face
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#c8c8c4', roughness: 0.6 });
    const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(len, edgeH, thick + edgeP * 2), edgeMat);
    edgeMesh.position.set(0, -height / 2 + edgeH / 2, 0);
    addEdges(edgeMesh);
    mesh.add(edgeMesh);
  }

  return mesh;
}

export function makeCurtainWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Group {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const yaw = Math.atan2(dz, dx);

  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88ccee,
    transparent: true,
    opacity: 0.32,
    roughness: 0.05,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(len, height), glassMat);
  glassMesh.position.set(sx + dx / 2, elevM + height / 2, sz + dz / 2);
  glassMesh.rotation.y = yaw;
  group.add(glassMesh);

  const mullionMat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0.0,
  });

  const PANEL_W = 1.5;
  const PANEL_H = 1.2;
  const MW = 0.06;

  // Vertical mullions at bay divisions
  const vCount = Math.max(1, Math.round(len / PANEL_W));
  for (let i = 0; i <= vCount; i++) {
    const t = i / vCount;
    const vm = new THREE.Mesh(new THREE.BoxGeometry(MW, height, thick), mullionMat);
    vm.position.set(sx + t * dx, elevM + height / 2, sz + t * dz);
    vm.rotation.y = yaw;
    addEdges(vm);
    group.add(vm);
  }

  // Horizontal mullions at floor divisions
  const hCount = Math.max(1, Math.round(height / PANEL_H));
  for (let i = 0; i <= hCount; i++) {
    const y = elevM + i * (height / hCount);
    const hm = new THREE.Mesh(new THREE.BoxGeometry(len, MW, thick), mullionMat);
    hm.position.set(sx + dx / 2, y, sz + dz / 2);
    hm.rotation.y = yaw;
    addEdges(hm);
    group.add(hm);
  }

  // Gable triangle glazing: when the wall has a roofAttachmentId pointing at a
  // gable/hip roof, extend the glass + mullions up into the triangular zone above
  // the rectangular wall top (eave to ridge).
  if (wall.roofAttachmentId && elementsById) {
    const roofEl = elementsById[wall.roofAttachmentId];
    if (roofEl?.kind === 'roof' && roofEl.roofGeometryMode !== 'flat') {
      const roof = roofEl as Extract<Element, { kind: 'roof' }>;
      const eaveYw = elevM + height;

      // Sample N+1 heights along the wall at fine resolution
      const N = Math.max(8, Math.round(len / (PANEL_W / 4)));
      const hSamples: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const xMm = wall.start.xMm + t * (wall.end.xMm - wall.start.xMm);
        const zMm = wall.start.yMm + t * (wall.end.yMm - wall.start.yMm);
        hSamples.push(roofHeightAtPoint(roof, elementsById, xMm, zMm));
      }

      const maxH = Math.max(...hSamples);
      if (maxH > eaveYw + 0.02) {
        // Build glass mesh for the gable triangle zone as quads between sample columns
        const triPositions: number[] = [];
        const triIndices: number[] = [];
        let vIdx = 0;
        for (let i = 0; i < N; i++) {
          const t0 = i / N;
          const t1 = (i + 1) / N;
          const x0w = sx + t0 * dx,
            z0w = sz + t0 * dz;
          const x1w = sx + t1 * dx,
            z1w = sz + t1 * dz;
          const h0 = Math.max(hSamples[i], eaveYw);
          const h1 = Math.max(hSamples[i + 1], eaveYw);
          if (h0 <= eaveYw + 0.001 && h1 <= eaveYw + 0.001) continue;
          // Quad: BL, BR, TR, TL
          triPositions.push(x0w, eaveYw, z0w, x1w, eaveYw, z1w, x1w, h1, z1w, x0w, h0, z0w);
          triIndices.push(vIdx, vIdx + 1, vIdx + 2, vIdx, vIdx + 2, vIdx + 3);
          vIdx += 4;
        }
        if (triPositions.length > 0) {
          const triGeom = new THREE.BufferGeometry();
          triGeom.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(triPositions), 3),
          );
          triGeom.setIndex(triIndices);
          triGeom.computeVertexNormals();
          group.add(new THREE.Mesh(triGeom, glassMat));
        }

        // Vertical mullions in the gable triangle zone
        const vCountTri = Math.max(1, Math.round(len / PANEL_W));
        for (let i = 0; i <= vCountTri; i++) {
          const t = i / vCountTri;
          const xMm = wall.start.xMm + t * (wall.end.xMm - wall.start.xMm);
          const zMm = wall.start.yMm + t * (wall.end.yMm - wall.start.yMm);
          const topY = roofHeightAtPoint(roof, elementsById, xMm, zMm);
          if (topY <= eaveYw + 0.02) continue;
          const mullionH = topY - eaveYw;
          const mxw = sx + t * dx;
          const mzw = sz + t * dz;
          const vm = new THREE.Mesh(new THREE.BoxGeometry(MW, mullionH, thick), mullionMat);
          vm.position.set(mxw, eaveYw + mullionH / 2, mzw);
          vm.rotation.y = yaw;
          addEdges(vm);
          group.add(vm);
        }
      }
    }
  }

  return group;
}

export function makeDoorMesh(
  door: Extract<Element, { kind: 'door' }>,
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const typeEntry = door.familyTypeId ? getTypeById(door.familyTypeId) : undefined;
  const familyDef = typeEntry ? getFamilyById(typeEntry.familyId) : undefined;
  const group = buildDoorGeometry({ door, wall, elevM, paint, familyDef });
  const { px, pz } = hostedXZ(door, wall);
  group.position.set(px, elevM, pz);
  group.rotation.y = wallYaw(wall);
  return group;
}

export function makeWindowMesh(
  win: Extract<Element, { kind: 'window' }>,
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const typeEntry = win.familyTypeId ? getTypeById(win.familyTypeId) : undefined;
  const familyDef = typeEntry ? getFamilyById(typeEntry.familyId) : undefined;
  const group = buildWindowGeometry({ win, wall, elevM, paint, familyDef });
  const { px, pz } = hostedXZ(win, wall);
  const rawSill = Number(win.sillHeightMm);
  const sillM = Math.max(0.06, Math.min(rawSill / 1000, (wall.heightMm - 80) / 1000));
  const rawH = Number(win.heightMm);
  const outerH = Math.max(0.05, Math.min(rawH / 1000, (wall.heightMm - rawSill - 60) / 1000));
  group.position.set(px, elevM + sillM + outerH / 2, pz);
  group.rotation.y = wallYaw(wall);
  return group;
}

export function makeRoomRibbon(
  room: Extract<Element, { kind: 'room' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
) {
  const pts = room.outlineMm.map(
    (p) => new THREE.Vector3(p.xMm / 1000, elevM + 0.035, p.yMm / 1000),
  );
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const loop = new THREE.LineLoop(
    geom,
    new THREE.LineBasicMaterial({ color: paint?.selection.selectedColor ?? '#60a5fa' }),
  );
  loop.userData.bimPickId = room.id;
  return loop;
}

export function makeRailingMesh(
  railing: Extract<Element, { kind: 'railing' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = railing.id;

  const guardH = THREE.MathUtils.clamp((railing.guardHeightMm ?? 1050) / 1000, 0.5, 2.2);
  const pts = railing.pathMm ?? [];
  if (pts.length < 2) return group;

  const stair = railing.hostedStairId ? elementsById[railing.hostedStairId] : null;
  const baseElev =
    stair?.kind === 'stair' ? elevationMForLevel(stair.baseLevelId, elementsById) : 0;
  const topElev =
    stair?.kind === 'stair' ? elevationMForLevel(stair.topLevelId, elementsById) : baseElev;

  let totalPlanLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalPlanLen += Math.hypot(
      (pts[i]!.xMm - pts[i - 1]!.xMm) / 1000,
      (pts[i]!.yMm - pts[i - 1]!.yMm) / 1000,
    );
  }

  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'railing'),
    roughness: 0.35,
    metalness: 0.65,
  });

  // Pre-compute cumulative parametric t at each vertex for slope interpolation
  const vertexT: number[] = [0];
  let cumForT = 0;
  for (let i = 1; i < pts.length; i++) {
    cumForT += Math.hypot(
      (pts[i]!.xMm - pts[i - 1]!.xMm) / 1000,
      (pts[i]!.yMm - pts[i - 1]!.yMm) / 1000,
    );
    vertexT.push(totalPlanLen > 0 ? cumForT / totalPlanLen : 1);
  }

  // Square posts at each path vertex
  const postSect = 0.05;
  const postGeom = new THREE.BoxGeometry(postSect, guardH, postSect);
  for (let i = 0; i < pts.length; i++) {
    const t = vertexT[i]!;
    const floorY = baseElev + t * (topElev - baseElev);
    const post = new THREE.Mesh(postGeom, mat);
    post.position.set(pts[i]!.xMm / 1000, floorY + guardH / 2, pts[i]!.yMm / 1000);
    post.castShadow = post.receiveShadow = true;
    post.userData.bimPickId = railing.id;
    addEdges(post);
    group.add(post);
  }

  // Rail cap segments + balusters between posts
  const capSect = 0.045;
  const balW = 0.012;
  const balSpacing = 0.115;
  const balGeom = new THREE.BoxGeometry(balW, guardH, balW);

  let cumLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ax = a.xMm / 1000,
      az = a.yMm / 1000;
    const bx = b.xMm / 1000,
      bz = b.yMm / 1000;
    const planSeg = Math.max(0.001, Math.hypot(bx - ax, bz - az));
    const tA = totalPlanLen > 0 ? cumLen / totalPlanLen : 0;
    cumLen += planSeg;
    const tB = totalPlanLen > 0 ? cumLen / totalPlanLen : 1;
    const floorA = baseElev + tA * (topElev - baseElev);
    const floorB = baseElev + tB * (topElev - baseElev);
    const elevA = floorA + guardH;
    const elevB = floorB + guardH;
    const riseY = elevB - elevA;

    // Rail cap segment
    const railLen = Math.sqrt(planSeg * planSeg + riseY * riseY);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, capSect, capSect), mat);
    rail.position.set((ax + bx) / 2, (elevA + elevB) / 2, (az + bz) / 2);
    const dir = new THREE.Vector3(bx - ax, riseY, bz - az).normalize();
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    rail.castShadow = rail.receiveShadow = true;
    rail.userData.bimPickId = railing.id;
    addEdges(rail);
    group.add(rail);

    // Evenly spaced balusters between the two posts
    const balCount = Math.max(0, Math.floor(planSeg / balSpacing));
    for (let j = 0; j < balCount; j++) {
      const tLocal = (j + 0.5) / balCount;
      const bxj = ax + tLocal * (bx - ax);
      const bzj = az + tLocal * (bz - az);
      const floorYj = floorA + tLocal * (floorB - floorA);
      const bal = new THREE.Mesh(balGeom, mat);
      bal.position.set(bxj, floorYj + guardH / 2, bzj);
      bal.castShadow = bal.receiveShadow = true;
      bal.userData.bimPickId = railing.id;
      addEdges(bal);
      group.add(bal);
    }
  }

  return group;
}

export function makeSiteMesh(
  site: Extract<Element, { kind: 'site' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const elev = elevationMForLevel(site.referenceLevelId, elementsById);
  const baseOffset = (site.baseOffsetMm ?? 0) / 1000;
  const padTh = THREE.MathUtils.clamp((site.padThicknessMm ?? 150) / 1000, 0.05, 2);
  const boundary = site.boundaryMm ?? [];

  const shape = new THREE.Shape(
    boundary.length >= 3
      ? boundary.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000))
      : [
          new THREE.Vector2(-20, -20),
          new THREE.Vector2(20, -20),
          new THREE.Vector2(20, 20),
          new THREE.Vector2(-20, 20),
        ],
  );

  const geom = new THREE.ExtrudeGeometry(shape, { depth: padTh, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: categoryColorOr(paint, 'site'),
      roughness: paint?.categories.site.roughness ?? 0.95,
      metalness: paint?.categories.site.metalness ?? 0.0,
      aoMapIntensity: 0,
      transparent: true,
      opacity: 0.85,
    }),
  );
  mesh.position.set(0, elev + baseOffset - padTh, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.bimPickId = site.id;
  addEdges(mesh);
  return mesh;
}

export function makeBalconyMesh(
  balcony: Extract<Element, { kind: 'balcony' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = balcony.id;

  const wall = elementsById[balcony.wallId];
  if (wall?.kind !== 'wall') return group;

  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  // Outward normal: right of walking direction (start→end).
  // For south wall drawn west→east (+X): right = -Z (south). ✓
  const nx = uz;
  const nz = -ux;
  const yaw = Math.atan2(dz, dx);

  const elevM = balcony.elevationMm / 1000;
  const projM = THREE.MathUtils.clamp((balcony.projectionMm ?? 650) / 1000, 0.1, 3);
  const slabH = THREE.MathUtils.clamp((balcony.slabThicknessMm ?? 150) / 1000, 0.05, 0.5);
  const balH = THREE.MathUtils.clamp((balcony.balustradeHeightMm ?? 1050) / 1000, 0, 2);

  // Slab: projects outward from wall centerline; top face at elevM.
  const slabCy = elevM - slabH / 2;
  const slabCx = sx + dx / 2 + (nx * projM) / 2;
  const slabCz = sz + dz / 2 + (nz * projM) / 2;
  const slabMat = new THREE.MeshStandardMaterial({ color: '#c8c8c4', roughness: 0.6 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, slabH, projM), slabMat);
  slab.position.set(slabCx, slabCy, slabCz);
  slab.rotation.y = yaw;
  addEdges(slab);
  group.add(slab);

  // Glass balustrade: frameless glass panel at outer edge, standing on slab top.
  if (balH > 0.01) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const balThick = 0.018;
    const outerCx = sx + dx / 2 + nx * projM;
    const outerCz = sz + dz / 2 + nz * projM;
    const balGlass = new THREE.Mesh(new THREE.BoxGeometry(len, balH, balThick), glassMat);
    balGlass.position.set(outerCx, elevM + balH / 2, outerCz);
    balGlass.rotation.y = yaw;
    addEdges(balGlass);
    group.add(balGlass);
  }

  void paint; // unused but kept for API consistency
  return group;
}
