import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import type { Element } from '@bim-ai/core';

import {
  OrbitViewpointPersistedHud,
  type OrbitViewpointPersistFieldPayload,
} from './OrbitViewpointPersistedHud';

import { useBimStore } from './state/store';
import { useTheme } from './state/useTheme';
import {
  CameraRig,
  classifyHotkey,
  classifyPointer,
  createCameraRig,
  wheelDelta,
} from './viewport/cameraRig';
import {
  liveTokenReader,
  resolveViewportPaintBundle,
  type ElementCategoryToken,
  type ViewportPaintBundle,
} from './viewport/materials';
import { ViewCube } from './viewport/ViewCube';
import { type ViewCubePick } from './viewport/viewCubeAlignment';
import { SectionBox } from './viewport/sectionBox';
import { WalkController, classifyKey as classifyWalkKey } from './viewport/walkMode';

const CATEGORY_FALLBACK_COLOR_HEX = '#cbd5e1';

function categoryColorOr(bundle: ViewportPaintBundle | null, cat: ElementCategoryToken): string {
  return bundle?.categories[cat]?.color ?? CATEGORY_FALLBACK_COLOR_HEX;
}

function readToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

/** Resolve a CSS color token to an rgb() string that Three.js can parse.
 * CSS Color Level 4 hsl() uses spaces (e.g. "hsl(0 0% 100%)") which
 * Three.js does not support — routing through a DOM element forces the
 * browser to resolve it to "rgb(r, g, b)". */
function readColorToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  try {
    const el = document.createElement('div');
    el.style.display = 'none';
    el.style.color = `var(${name}, ${fallback})`;
    document.body.appendChild(el);
    const resolved = getComputedStyle(el).color;
    document.body.removeChild(el);
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

function sunPositionFromAzEl(azimuthDeg: number, elevationDeg: number, radiusM = 80): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    radiusM * Math.cos(el) * Math.sin(az),
    radiusM * Math.sin(el),
    radiusM * Math.cos(el) * Math.cos(az),
  );
}

type Props = {
  wsConnected: boolean;
  onPersistViewpointField?: (payload: OrbitViewpointPersistFieldPayload) => void | Promise<void>;
};

function addEdges(
  mesh: THREE.Mesh,
  thresholdAngleDeg = 15,
): THREE.LineSegments {
  const color = readToken('--color-foreground', '#1a1a1a');
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngleDeg);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
  const lines = new THREE.LineSegments(edges, mat);
  lines.renderOrder = 1;
  lines.castShadow = false;
  lines.receiveShadow = false;
  mesh.add(lines);
  return lines;
}

type WallElem = Extract<Element, { kind: 'wall' }>;

/** Footprints use world XZ with z ← plan yMm */

function xzBoundsMm(poly: Array<{ xMm: number; yMm: number }>): {
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

function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lvl = elementsById[levelId];
  if (!lvl || lvl.kind !== 'level') return 0;
  return lvl.elevationMm / 1000;
}

function hostedXZ(
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

function wallYaw(wall: WallElem) {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  return Math.atan2(ez - sz, ex - sx);
}

function makeFloorSlabMesh(
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

type XYPt = { xMm: number; yMm: number };

/**
 * Offset each edge of a convex (or mildly concave) polygon outward by `dist` mm.
 * Shifts each edge line outward and intersects adjacent offset lines to get corners.
 */
function offsetPolygonMm(pts: XYPt[], dist: number): XYPt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();

  // Signed area: positive = CCW in standard (right-hand) plan coordinates.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area2 += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  const sign = area2 > 0 ? 1 : -1; // +1 CCW, −1 CW

  const result: XYPt[] = [];
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n];
    const B = pts[i];
    const C = pts[(i + 1) % n];

    // Outward unit normal of edge A→B: right-perpendicular for CCW.
    const dx1 = B.xMm - A.xMm, dy1 = B.yMm - A.yMm;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const nx1 = (sign * dy1) / len1, ny1 = (-sign * dx1) / len1;

    // Outward unit normal of edge B→C.
    const dx2 = C.xMm - B.xMm, dy2 = C.yMm - B.yMm;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const nx2 = (sign * dy2) / len2, ny2 = (-sign * dx2) / len2;

    // Offset origin of each edge line.
    const ox1 = A.xMm + nx1 * dist, oy1 = A.yMm + ny1 * dist;
    const ox2 = B.xMm + nx2 * dist, oy2 = B.yMm + ny2 * dist;
    const ux1 = dx1 / len1, uy1 = dy1 / len1;
    const ux2 = dx2 / len2, uy2 = dy2 / len2;

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
    const a = pts[i], b = pts[(i + 1) % pts.length];
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
  ox0: number, ox1: number, oz0: number, oz1: number,
  eaveY: number, slopeRad: number, ridgeAlongX: boolean,
): THREE.BufferGeometry {
  const halfSpan = ridgeAlongX ? (oz1 - oz0) / 2 : (ox1 - ox0) / 2;
  const ridgeY = eaveY + halfSpan * Math.tan(slopeRad);
  let positions: number[];
  if (ridgeAlongX) {
    const rz = (oz0 + oz1) / 2;
    positions = [
      // South slope
      ox0, eaveY, oz0,  ox1, eaveY, oz0,  ox0, ridgeY, rz,
      ox1, eaveY, oz0,  ox1, ridgeY, rz,  ox0, ridgeY, rz,
      // North slope
      ox0, ridgeY, rz,  ox1, ridgeY, rz,  ox0, eaveY, oz1,
      ox1, ridgeY, rz,  ox1, eaveY, oz1,  ox0, eaveY, oz1,
      // West gable
      ox0, eaveY, oz0,  ox0, ridgeY, rz,  ox0, eaveY, oz1,
      // East gable
      ox1, eaveY, oz0,  ox1, eaveY, oz1,  ox1, ridgeY, rz,
    ];
  } else {
    const rx = (ox0 + ox1) / 2;
    positions = [
      // West slope
      ox0, eaveY, oz0,  ox0, eaveY, oz1,  rx, ridgeY, oz0,
      ox0, eaveY, oz1,  rx, ridgeY, oz1,  rx, ridgeY, oz0,
      // East slope
      rx, ridgeY, oz0,  rx, ridgeY, oz1,  ox1, eaveY, oz0,
      rx, ridgeY, oz1,  ox1, eaveY, oz1,  ox1, eaveY, oz0,
      // South gable
      ox0, eaveY, oz0,  rx, ridgeY, oz0,  ox1, eaveY, oz0,
      // North gable
      ox0, eaveY, oz1,  ox1, eaveY, oz1,  rx, ridgeY, oz1,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function _buildHipGeometry(
  ox0: number, ox1: number, oz0: number, oz1: number,
  eaveY: number, slopeRad: number, ridgeAlongX: boolean,
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
        ox0, eaveY, oz0,  ox1, eaveY, oz0,  px, ridgeY, midZ,
        ox1, eaveY, oz1,  ox0, eaveY, oz1,  px, ridgeY, midZ,
        ox0, eaveY, oz1,  ox0, eaveY, oz0,  px, ridgeY, midZ,
        ox1, eaveY, oz0,  ox1, eaveY, oz1,  px, ridgeY, midZ,
      ];
    } else {
      positions = [
        // South slope (trapezoid)
        ox0, eaveY, oz0,  ox1, eaveY, oz0,  rx1, ridgeY, midZ,
        ox0, eaveY, oz0,  rx1, ridgeY, midZ,  rx0, ridgeY, midZ,
        // North slope (trapezoid)
        ox1, eaveY, oz1,  ox0, eaveY, oz1,  rx0, ridgeY, midZ,
        ox1, eaveY, oz1,  rx0, ridgeY, midZ,  rx1, ridgeY, midZ,
        // West hip (triangle)
        ox0, eaveY, oz0,  ox0, eaveY, oz1,  rx0, ridgeY, midZ,
        // East hip (triangle)
        ox1, eaveY, oz0,  rx1, ridgeY, midZ,  ox1, eaveY, oz1,
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
        ox0, eaveY, oz0,  ox1, eaveY, oz0,  midX, ridgeY, pz,
        ox1, eaveY, oz1,  ox0, eaveY, oz1,  midX, ridgeY, pz,
        ox0, eaveY, oz1,  ox0, eaveY, oz0,  midX, ridgeY, pz,
        ox1, eaveY, oz0,  ox1, eaveY, oz1,  midX, ridgeY, pz,
      ];
    } else {
      positions = [
        // West slope (trapezoid)
        ox0, eaveY, oz0,  ox0, eaveY, oz1,  midX, ridgeY, rz1,
        ox0, eaveY, oz0,  midX, ridgeY, rz1,  midX, ridgeY, rz0,
        // East slope (trapezoid)
        ox1, eaveY, oz1,  ox1, eaveY, oz0,  midX, ridgeY, rz0,
        ox1, eaveY, oz1,  midX, ridgeY, rz0,  midX, ridgeY, rz1,
        // South hip (triangle)
        ox0, eaveY, oz0,  midX, ridgeY, rz0,  ox1, eaveY, oz0,
        // North hip (triangle)
        ox0, eaveY, oz1,  ox1, eaveY, oz1,  midX, ridgeY, rz1,
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
      const a = rawPts[i], c = rawPts[(i + 1) % n];
      area2 += a.xMm * c.yMm - c.xMm * a.yMm;
    }
    const wsign = area2 > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const A = rawPts[(i - 1 + n) % n];
      const B = rawPts[i];
      const C = rawPts[(i + 1) % n];
      const cross = (B.xMm - A.xMm) * (C.yMm - B.yMm) - (B.yMm - A.yMm) * (C.xMm - B.xMm);
      if (cross * wsign < 0) { rv = B; break; }
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

  const m1 = toM(r1), m2 = toM(r2);
  const ax1 = (m1.ox1 - m1.ox0) >= (m1.oz1 - m1.oz0);
  const ax2 = (m2.ox1 - m2.ox0) >= (m2.oz1 - m2.oz0);

  const g1 = _buildGableGeometry(m1.ox0, m1.ox1, m1.oz0, m1.oz1, eaveY, slopeRad, ax1);
  const g2 = _buildGableGeometry(m2.ox0, m2.ox1, m2.oz0, m2.oz1, eaveY, slopeRad, ax2);

  // Valley face — triangular face connecting the inner eave corner to the two ridges.
  const rvxM = rv.xMm / 1000, rvzM = rv.yMm / 1000;
  const halfSpan1 = ax1 ? (m1.oz1 - m1.oz0) / 2 : (m1.ox1 - m1.ox0) / 2;
  const ridgeY1 = eaveY + halfSpan1 * Math.tan(slopeRad);
  const ridgeMid1x = ax1 ? rvxM : (m1.ox0 + m1.ox1) / 2;
  const ridgeMid1z = ax1 ? (m1.oz0 + m1.oz1) / 2 : rvzM;
  const halfSpan2 = ax2 ? (m2.oz1 - m2.oz0) / 2 : (m2.ox1 - m2.ox0) / 2;
  const ridgeY2 = eaveY + halfSpan2 * Math.tan(slopeRad);
  const ridgeMid2x = ax2 ? rvxM : (m2.ox0 + m2.ox1) / 2;
  const ridgeMid2z = ax2 ? (m2.oz0 + m2.oz1) / 2 : rvzM;

  const valleyPositions = [
    rvxM, eaveY, rvzM,
    ridgeMid1x, ridgeY1, ridgeMid1z,
    ridgeMid2x, ridgeY2, ridgeMid2z,
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

function makeRoofMassMesh(
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

  const slopeRad = (THREE.MathUtils.clamp(Number(roof.slopeDeg ?? 25), 5, 70) * Math.PI) / 180;
  const spanXm = b.spanX / 1000;
  const spanZm = b.spanZ / 1000;

  // Ridge axis: explicit field takes priority; else use longer plan axis.
  let ridgeAlongX: boolean;
  if (roof.ridgeAxis === 'x') ridgeAlongX = true;
  else if (roof.ridgeAxis === 'z') ridgeAlongX = false;
  else ridgeAlongX = spanXm >= spanZm;

  const ox0 = b.minX / 1000;
  const ox1 = b.maxX / 1000;
  const oz0 = b.minZ / 1000;
  const oz1 = b.maxZ / 1000;

  // L-shape detection: polygon area / convex hull area < 0.85
  const isLShape = rawPts.length >= 6 && _compactnessRatio(rawPts) < 0.85;

  let geom: THREE.BufferGeometry;
  if (isLShape) {
    geom = _buildLShapeGeometry(rawPts, ovMm, eaveY, slopeRad);
  } else if (roof.roofGeometryMode === 'hip') {
    geom = _buildHipGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
  } else {
    geom = _buildGableGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
  }

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: categoryColorOr(paint, 'roof'),
      transparent: true,
      opacity: 0.94,
      roughness: paint?.categories.roof.roughness ?? 0.74,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  mesh.userData.bimPickId = roof.id;
  addEdges(mesh);
  return mesh;
}

function makeStairVolumeMesh(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
  selectedId?: string,
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
  const treadThick = 0.040;
  const angle = Math.atan2(dz, dx);

  const stairColor =
    stair.id === selectedId
      ? (paint?.selection.selectedColor ?? '#fcd34d')
      : categoryColorOr(paint, 'stair');
  const mat = new THREE.MeshStandardMaterial({ color: stairColor });

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

function makeWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  selectedId?: string,
): THREE.Mesh {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, height, thick),
    new THREE.MeshStandardMaterial({
      color:
        wall.id === selectedId
          ? (paint?.selection.selectedColor ?? '#fb923c')
          : categoryColorOr(paint, 'wall'),
      roughness: paint?.categories.wall.roughness ?? 0.85,
    }),
  );
  mesh.position.set(sx + dx / 2, elevM + height / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dz, dx);
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  return mesh;
}

function makeDoorMesh(
  door: Extract<Element, { kind: 'door' }>,
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  sid?: string,
) {
  const { px, pz } = hostedXZ(door, wall);
  const leafWidth  = THREE.MathUtils.clamp(door.widthMm / 1000, 0.35, 4);
  const leafHeight = THREE.MathUtils.clamp((wall.heightMm / 1000) * 0.86, 0.6, 2.5);
  const panelThick = 0.045;
  const depth      = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.08, 0.5);
  const frameSect  = 0.07;

  const doorColor = door.id === sid
    ? (paint?.selection.selectedColor ?? '#fde047')
    : categoryColorOr(paint, 'door');

  const frameMat = new THREE.MeshStandardMaterial({ color: doorColor });
  const panelMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.75 });

  function member(w: number, h: number, d: number, x: number, y: number, mat: THREE.MeshStandardMaterial): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    addEdges(m);
    return m;
  }

  const frameGroup = new THREE.Group();
  // head spans full opening width including jambs
  frameGroup.add(member(leafWidth + 2 * frameSect, frameSect, depth, 0, leafHeight + frameSect / 2, frameMat));
  // jamb-L
  frameGroup.add(member(frameSect, leafHeight, depth, -(leafWidth / 2 + frameSect / 2), leafHeight / 2, frameMat));
  // jamb-R
  frameGroup.add(member(frameSect, leafHeight, depth,  (leafWidth / 2 + frameSect / 2), leafHeight / 2, frameMat));

  // panel leaf
  const panelMesh = member(leafWidth, leafHeight, panelThick, 0, leafHeight / 2, panelMat);

  // threshold sits at floor level (centre of 0.02 m height = 0.01 m above elevM)
  const threshMesh = member(leafWidth, 0.02, depth, 0, 0.01, frameMat);

  const group = new THREE.Group();
  group.add(frameGroup, panelMesh, threshMesh);
  group.position.set(px, elevM, pz);
  group.rotation.y = wallYaw(wall);
  group.userData.bimPickId = door.id;
  return group;
}

function makeWindowMesh(
  win: Extract<Element, { kind: 'window' }>,
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  sid?: string,
) {
  const { px, pz } = hostedXZ(win, wall);
  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.06, wall.heightMm / 1000 - 0.08);
  const outerW = THREE.MathUtils.clamp(win.widthMm / 1000, 0.14, 4);
  const outerH = THREE.MathUtils.clamp(
    win.heightMm / 1000,
    0.05,
    wall.heightMm / 1000 - sill - 0.06,
  );
  const frameSect = 0.06;
  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.02, 0.06, 0.5);
  const glazingW = Math.max(outerW - 2 * frameSect, 0.01);
  const glazingH = Math.max(outerH - 2 * frameSect, 0.01);

  const frameColor =
    win.id === sid
      ? (paint?.selection.selectedColor ?? '#ddd6fe')
      : categoryColorOr(paint, 'window');
  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor });

  const group = new THREE.Group();
  group.userData.bimPickId = win.id;

  const frameGroup = new THREE.Group();

  const head = new THREE.Mesh(new THREE.BoxGeometry(outerW, frameSect, depth), frameMat);
  head.position.set(0, outerH / 2 - frameSect / 2, 0);
  head.castShadow = head.receiveShadow = true;
  head.userData.bimPickId = win.id;
  addEdges(head);
  frameGroup.add(head);

  const sillMesh = new THREE.Mesh(new THREE.BoxGeometry(outerW, frameSect, depth), frameMat);
  sillMesh.position.set(0, -(outerH / 2 - frameSect / 2), 0);
  sillMesh.castShadow = sillMesh.receiveShadow = true;
  sillMesh.userData.bimPickId = win.id;
  addEdges(sillMesh);
  frameGroup.add(sillMesh);

  const jambL = new THREE.Mesh(new THREE.BoxGeometry(frameSect, outerH, depth), frameMat);
  jambL.position.set(-(outerW / 2 - frameSect / 2), 0, 0);
  jambL.castShadow = jambL.receiveShadow = true;
  jambL.userData.bimPickId = win.id;
  addEdges(jambL);
  frameGroup.add(jambL);

  const jambR = new THREE.Mesh(new THREE.BoxGeometry(frameSect, outerH, depth), frameMat);
  jambR.position.set(outerW / 2 - frameSect / 2, 0, 0);
  jambR.castShadow = jambR.receiveShadow = true;
  jambR.userData.bimPickId = win.id;
  addEdges(jambR);
  frameGroup.add(jambR);

  group.add(frameGroup);

  const glazingMat = new THREE.MeshStandardMaterial({
    color: readToken('--cat-glazing', '#c8d8ea'),
    roughness: 0.05,
    metalness: 0.0,
    opacity: 0.35,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const glazing = new THREE.Mesh(new THREE.BoxGeometry(glazingW, glazingH, 0.006), glazingMat);
  glazing.castShadow = false;
  glazing.userData.bimPickId = win.id;
  group.add(glazing);

  if (outerW > 1.2) {
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(frameSect, glazingH, 0.012),
      frameMat,
    );
    mullion.castShadow = mullion.receiveShadow = true;
    mullion.userData.bimPickId = win.id;
    addEdges(mullion);
    group.add(mullion);
  }

  group.position.set(px, elevM + sill + outerH / 2, pz);
  group.rotation.y = wallYaw(wall);
  return group;
}

function makeRoomRibbon(
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

function makeRailingMesh(
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

function makeSiteMesh(
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

type ViewerCatKey = 'wall' | 'floor' | 'roof' | 'stair' | 'door' | 'window' | 'room' | 'railing' | 'site';

function elemViewerCategory(e: Element): ViewerCatKey | null {
  switch (e.kind) {
    case 'wall':
      return 'wall';
    case 'floor':
      return 'floor';
    case 'roof':
      return 'roof';
    case 'stair':
      return 'stair';
    case 'door':
      return 'door';
    case 'window':
      return 'window';
    case 'room':
      return 'room';
    case 'railing':
      return 'railing';
    case 'site':
      return 'site';
    default:
      return null;
  }
}

function computeRootBoundingBox(
  root: THREE.Object3D,
): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null {
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return null;
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

function aabbWireframeVertices(
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): THREE.Vector3[] {
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  const c000 = v(min.x, min.y, min.z);
  const c100 = v(max.x, min.y, min.z);
  const c010 = v(min.x, max.y, min.z);
  const c110 = v(max.x, max.y, min.z);
  const c001 = v(min.x, min.y, max.z);
  const c101 = v(max.x, min.y, max.z);
  const c011 = v(min.x, max.y, max.z);
  const c111 = v(max.x, max.y, max.z);
  // 12 edges as vertex pairs.
  return [
    c000,
    c100,
    c100,
    c110,
    c110,
    c010,
    c010,
    c000,
    c001,
    c101,
    c101,
    c111,
    c111,
    c011,
    c011,
    c001,
    c000,
    c001,
    c100,
    c101,
    c110,
    c111,
    c010,
    c011,
  ];
}

function applyClippingPlanesToMeshes(root: THREE.Object3D, planes: THREE.Plane[]) {
  if (!planes.length) return;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      const m = mesh.material.clone();
      m.clippingPlanes = planes.slice();
      mesh.material = m;
    }
  });
}

/** Small key+label hint chip used in the navigation HUD. */
function NavHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-border/70 bg-surface-strong px-1 py-0.5 font-mono leading-none">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function Sep() {
  return <span className="opacity-30">·</span>;
}

export function Viewport({ wsConnected, onPersistViewpointField }: Props) {
  void wsConnected;
  const { t } = useTranslation();

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Live paint bundle for the rendered scene. Rebuilt on theme change. */
  const paintBundleRef = useRef<ViewportPaintBundle | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  /** Live CameraRig instance — replaces the legacy ad-hoc spherical rig. */
  const cameraRigRef = useRef<CameraRig | null>(null);
  const hasAutoFittedRef = useRef(false);
  /** Set by the mount effect so we can snap the orbit rig to saved `viewpoint` cameras. */
  const orbitRigApiRef = useRef<{
    applyViewpointMm: (pose: {
      position: { xMm: number; yMm: number; zMm: number };
      target: { xMm: number; yMm: number; zMm: number };
      up: { xMm: number; yMm: number; zMm: number };
    }) => void;
  } | null>(null);

  const [currentAzimuth, setCurrentAzimuth] = useState(Math.PI / 4);
  const [currentElevation, setCurrentElevation] = useState(0.45);
  const [walkActive, setWalkActive] = useState(false);
  const [sectionBoxActive, setSectionBoxActive] = useState(false);
  const walkControllerRef = useRef<WalkController | null>(null);
  const sectionBoxRef = useRef<SectionBox | null>(null);
  const sectionBoxCageRef = useRef<THREE.LineSegments | null>(null);

  const elementsById = useBimStore((s) => s.elementsById);
  const theme = useTheme();

  const walkLevels = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .map((e) => e.elevationMm / 1000)
        .sort((a, b) => a - b),
    [elementsById],
  );
  const walkLevelsRef = useRef<number[]>([]);
  walkLevelsRef.current = walkLevels;

  const selectedId = useBimStore((s) => s.selectedId);

  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);

  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const orbitCameraNonce = useBimStore((s) => s.orbitCameraNonce);
  const orbitCameraPoseMm = useBimStore((s) => s.orbitCameraPoseMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);

  const persistedOrbitViewpoint = useMemo(() => {
    const id = activeViewpointId;
    if (!id) return null;
    const el = elementsById[id];
    if (!el || el.kind !== 'viewpoint' || el.mode !== 'orbit_3d') return null;
    return el;
  }, [activeViewpointId, elementsById]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const host = el;

    /** Resolve drafting + lighting tokens once at mount; theme switches will
     * trigger a rebuild via the dependency on `elementsById` etc. */
    const paint = resolveViewportPaintBundle();
    paintBundleRef.current = paint;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(readColorToken('--color-background', '#ffffff'), 1);
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    sceneRef.current = scene;
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(paint.lighting.hemi.skyColor),
      new THREE.Color(paint.lighting.hemi.groundColor),
      paint.lighting.hemi.intensity,
    );
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(
      new THREE.Color(paint.lighting.sun.color),
      paint.lighting.sun.intensity,
    );
    dir.castShadow = true;
    dir.shadow.mapSize.set(paint.lighting.sun.shadowMapSize, paint.lighting.sun.shadowMapSize);
    dir.shadow.bias = -0.001;
    dir.shadow.camera.left   = -30;
    dir.shadow.camera.right  =  30;
    dir.shadow.camera.top    =  30;
    dir.shadow.camera.bottom = -30;
    dir.shadow.camera.near   =  0.5;
    dir.shadow.camera.far    =  200;
    dir.shadow.camera.updateProjectionMatrix();
    dir.position.copy(sunPositionFromAzEl(paint.lighting.sun.azimuthDeg, paint.lighting.sun.elevationDeg));
    dir.target.position.set(0, 0, 0);
    scene.add(dir);
    scene.add(dir.target);
    sunRef.current = dir;
    scene.add(
      new THREE.GridHelper(
        160,
        32,
        readToken('--draft-grid-major', '#223042'),
        readToken('--draft-grid-minor', '#1a2738'),
      ),
    );

    const root = new THREE.Group();

    rootGroupRef.current = root;
    scene.add(root);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    camera.up.set(0, 1, 0);

    cameraRef.current = camera;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const ssao = new SSAOPass(scene, camera, host.clientWidth || 1, host.clientHeight || 1);
    ssao.kernelRadius = paint.lighting.ssao.kernelRadius;
    ssao.minDistance = paint.lighting.ssao.minDistance;
    ssao.maxDistance = paint.lighting.ssao.maxDistance;
    ssao.output = SSAOPass.OUTPUT.Default;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ssao.enabled = false;
    }
    composer.addPass(ssao);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    /** Spec §15.3 walk-mode controller — the actual key/mouse wiring is
     * a few lines below; this just creates the math state. */
    const walkController = new WalkController({}, {});
    walkControllerRef.current = walkController;

    /** Spec §15.6 section box — toggled on/off via the React state below.
     * The mount effect re-applies clipping planes on every scene rebuild. */
    const sectionBox = new SectionBox({});
    sectionBoxRef.current = sectionBox;

    /** Spec §15.3 camera rig replaces the legacy in-line spherical rig. */
    hasAutoFittedRef.current = false;
    const rig = createCameraRig({
      target: { x: 0, y: 1.35, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      azimuth: Math.PI / 4,
      elevation: 0.45,
      radius: 16,
      minRadius: 4,
      maxRadius: 80,
    });
    cameraRigRef.current = rig;
    let dragging: 'orbit' | 'pan' | null = null;
    let dragMoved = false;
    let cumulativeDragPx = 0;
    let inertiaVx = 0;
    let inertiaVy = 0;
    const INERTIA_DECAY = 0.87;
    const DRAG_THRESHOLD_PX = 5;
    let lastX = 0;
    let lastY = 0;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function placeCamera(): void {
      const snap = rig.snapshot();
      camera.position.set(snap.position.x, snap.position.y, snap.position.z);
      camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
      camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
      setCurrentAzimuth(snap.azimuth);
      setCurrentElevation(snap.elevation);
    }

    placeCamera();

    orbitRigApiRef.current = {
      applyViewpointMm: (pose) => {
        // Existing axis convention: pose.target.zMm → THREE.Y; pose.target.yMm → THREE.Z.
        rig.applyViewpoint(
          {
            x: pose.position.xMm / 1000,
            y: pose.position.zMm / 1000,
            z: pose.position.yMm / 1000,
          },
          {
            x: pose.target.xMm / 1000,
            y: pose.target.zMm / 1000,
            z: pose.target.yMm / 1000,
          },
          {
            x: pose.up.xMm / 1000,
            y: pose.up.zMm / 1000,
            z: pose.up.yMm / 1000,
          },
        );
        placeCamera();
      },
    };

    function pick(cx: number, cy: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);

      const first = hits.find((h) => typeof h.object.userData.bimPickId === 'string');
      useBimStore.getState().select(first?.object.userData.bimPickId as string | undefined);
    }

    function onResize() {
      const w = host.clientWidth || 1;

      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      ssao.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    onResize();

    function onDown(ev: PointerEvent): void {
      if (walkController.snapshot().active && !document.pointerLockElement) {
        host.requestPointerLock();
        return;
      }
      const intent = classifyPointer({
        button: ev.button,
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
      });
      if (intent === 'pan') dragging = 'pan';
      else if (intent === 'orbit') dragging = 'orbit';
      else if (ev.button === 0) dragging = 'orbit'; // LMB drag = orbit (trackpad primary)
      else dragging = null;
      dragMoved = false;
      cumulativeDragPx = 0;
      inertiaVx = 0;
      inertiaVy = 0;
      lastX = ev.clientX;
      lastY = ev.clientY;
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    }

    function onUp(ev: PointerEvent): void {
      const wasDragging = dragging;
      dragging = null;
      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      if (!dragMoved && wasDragging === 'orbit') pick(ev.clientX, ev.clientY);
    }

    function onMove(ev: PointerEvent): void {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      cumulativeDragPx += Math.hypot(dx, dy);
      if (cumulativeDragPx > DRAG_THRESHOLD_PX) dragMoved = true;
      if (!dragMoved) return;
      if (dragging === 'orbit') {
        rig.orbit(dx, dy);
        inertiaVx = dx;
        inertiaVy = dy;
      } else {
        rig.pan(dx, dy);
      }
      placeCamera();
    }

    function onWheel(ev: WheelEvent): void {
      ev.preventDefault();

      // Normalize cursor position to NDC for cursor-anchored zoom
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

      // Normalize wheel delta (handles deltaMode: pixel/line/page)
      const normY = wheelDelta({ deltaY: ev.deltaY, deltaMode: ev.deltaMode });

      const beforeSnap = rig.snapshot();

      // Multiplicative zoom: ~30 % per mouse notch, consistent at all distances.
      // Pinch (ctrlKey) already arrives half-scaled by wheelDelta; zoomBy handles the rest.
      rig.zoomBy(Math.exp(normY * 0.003));

      // Cursor-anchored zoom: keep the world point under the cursor fixed.
      // Formula: nudge = deltaR * (cursorRayDir + sphericalDir)
      // This is the exact solution for pinning the focal-plane point to the cursor.
      const afterSnap = rig.snapshot();
      const deltaR = beforeSnap.radius - afterSnap.radius;
      if (Math.abs(deltaR) > 1e-4) {
        ndc.set(ndcX, ndcY);
        raycaster.setFromCamera(ndc, camera);
        const D = raycaster.ray.direction; // cursor ray unit vector
        // Spherical unit vector: from target to camera
        const br = beforeSnap.radius;
        const Sx = (beforeSnap.position.x - beforeSnap.target.x) / br;
        const Sy = (beforeSnap.position.y - beforeSnap.target.y) / br;
        const Sz = (beforeSnap.position.z - beforeSnap.target.z) / br;
        rig.nudgeTarget({
          x: deltaR * (D.x + Sx),
          y: deltaR * (D.y + Sy),
          z: deltaR * (D.z + Sz),
        });
      }

      // Trackpad two-finger horizontal swipe → pan X
      if (!ev.ctrlKey && Math.abs(ev.deltaX) > 1) {
        const normX = wheelDelta({ deltaY: ev.deltaX, deltaMode: ev.deltaMode });
        rig.pan(normX * 0.3, 0);
      }

      placeCamera();
    }

    function onKey(ev: KeyboardEvent): void {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      const hk = classifyHotkey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey });
      if (!hk) return;
      ev.preventDefault();
      if (hk.kind === 'frame-all') {
        const box = computeRootBoundingBox(root);
        if (box) { rig.frame(box); rig.setHome(); }
      } else if (hk.kind === 'frame-selection') {
        // For now the same effect as frame-all; selection-aware framing comes
        // with the inspector parameter wiring.
        const box = computeRootBoundingBox(root);
        if (box) { rig.frame(box); rig.setHome(); }
      } else if (hk.kind === 'reset') {
        rig.reset();
      } else if (hk.kind === 'zoom-in') {
        rig.zoomBy(0.85);
      } else if (hk.kind === 'zoom-out') {
        rig.zoomBy(1.18);
      }
      placeCamera();
    }

    renderer.domElement.addEventListener('pointerdown', onDown);
    const onContextMenu = (ev: Event): void => ev.preventDefault();
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKey);

    /* ── Walk mode wiring (§15.3) ──────────────────────────────────── */
    function onWalkKeyDown(ev: KeyboardEvent): void {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      if (!walkController.snapshot().active) return;
      if (ev.key === 'Escape') {
        walkController.setActive(false);
        setWalkActive(false);
        return;
      }
      if (ev.key === 'Shift') walkController.setRunning(true);
      if (ev.key === 'PageUp') {
        walkController.jumpFloor(1);
        ev.preventDefault();
        return;
      }
      if (ev.key === 'PageDown') {
        walkController.jumpFloor(-1);
        ev.preventDefault();
        return;
      }
      const wk = classifyWalkKey(ev.key);
      if (wk) {
        walkController.setKey(wk, true);
        ev.preventDefault();
      }
    }
    function onWalkKeyUp(ev: KeyboardEvent): void {
      if (ev.key === 'Shift') walkController.setRunning(false);
      const wk = classifyWalkKey(ev.key);
      if (wk) walkController.setKey(wk, false);
    }
    function onWalkPointerMove(ev: PointerEvent): void {
      if (!walkController.snapshot().active) return;
      walkController.mouseLook(ev.movementX, ev.movementY);
    }
    document.addEventListener('keydown', onWalkKeyDown);
    document.addEventListener('keyup', onWalkKeyUp);
    document.addEventListener('pointermove', onWalkPointerMove);

    function onPointerLockChange(): void {
      if (!document.pointerLockElement && walkController.snapshot().active) {
        walkController.setActive(false);
        setWalkActive(false);
      }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange);

    let lastFrameMs = performance.now();
    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
      lastFrameMs = now;

      // Walk-mode integration drives the camera target through walkController.
      if (walkController.snapshot().active) {
        walkController.update(dt);
        const snap = walkController.snapshot();
        const dir = walkController.viewDirection();
        camera.position.set(snap.position.x, snap.position.y, snap.position.z);
        camera.up.set(0, 1, 0);
        camera.lookAt(snap.position.x + dir.x, snap.position.y + dir.y, snap.position.z + dir.z);
      }

      // Orbit inertia: continue rotating after mouse release, decaying to stop
      if (!dragging && Math.hypot(inertiaVx, inertiaVy) > 0.06) {
        rig.orbit(inertiaVx, inertiaVy);
        inertiaVx *= INERTIA_DECAY;
        inertiaVy *= INERTIA_DECAY;
        placeCamera();
      }

      composer.render();
      rafRef.current = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      orbitRigApiRef.current = null;
      cameraRigRef.current = null;
      paintBundleRef.current = null;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      ro.disconnect();

      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onWalkKeyDown);
      document.removeEventListener('keyup', onWalkKeyUp);
      document.removeEventListener('pointermove', onWalkPointerMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      walkControllerRef.current = null;
      sectionBoxRef.current = null;
      sectionBoxCageRef.current = null;

      composerRef.current?.dispose();
      composerRef.current = null;
      sunRef.current = null;
      renderer.dispose();

      host.removeChild(renderer.domElement);
    };
    // `theme` is included so the renderer rebuilds when the user toggles
    // light/dark — token-driven materials are resolved at mount time and
    // need fresh values when the data-theme attribute flips. Spec §32 V11.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    if (!orbitCameraPoseMm) return;
    orbitRigApiRef.current?.applyViewpointMm(orbitCameraPoseMm);
  }, [orbitCameraNonce, orbitCameraPoseMm]);

  useEffect(() => {
    const root = rootGroupRef.current;

    if (!root) return;

    while (root.children.length) root.remove(root.children[0]!);

    const clipElevMRaw = viewerClipElevMm;
    const clipElevM =
      clipElevMRaw != null && Number.isFinite(clipElevMRaw) && clipElevMRaw >= 0
        ? clipElevMRaw / 1000
        : null;

    const clipFloorMRaw = viewerClipFloorElevMm;
    const clipFloorM =
      clipFloorMRaw != null && Number.isFinite(clipFloorMRaw) && clipFloorMRaw >= 0
        ? clipFloorMRaw / 1000
        : null;

    const rnd = rendererRef.current;
    const sectionBox = sectionBoxRef.current;
    const sectionPlanes = sectionBox && sectionBoxActive ? sectionBox.clippingPlanes() : [];
    if (rnd)
      rnd.localClippingEnabled =
        clipElevM != null || clipFloorM != null || sectionPlanes.length > 0;

    const clippingPlanes: THREE.Plane[] = [];
    for (const p of sectionPlanes) {
      clippingPlanes.push(
        new THREE.Plane(new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z), p.constant),
      );
    }
    /** Upper cap: same semantics as the original single plane — hide everything **above** Y=clipElevM. */
    if (clipElevM != null) {
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, clipElevM, 0),
      );
      clippingPlanes.push(plane);
    }
    /** Lower floor: hide everything **below** Y=clipFloorM when set. */
    if (clipFloorM != null) {
      const planeLo = new THREE.Plane();
      planeLo.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, clipFloorM, 0),
      );
      clippingPlanes.push(planeLo);
    }
    const catHidden = viewerCategoryHidden;

    const skipCat = (e: Element): boolean => {
      const ck = elemViewerCategory(e);
      return ck != null && Boolean(catHidden[ck]);
    };

    const walls = Object.values(elementsById).filter((e): e is WallElem => e.kind === 'wall');

    const wallById = Object.fromEntries(walls.map((w) => [w.id, w]));

    const paint = paintBundleRef.current;

    for (const f of Object.values(elementsById)) {
      if (f.kind !== 'floor') continue;
      if (skipCat(f)) continue;

      root.add(makeFloorSlabMesh(f, elementsById, paint));
    }

    for (const w of walls) {
      if (skipCat(w)) continue;
      const elev = elevationMForLevel(w.levelId, elementsById);

      root.add(makeWallMesh(w, elev, paint, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'door') continue;
      if (skipCat(e)) continue;

      const hw = wallById[e.wallId];

      if (!hw || skipCat(hw)) continue;

      const elev = elevationMForLevel(hw.levelId, elementsById);

      root.add(makeDoorMesh(e, hw, elev, paint, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'window') continue;
      if (skipCat(e)) continue;

      const hw = wallById[e.wallId];

      if (!hw || skipCat(hw)) continue;

      const elev = elevationMForLevel(hw.levelId, elementsById);

      root.add(makeWindowMesh(e, hw, elev, paint, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'stair') continue;
      if (skipCat(e)) continue;

      root.add(makeStairVolumeMesh(e, elementsById, paint, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'room') continue;
      if (skipCat(e)) continue;

      root.add(makeRoomRibbon(e, elevationMForLevel(e.levelId, elementsById), paint));
    }

    for (const rf of Object.values(elementsById)) {
      if (rf.kind !== 'roof') continue;
      if (skipCat(rf)) continue;

      root.add(makeRoofMassMesh(rf, elementsById, paint));
    }

    for (const rl of Object.values(elementsById)) {
      if (rl.kind !== 'railing') continue;
      if (skipCat(rl)) continue;

      root.add(makeRailingMesh(rl, elementsById, paint));
    }

    for (const si of Object.values(elementsById)) {
      if (si.kind !== 'site') continue;
      if (skipCat(si)) continue;

      root.add(makeSiteMesh(si, elementsById, paint));
    }

    applyClippingPlanesToMeshes(root, clippingPlanes);

    // Section-box wireframe cage so the user can see the active region.
    if (sectionBoxCageRef.current) {
      root.remove(sectionBoxCageRef.current);
      sectionBoxCageRef.current = null;
    }
    if (sectionBoxActive && sectionBox) {
      const snap = sectionBox.snapshot();
      const min = snap.min;
      const max = snap.max;
      const verts = aabbWireframeVertices(min, max);
      const geom = new THREE.BufferGeometry().setFromPoints(verts);
      const cage = new THREE.LineSegments(
        geom,
        new THREE.LineBasicMaterial({
          color: readToken('--color-accent', '#fcd34d'),
          transparent: true,
          opacity: 0.85,
        }),
      );
      cage.userData.bimPickId = '__section_box_cage';
      sectionBoxCageRef.current = cage;
      root.add(cage);
    }

    // R1-01: tag every mesh with shadow properties; site is receiver-only.
    const siteIds = new Set(
      Object.values(elementsById).filter((e) => e.kind === 'site').map((e) => e.id),
    );
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const isSite = siteIds.has(obj.userData.bimPickId as string);
      obj.castShadow = !isSite;
      obj.receiveShadow = true;
    });

    // R1-01: update shadow camera frustum to enclose the scene AABB.
    const sun = sunRef.current;
    if (sun) {
      const sceneBox = new THREE.Box3().setFromObject(root);
      if (Number.isFinite(sceneBox.min.x)) {
        const size = new THREE.Vector3();
        sceneBox.getSize(size);
        const sceneRadiusM = Math.max(size.length() / 2, 5);
        const frustumHalf = Math.max(sceneRadiusM * 1.2, 20);
        sun.shadow.camera.left   = -frustumHalf;
        sun.shadow.camera.right  =  frustumHalf;
        sun.shadow.camera.top    =  frustumHalf;
        sun.shadow.camera.bottom = -frustumHalf;
        sun.shadow.camera.near   =  0.5;
        sun.shadow.camera.far    =  sceneRadiusM * 4 + 50;
        sun.shadow.camera.updateProjectionMatrix();
      }
    }

    // First-geometry auto-fit: set orbit target to building centroid so the
    // rig doesn't stay stuck at the world origin when the building is elsewhere.
    if (!hasAutoFittedRef.current) {
      const box = computeRootBoundingBox(root);
      const rig = cameraRigRef.current;
      const cam = cameraRef.current;
      if (box && rig && cam) {
        rig.frame(box);
        rig.setHome();
        const snap = rig.snapshot();
        cam.position.set(snap.position.x, snap.position.y, snap.position.z);
        cam.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
        cam.lookAt(snap.target.x, snap.target.y, snap.target.z);
        hasAutoFittedRef.current = true;
      }
    }
  }, [
    elementsById,
    selectedId,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    sectionBoxActive,
    theme,
  ]);

  // Sync the section-box controller's `active` flag with React state.
  useEffect(() => {
    sectionBoxRef.current?.setActive(sectionBoxActive);
  }, [sectionBoxActive]);

  // Walk mode activation: seed position from orbit camera, request pointer lock, switch FOV.
  useEffect(() => {
    const wc = walkControllerRef.current;
    const cam = cameraRef.current;
    if (!wc) return;
    if (walkActive) {
      if (cam) {
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const yaw = Math.atan2(dir.x, dir.z);
        wc.teleport({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, yaw);
        cam.fov = 75;
        cam.updateProjectionMatrix();
      }
      wc.setLevels(walkLevelsRef.current);
      wc.setActive(true);
    } else {
      wc.setActive(false);
      if (cam) {
        cam.fov = 55;
        cam.updateProjectionMatrix();
      }
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [walkActive]);

  const handleViewCubePick = useCallback(
    (
      _pick: ViewCubePick,
      alignment: { azimuth: number; elevation: number; up: { x: number; y: number; z: number } },
    ): void => {
      const rig = cameraRigRef.current;
      if (!rig) return;
      const snap = rig.snapshot();
      rig.applyViewpoint(
        {
          x:
            snap.target.x +
            snap.radius * Math.cos(alignment.elevation) * Math.sin(alignment.azimuth),
          y: snap.target.y + snap.radius * Math.sin(alignment.elevation),
          z:
            snap.target.z +
            snap.radius * Math.cos(alignment.elevation) * Math.cos(alignment.azimuth),
        },
        snap.target,
        alignment.up,
      );
      const camera = cameraRef.current;
      if (camera) {
        const next = rig.snapshot();
        camera.position.set(next.position.x, next.position.y, next.position.z);
        camera.up.set(next.up.x, next.up.y, next.up.z).normalize();
        camera.lookAt(next.target.x, next.target.y, next.target.z);
        setCurrentAzimuth(next.azimuth);
        setCurrentElevation(next.elevation);
      }
    },
    [],
  );

  const handleViewCubeHome = useCallback((): void => {
    const rig = cameraRigRef.current;
    if (!rig) return;
    rig.reset();
    const camera = cameraRef.current;
    if (camera) {
      const snap = rig.snapshot();
      camera.position.set(snap.position.x, snap.position.y, snap.position.z);
      camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
      camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
      setCurrentAzimuth(snap.azimuth);
      setCurrentElevation(snap.elevation);
    }
  }, []);

  const handleViewCubeDrag = useCallback((dxPx: number, dyPx: number): void => {
    const rig = cameraRigRef.current;
    const camera = cameraRef.current;
    if (!rig || !camera) return;
    rig.orbit(dxPx, dyPx);
    const snap = rig.snapshot();
    camera.position.set(snap.position.x, snap.position.y, snap.position.z);
    camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
    camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
    setCurrentAzimuth(snap.azimuth);
    setCurrentElevation(snap.elevation);
  }, []);

  return (
    <div
      data-testid="orbit-3d-viewport"
      className="relative h-full w-full overflow-hidden bg-background"
    >

      {activeViewpointId ? (
        <OrbitViewpointPersistedHud
          activeViewpointId={activeViewpointId}
          viewpoint={persistedOrbitViewpoint}
          onPersistField={onPersistViewpointField}
        />
      ) : null}

      <div className="pointer-events-auto absolute right-6 top-6 z-20">
        <ViewCube
          currentAzimuth={currentAzimuth}
          currentElevation={currentElevation}
          onPick={handleViewCubePick}
          onDrag={handleViewCubeDrag}
          onHome={handleViewCubeHome}
        />
      </div>

      {/* Walk mode controls bar — shown while pointer is locked */}
      {walkActive ? (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-1.5 text-[11px] text-muted shadow-md backdrop-blur-sm">
            <NavHint k="WASD" label={t('viewport.walkHints.move')} />
            <Sep />
            <NavHint k="Mouse" label={t('viewport.walkHints.look')} />
            <Sep />
            <NavHint k="Shift" label={t('viewport.walkHints.run')} />
            <Sep />
            <NavHint k="Q/E" label={t('viewport.walkHints.upDown')} />
            <Sep />
            <NavHint k="PgUp/PgDn" label={t('viewport.walkHints.floor')} />
            <Sep />
            <NavHint k="Esc" label={t('viewport.walkHints.exit')} />
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-[10px] text-muted/80 backdrop-blur-sm">
            <NavHint k="LMB" label={t('viewport.walkHints.orbit')} />
            <Sep />
            <NavHint k="RMB/Shift" label={t('viewport.walkHints.pan')} />
            <Sep />
            <NavHint k="Scroll" label={t('viewport.walkHints.zoom')} />
            <Sep />
            <NavHint k="F" label={t('viewport.walkHints.fit')} />
            <Sep />
            <NavHint k="H" label={t('viewport.walkHints.reset')} />
            <Sep />
            <span className="opacity-70">{t('viewport.shortcutsHint')}</span>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => {
            const next = !walkActive;
            setWalkActive(next);
            if (next) {
              mountRef.current?.requestPointerLock();
            } else {
              document.exitPointerLock();
            }
          }}
          aria-pressed={walkActive}
          data-active={walkActive ? 'true' : 'false'}
          className={[
            'rounded-md border border-border px-2 py-1 text-xs',
            walkActive ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground',
          ].join(' ')}
          title={t('viewport.walkTitle')}
        >
          {t('viewport.walkLabel')}: {walkActive ? t('viewport.on') : t('viewport.off')}
        </button>
        <button
          type="button"
          onClick={() => setSectionBoxActive((v) => !v)}
          aria-pressed={sectionBoxActive}
          data-active={sectionBoxActive ? 'true' : 'false'}
          className={[
            'rounded-md border border-border px-2 py-1 text-xs',
            sectionBoxActive ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground',
          ].join(' ')}
          title={t('viewport.sectionBoxTitle')}
        >
          {t('viewport.sectionBoxLabel')}: {sectionBoxActive ? t('viewport.on') : t('viewport.off')}
        </button>
        {sectionBoxActive && sectionBoxRef.current ? (
          <span
            data-testid="section-box-summary"
            className="rounded-pill border border-border bg-surface px-2 py-0.5 text-[11px] font-mono text-muted"
          >
            {sectionBoxRef.current.summary()}
          </span>
        ) : null}
      </div>

      <div ref={mountRef} className="size-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
