import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  curtainGridCellId,
  type CurtainPanelOverride,
  type DecalElem,
  type Element,
  type MaterialElem,
  type WallLocationLine,
} from '@bim-ai/core';
import { buildDoorGeometry } from '../families/geometryFns/doorGeometry';
import { buildWindowGeometry } from '../families/geometryFns/windowGeometry';
import { getFamilyById, getTypeById } from '../families/familyCatalog';
import {
  resolveFamilyGeometry,
  type FamilyCatalogLookup,
  type HostParams,
  type ResolverDetailLevel,
} from '../families/familyResolver';
import type { FamilyDefinition } from '../families/types';
import { getBuiltInWallType, type WallTypeAssembly } from '../families/wallTypeCatalog';
import { isStandingSeamMetalKey, resolveMaterial, type ViewportPaintBundle } from './materials';
import { categoryColorOr, addEdges, readToken } from './sceneHelpers';
import { roofHeightAtPoint } from './roofHeightSampler';
import { makeLayeredWallMesh } from './meshBuilders.layeredWall';
import { makeMultiRunStairMesh } from './meshBuilders.multiRunStair';

/** Resolve a wall's `wallTypeId` to a renderable assembly. Built-in catalog
 * entries take precedence over user-authored `wall_type` elements. */
export function resolveWallTypeAssembly(
  wallTypeId: string,
  elementsById?: Record<string, Element>,
): WallTypeAssembly | null {
  const builtIn = getBuiltInWallType(wallTypeId);
  if (builtIn) return builtIn;
  if (!elementsById) return null;
  const el = elementsById[wallTypeId];
  if (!el || el.kind !== 'wall_type') return null;
  return {
    id: el.id,
    name: el.name,
    basisLine: (el.basisLine ?? 'center') as 'center' | 'face_interior' | 'face_exterior',
    layers: el.layers.map((l) => ({
      name: '',
      thicknessMm: Number(l.thicknessMm),
      materialKey: String(l.materialKey ?? ''),
      function: l.function as 'structure' | 'insulation' | 'finish',
    })),
  };
}

export type WallElem = Extract<Element, { kind: 'wall' }>;

/**
 * KRN-09 + FAM-01 — best-effort resolve a `family_instance` curtain-cell
 * override into a Three.Group containing the family's authored geometry.
 *
 * Returns null when the family type is unknown, the family has no
 * authored geometry, or resolution throws (cycle, missing param) — the
 * caller falls back to the magenta placeholder pane.
 *
 * The resolved Group is positioned at the cell centre, rotated to the
 * wall yaw, and scaled mm → metres so the FAM-01 mm-space geometry
 * lines up with the rest of the viewport.
 */
function tryResolveFamilyInstancePanel(
  familyTypeId: string | undefined | null,
  cellPosition: THREE.Vector3,
  yaw: number,
  bimPickId: string,
  cellId: string,
  detailLevel?: ResolverDetailLevel,
): THREE.Group | null {
  if (!familyTypeId) return null;
  const typeEntry = getTypeById(familyTypeId);
  const familyDef = typeEntry ? getFamilyById(typeEntry.familyId) : undefined;
  if (!familyDef?.geometry?.length) {
    return null;
  }
  try {
    const catalog: FamilyCatalogLookup = { [familyDef.id]: familyDef };
    // Eagerly hydrate any directly-nested families so the resolver's
    // BFS sees the full subgraph from the built-in catalog. Deeper deps
    // are picked up recursively as the walk descends.
    const seen = new Set<string>([familyDef.id]);
    const stack: FamilyDefinition[] = [familyDef];
    while (stack.length > 0) {
      const def = stack.pop()!;
      for (const node of def.geometry ?? []) {
        if (node.kind !== 'family_instance_ref') continue;
        if (seen.has(node.familyId)) continue;
        const dep = getFamilyById(node.familyId);
        if (!dep) continue;
        catalog[node.familyId] = dep;
        seen.add(node.familyId);
        stack.push(dep);
      }
    }
    const params = (typeEntry?.parameters ?? {}) as HostParams;
    const resolved = resolveFamilyGeometry(familyDef.id, params, catalog, detailLevel);
    resolved.scale.set(0.001, 0.001, 0.001);
    resolved.position.copy(cellPosition);
    resolved.rotation.y = yaw;
    resolved.userData.bimPickId = bimPickId;
    resolved.userData.curtainCellId = cellId;
    resolved.userData.curtainPanelKind = 'family_instance';
    resolved.userData.curtainPanelFamilyTypeId = familyTypeId;
    return resolved;
  } catch (err) {
    console.warn(
      `[KRN-09] family_instance resolution failed for type '${familyTypeId}'; falling back to placeholder`,
      err,
    );
    return null;
  }
}

/**
 * KRN-09 — resolve the material for a single curtain-wall grid cell.
 *
 * Returns:
 *   - `null` for `kind: 'empty'` (caller skips the pane entirely)
 *   - the registered MAT-01 material as a MeshStandardMaterial for
 *     `kind: 'system'` with a known `materialKey`
 *   - the `placeholder_unloaded` magenta material for `kind: 'family_instance'`
 *     until FAM-01 lands and renders the actual family
 *   - the supplied default glass material otherwise
 */
function resolveCurtainPanelMaterial(
  override: CurtainPanelOverride | null,
  defaultGlassMat: THREE.Material,
): THREE.Material | null {
  if (!override) return defaultGlassMat;
  if (override.kind === 'empty') return null;
  if (override.kind === 'family_instance') {
    const placeholder = resolveMaterial('placeholder_unloaded');
    return new THREE.MeshStandardMaterial({
      color: placeholder?.baseColor ?? '#ff66cc',
      roughness: placeholder?.roughness ?? 0.6,
      metalness: placeholder?.metalness ?? 0,
      side: THREE.DoubleSide,
    });
  }
  // `system` override
  const matSpec = resolveMaterial(override.materialKey);
  if (!matSpec) return defaultGlassMat;
  return new THREE.MeshStandardMaterial({
    color: matSpec.baseColor,
    roughness: matSpec.roughness,
    metalness: matSpec.metalness,
    side: THREE.DoubleSide,
  });
}

function locationLineOffsetFrac(loc: WallLocationLine): number {
  switch (loc) {
    case 'finish-face-exterior':
    case 'core-face-exterior':
      return 0.5;
    case 'finish-face-interior':
    case 'core-face-interior':
      return -0.5;
    default:
      return 0;
  }
}

function makeCurvedWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Mesh {
  const curve = wall.wallCurve!;
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const locFrac = locationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
  const centerRadius = Math.max(0.001, curve.radiusMm / 1000 + locFrac * thick);
  const outerRadius = centerRadius + thick / 2;
  const innerRadius = Math.max(0.001, centerRadius - thick / 2);
  const sweepRad = THREE.MathUtils.degToRad(curve.sweepDeg);
  const startRad = THREE.MathUtils.degToRad(curve.startAngleDeg);
  const steps = Math.max(10, Math.ceil(Math.abs(sweepRad) / (Math.PI / 24)));
  const pointAt = (radius: number, idx: number) => {
    const a = startRad + (sweepRad * idx) / steps;
    return {
      x: curve.center.xMm / 1000 + Math.cos(a) * radius,
      y: -(curve.center.yMm / 1000 + Math.sin(a) * radius),
    };
  };

  const shape = new THREE.Shape();
  const first = pointAt(outerRadius, 0);
  shape.moveTo(first.x, first.y);
  for (let i = 1; i <= steps; i++) {
    const p = pointAt(outerRadius, i);
    shape.lineTo(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const p = pointAt(innerRadius, i);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();

  const baseOff = (wall.baseConstraintOffsetMm ?? 0) / 1000;
  const yBase = elevM + baseOff;
  const height =
    wall.topConstraintLevelId &&
    elementsById &&
    elementsById[wall.topConstraintLevelId]?.kind === 'level'
      ? THREE.MathUtils.clamp(
          (elementsById[wall.topConstraintLevelId] as Extract<Element, { kind: 'level' }>)
            .elevationMm /
            1000 +
            (wall.topConstraintOffsetMm ?? 0) / 1000 -
            yBase,
          0.25,
          40,
        )
      : THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);

  const wallMatSpec = resolveMaterial(wall.materialKey);
  const isWhite = wall.materialKey === 'white_cladding' || wall.materialKey === 'white_render';
  const wallBaseColor =
    wallMatSpec?.baseColor ?? (isWhite ? '#f4f4f0' : categoryColorOr(paint, 'wall'));
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({
      color: wallBaseColor,
      roughness:
        wallMatSpec?.roughness ?? (isWhite ? 0.92 : (paint?.categories.wall.roughness ?? 0.85)),
      metalness: wallMatSpec?.metalness ?? paint?.categories.wall.metalness ?? 0,
      envMapIntensity:
        isWhite || wallMatSpec?.category === 'render' || wallMatSpec?.category === 'cladding'
          ? 0.15
          : 1.0,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yBase;
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  return mesh;
}

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
      // Floor slabs are diffuse; sky env-map reflections wash the catalog
      // colour pale-blue. Drop to 0.15 so the warm-tone floors read true.
      envMapIntensity: 0.15,
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

// Asymmetric gable: ridge offset transversely from the rectangle center, with
// optional independent eave heights on each side. Ridge height is derived from
// the LEFT slope: `ridgeY = eaveLeftY + (halfSpan + offset) * tan(slopeRad)`.
// The right slope angle is implicit (steeper or shallower depending on offset
// sign and per-side eave heights).
//
// Watertightness: the geometry is closed by a 2-triangle non-planar bottom
// quad spanning the (potentially split) eave levels. Without this closure
// three-bvh-csg silently fails when the dormer cutter is subtracted.
function _buildAsymmetricGableGeometry(
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
 * KRN-03 — pavilion hip mesh for arbitrary convex polygon footprints (≥ 5 vertices).
 *
 * Each polygon edge becomes a sloped triangular face whose apex is the polygon
 * centroid lifted by `inradius * tan(slope)`. All edges share the same pitch,
 * so for regular polygons the apex is a single point; for irregular convex
 * polygons the result is a pyramidal hip with all edges sloping inward.
 */
function _buildHipPolygonGeometry(
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

function _buildAsymmetricGableGeometryWithRoofOpenings(
  roof: Extract<Element, { kind: 'roof' }>,
  roofOpenings: Array<Extract<Element, { kind: 'roof_opening' }>>,
  boundsMm: ReturnType<typeof xzBoundsMm>,
  refElev: number,
  slopeRad: number,
  ridgeAlongX: boolean,
): THREE.BufferGeometry | null {
  if (ridgeAlongX || roofOpenings.length !== 1 || (roof.footprintMm ?? []).length !== 4) {
    return null;
  }

  const opening = roofOpenings[0];
  const rawBounds = xzBoundsMm(roof.footprintMm ?? []);
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

  const dormersForRoof = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'dormer' }> =>
      e.kind === 'dormer' && (e as Extract<Element, { kind: 'dormer' }>).hostRoofId === roof.id,
  );
  const roofOpeningsForRoof = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'roof_opening' }> =>
      e.kind === 'roof_opening' &&
      (e as Extract<Element, { kind: 'roof_opening' }>).hostRoofId === roof.id,
  );

  const slopeRad = (THREE.MathUtils.clamp(Number(roof.slopeDeg ?? 25), 5, 70) * Math.PI) / 180;
  let geom: THREE.BufferGeometry;
  let ridgeAlongXForCut = true;
  if (roof.roofGeometryMode === 'flat') {
    const slabThick = 0.15;
    geom = new THREE.BoxGeometry(ox1 - ox0, slabThick, oz1 - oz0);
    geom.translate((ox0 + ox1) / 2, eaveY + slabThick / 2, (oz0 + oz1) / 2);
  } else {
    const spanXm = b.spanX / 1000;
    const spanZm = b.spanZ / 1000;

    // Ridge axis: explicit field takes priority; else use longer plan axis.
    let ridgeAlongX: boolean;
    if (roof.ridgeAxis === 'x') ridgeAlongX = true;
    else if (roof.ridgeAxis === 'z') ridgeAlongX = false;
    else ridgeAlongX = spanXm >= spanZm;
    ridgeAlongXForCut = ridgeAlongX;

    // L-shape detection: explicit mode wins; otherwise infer from compactness ratio.
    const isExplicitLShape = roof.roofGeometryMode === 'gable_pitched_l_shape';
    const isImpliedLShape =
      roof.roofGeometryMode !== 'hip' && rawPts.length >= 6 && _compactnessRatio(rawPts) < 0.85;
    const isLShape = isExplicitLShape || isImpliedLShape;

    if (isLShape) {
      geom = _buildLShapeGeometry(rawPts, ovMm, eaveY, slopeRad);
    } else if (roof.roofGeometryMode === 'hip') {
      // KRN-03: arbitrary convex polygons (≥5 vertices) get a pavilion hip mesh.
      // 4-vertex axis-aligned rectangles fall through to the AABB hip helper.
      if (offsetPts.length >= 5) {
        geom = _buildHipPolygonGeometry(offsetPts, eaveY, slopeRad);
      } else {
        geom = _buildHipGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
      }
    } else if (roof.roofGeometryMode === 'asymmetric_gable') {
      const ridgeOffsetM = (roof.ridgeOffsetTransverseMm ?? 0) / 1000;
      const eaveLeftY =
        roof.eaveHeightLeftMm != null ? refElev + roof.eaveHeightLeftMm / 1000 : eaveY;
      const eaveRightY =
        roof.eaveHeightRightMm != null ? refElev + roof.eaveHeightRightMm / 1000 : eaveY;
      geom = _buildAsymmetricGableGeometry(
        ox0,
        ox1,
        oz0,
        oz1,
        eaveLeftY,
        eaveRightY,
        slopeRad,
        ridgeAlongX,
        ridgeOffsetM,
      );
    } else {
      geom = _buildGableGeometry(ox0, ox1, oz0, oz1, eaveY, slopeRad, ridgeAlongX);
    }
  }

  const analyticRoofOpeningGeom =
    roof.roofGeometryMode === 'asymmetric_gable' && roofOpeningsForRoof.length > 0
      ? _buildAsymmetricGableGeometryWithRoofOpenings(
          roof,
          roofOpeningsForRoof,
          b,
          refElev,
          slopeRad,
          ridgeAlongXForCut,
        )
      : null;
  const roofOpeningsHandledAnalytically = !!analyticRoofOpeningGeom;
  if (analyticRoofOpeningGeom) {
    geom = analyticRoofOpeningGeom;
  }

  // KRN-14 — apply CSG cuts for any dormer that hosts on this roof. The
  // cut helper is registered (or not) by the bootstrap module; tests that
  // don't exercise the dormer path leave it null so three-bvh-csg never
  // gets imported in jsdom.
  if (
    (dormersForRoof.length > 0 ||
      (!roofOpeningsHandledAnalytically && roofOpeningsForRoof.length > 0)) &&
    _dormerCutFn
  ) {
    geom = _dormerCutFn(geom, roof, elementsById, refElev);
  }

  const roofMatSpec = resolveMaterial(roof.materialKey);
  const roofColor =
    roofMatSpec?.baseColor ??
    roof.materialKey ??
    (roof.roofGeometryMode === 'flat' ? '#d8d8d4' : categoryColorOr(paint, 'roof'));
  const roofIsCustom = !!roof.materialKey;

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness:
        roofMatSpec?.roughness ?? (roofIsCustom ? 0.9 : (paint?.categories.roof.roughness ?? 0.74)),
      metalness: roofMatSpec?.metalness ?? paint?.categories.roof.metalness ?? 0.0,
      envMapIntensity:
        roofMatSpec?.category === 'render' || roofMatSpec?.category === 'cladding'
          ? 0.15
          : roofIsCustom && !roofMatSpec
            ? 0.1
            : 1.0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.userData.bimPickId = roof.id;
  // Roof meshes are built from many triangles per pitch (asymmetric_gable
  // alone produces 8+ tris). The default 15° edge threshold drew a line
  // along every internal triangle boundary even when adjacent triangles
  // were coplanar — making the roof look polygonal/faceted instead of
  // smooth. Bump to 30° so only the genuine creases (ridge, eaves,
  // gable-end vertices) get edge lines.
  addEdges(mesh, 30);

  if (isStandingSeamMetalKey(roof.materialKey)) {
    addStandingSeamPattern(mesh, roof, b, eaveY);
  }
  return mesh;
}

/**
 * KRN-14 — registration slot for the dormer-cut helper.
 *
 * meshBuilders.ts can't import three-bvh-csg at module top-level — that
 * package crashes under jsdom (its three-mesh-bvh dep has a circular-
 * dependency init issue). The viewport bootstrap calls
 * `registerDormerCutFn` in browser context only; tests leave it null and
 * the dormer cut is silently skipped.
 */
type DormerCutFn = (
  geom: THREE.BufferGeometry,
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
  refElev: number,
) => THREE.BufferGeometry;

let _dormerCutFn: DormerCutFn | null = null;

export function registerDormerCutFn(fn: DormerCutFn | null): void {
  _dormerCutFn = fn;
}

export function makeStairVolumeMesh(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  // KRN-07 — when the stair has explicit multi-run geometry, render each run
  // as its own inclined flight stacked on the level deltas plus flat polygon
  // landings between them. Spiral and sketch shapes route through dedicated
  // helpers for helical / polyline-stepped tread layout.
  if (
    stair.shape === 'spiral' ||
    stair.shape === 'sketch' ||
    (stair.runs && stair.runs.length > 0)
  ) {
    return makeMultiRunStairMesh(stair, elementsById, paint);
  }

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
  const isOverride = colorOverride !== undefined;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: isOverride ? 0.92 : 0.85,
    metalness: 0.0,
    envMapIntensity: isOverride ? 0.08 : 1.0,
  });

  for (let i = 0; i < count; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(boardD, boardH, boardProtrude), mat);
    board.position.set((i + 0.5) * pitchM - wallLenM / 2, 0, wallThickM / 2 + boardProtrude / 2);
    addEdges(board);
    mesh.add(board);
  }
}

/**
 * MAT-01 Part B — raised standing-seam pattern for metal roofs.
 *
 * Adds vertical seam ridges running up the slope (or parallel to the long
 * edge for flat roofs). Seam strips are added as children of `roofMesh` in
 * world space, so the roof mesh itself must be in world coordinates with no
 * outer transform applied (the existing `makeRoofMassMesh` builds geometry
 * directly in world coords).
 *
 * - `flat` roofs: seams run parallel to the longer rectangle dimension at
 *   the slab's top surface.
 * - `gable` / `hip` / `asymmetric_gable`: seams run perpendicular to the
 *   ridge (i.e. up the slope), one set per slope panel.
 *
 * Default spacing 600 mm and seam height 25 mm keep the pattern visible at
 * building scale without overwhelming.
 */
export function addStandingSeamPattern(
  roofMesh: THREE.Mesh,
  roof: Extract<Element, { kind: 'roof' }>,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  eaveYWorld: number,
  seamSpacingMm = 600,
  seamHeightMm = 25,
): void {
  const seamSpacingM = Math.max(0.05, seamSpacingMm / 1000);
  const seamHeightM = THREE.MathUtils.clamp(seamHeightMm / 1000, 0.005, 0.05);
  const seamThicknessM = 0.012; // 12 mm — thin raised ridge
  const ox0 = bounds.minX / 1000;
  const ox1 = bounds.maxX / 1000;
  const oz0 = bounds.minZ / 1000;
  const oz1 = bounds.maxZ / 1000;
  const spanX = ox1 - ox0;
  const spanZ = oz1 - oz0;
  if (spanX <= 0 || spanZ <= 0) return;

  const matSpec = resolveMaterial(roof.materialKey);
  const seamColor = matSpec?.baseColor ?? '#3a3d3f';
  const seamMat = new THREE.MeshStandardMaterial({
    color: seamColor,
    roughness: matSpec?.roughness ?? 0.35,
    metalness: matSpec?.metalness ?? 0.7,
  });

  const flatSlabThick = 0.15; // mirror the value used in makeRoofMassMesh
  if (roof.roofGeometryMode === 'flat') {
    const topY = eaveYWorld + flatSlabThick;
    const seamsAlongX = spanX >= spanZ;
    if (seamsAlongX) {
      // Seams run parallel to X axis, spaced along Z.
      const count = Math.max(1, Math.round(spanZ / seamSpacingM));
      for (let i = 1; i < count; i++) {
        const cz = oz0 + (i / count) * spanZ;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(spanX, seamHeightM, seamThicknessM),
          seamMat,
        );
        seam.position.set((ox0 + ox1) / 2, topY + seamHeightM / 2, cz);
        seam.userData.bimPickId = roof.id;
        seam.userData.seam = true;
        roofMesh.add(seam);
      }
    } else {
      const count = Math.max(1, Math.round(spanX / seamSpacingM));
      for (let i = 1; i < count; i++) {
        const cx = ox0 + (i / count) * spanX;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(seamThicknessM, seamHeightM, spanZ),
          seamMat,
        );
        seam.position.set(cx, topY + seamHeightM / 2, (oz0 + oz1) / 2);
        seam.userData.bimPickId = roof.id;
        seam.userData.seam = true;
        roofMesh.add(seam);
      }
    }
    return;
  }

  // Sloped roof — derive ridge orientation from the same logic as
  // _buildGableGeometry so seams visually match the slope panels.
  const slopeRad = (THREE.MathUtils.clamp(Number(roof.slopeDeg ?? 25), 5, 70) * Math.PI) / 180;
  let ridgeAlongX: boolean;
  if (roof.ridgeAxis === 'x') ridgeAlongX = true;
  else if (roof.ridgeAxis === 'z') ridgeAlongX = false;
  else ridgeAlongX = spanX >= spanZ;

  const halfPerpSpan = ridgeAlongX ? spanZ / 2 : spanX / 2;
  if (halfPerpSpan <= 0) return;
  const slopeLenM = halfPerpSpan / Math.cos(slopeRad);

  if (ridgeAlongX) {
    const rz = (oz0 + oz1) / 2;
    const ridgeYMid = eaveYWorld + halfPerpSpan * Math.tan(slopeRad);
    const seamCount = Math.max(2, Math.floor(spanX / seamSpacingM) + 1);
    for (let i = 0; i < seamCount; i++) {
      const t = seamCount === 1 ? 0.5 : i / (seamCount - 1);
      const x = ox0 + t * spanX;
      // South slope: oz0 → rz, eaveY → ridgeY (Y up, Z up)
      addSlopeSeam(
        roofMesh,
        seamMat,
        roof.id,
        x,
        (eaveYWorld + ridgeYMid) / 2,
        (oz0 + rz) / 2,
        slopeLenM,
        seamHeightM,
        seamThicknessM,
        -slopeRad,
        true,
      );
      // North slope: oz1 → rz, eaveY → ridgeY (Y up, Z down toward ridge)
      addSlopeSeam(
        roofMesh,
        seamMat,
        roof.id,
        x,
        (eaveYWorld + ridgeYMid) / 2,
        (oz1 + rz) / 2,
        slopeLenM,
        seamHeightM,
        seamThicknessM,
        slopeRad + Math.PI,
        true,
      );
    }
  } else {
    const rx = (ox0 + ox1) / 2;
    const ridgeYMid = eaveYWorld + halfPerpSpan * Math.tan(slopeRad);
    const seamCount = Math.max(2, Math.floor(spanZ / seamSpacingM) + 1);
    for (let i = 0; i < seamCount; i++) {
      const t = seamCount === 1 ? 0.5 : i / (seamCount - 1);
      const z = oz0 + t * spanZ;
      addSlopeSeam(
        roofMesh,
        seamMat,
        roof.id,
        (ox0 + rx) / 2,
        (eaveYWorld + ridgeYMid) / 2,
        z,
        slopeLenM,
        seamHeightM,
        seamThicknessM,
        -slopeRad,
        false,
      );
      addSlopeSeam(
        roofMesh,
        seamMat,
        roof.id,
        (ox1 + rx) / 2,
        (eaveYWorld + ridgeYMid) / 2,
        z,
        slopeLenM,
        seamHeightM,
        seamThicknessM,
        slopeRad + Math.PI,
        false,
      );
    }
  }
}

/** Helper for `addStandingSeamPattern`: position a single seam strip on
 * one face of a sloped roof. The strip's local +Z runs along the slope,
 * +Y is the protrusion above the slope. `tiltAroundX` controls slope
 * orientation when the ridge runs along X; otherwise we apply the tilt
 * around Z and orient the strip's long axis along world X. */
function addSlopeSeam(
  parent: THREE.Mesh,
  mat: THREE.MeshStandardMaterial,
  pickId: string,
  cx: number,
  cy: number,
  cz: number,
  slopeLenM: number,
  seamHeightM: number,
  seamThicknessM: number,
  tiltRad: number,
  ridgeAlongX: boolean,
): void {
  let geom: THREE.BoxGeometry;
  if (ridgeAlongX) {
    // Long axis along world Z (before rotation around X).
    geom = new THREE.BoxGeometry(seamThicknessM, seamHeightM, slopeLenM);
  } else {
    // Long axis along world X (rotate around Z).
    geom = new THREE.BoxGeometry(slopeLenM, seamHeightM, seamThicknessM);
  }
  const seam = new THREE.Mesh(geom, mat);
  seam.position.set(cx, cy, cz);
  if (ridgeAlongX) {
    seam.rotation.x = tiltRad;
  } else {
    seam.rotation.z = -tiltRad;
  }
  // Lift the seam so its base sits on the slope surface (centre is at the
  // slope midpoint by construction; offset along the rotated +Y by
  // seamHeightM/2). The rotation already orients +Y to the slope normal.
  const localUp = new THREE.Vector3(0, seamHeightM / 2, 0).applyEuler(seam.rotation);
  seam.position.add(localUp);
  seam.userData.bimPickId = pickId;
  seam.userData.seam = true;
  parent.add(seam);
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
  const lenMm = Math.max(1, Math.hypot(dx, dz));
  const lenM = lenMm / 1000;
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const yBase = elevM + (wall.baseConstraintOffsetMm ?? 0) / 1000;
  const sampleCount = Math.max(2, Math.min(48, Math.ceil(lenM / 0.25)));
  const topHeightsRelM: number[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const xMm = sx + t * dx;
    const zMm = sz + t * dz;
    const roofY = roofHeightAtPoint(roof, elementsById, xMm, zMm);
    topHeightsRelM.push(Math.max(0.001, roofY - yBase));
  }

  const geom = buildSlopedSegmentGeometry(lenM, thick, topHeightsRelM);

  // Sloped walls didn't honour the wall's materialKey — used the neutral
  // category default. Resolve catalog material first; drop env-map for
  // cladding / render so the color reads true.
  const slopedMatSpec = resolveMaterial(wall.materialKey);
  const slopedIsWhite =
    wall.materialKey === 'white_cladding' || wall.materialKey === 'white_render';
  const slopedColor =
    slopedMatSpec?.baseColor ?? (slopedIsWhite ? '#f4f4f0' : categoryColorOr(paint, 'wall'));
  const mat = new THREE.MeshStandardMaterial({
    color: slopedColor,
    roughness: slopedMatSpec?.roughness ?? paint?.categories.wall.roughness ?? 0.85,
    metalness: slopedMatSpec?.metalness ?? paint?.categories.wall.metalness ?? 0.0,
    envMapIntensity:
      slopedIsWhite ||
      slopedMatSpec?.category === 'render' ||
      slopedMatSpec?.category === 'cladding'
        ? 0.15
        : 1.0,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set((sx + ex) / 2000, yBase, (sz + ez) / 2000);
  mesh.rotation.y = Math.atan2(dz, dx);
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  return mesh;
}

/**
 * Local helper: build a sub-divided sloped-top prism geometry.
 * Local frame: x along segment (-halfL..+halfL), y up (0..h_at_step),
 * z perpendicular to segment (-halfT..+halfT). The mesh is sized in m;
 * the caller positions + rotates it into world space.
 *
 * `topHeightsRelM` is the sloped-top profile, sampled at each of N+1
 * uniform steps along the segment. Heights are RELATIVE to the prism's
 * y-base (i.e., wall-top height minus yBase). The bottom face is flat;
 * the top, front, back faces follow the per-step heights so a wall
 * crossing an asymmetric_gable ridge resolves a clean kink at the
 * ridge crossing instead of a single straight slope.
 */
function buildSlopedSegmentGeometry(
  segLenM: number,
  thickM: number,
  topHeightsRelM: number[],
): THREE.BufferGeometry {
  const N = topHeightsRelM.length - 1;
  const halfL = segLenM / 2;
  const halfT = thickM / 2;

  // 4 vertices per step: (front-base, back-base, front-top, back-top).
  const positions: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -halfL + (i / N) * segLenM;
    const h = Math.max(0.001, topHeightsRelM[i]);
    positions.push(x, 0, +halfT); // 4i+0 front-base
    positions.push(x, 0, -halfT); // 4i+1 back-base
    positions.push(x, h, +halfT); // 4i+2 front-top
    positions.push(x, h, -halfT); // 4i+3 back-top
  }

  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // front face (z = +halfT): outward normal +Z
    indices.push(a + 0, b + 0, b + 2);
    indices.push(a + 0, b + 2, a + 2);
    // back face (z = -halfT): outward normal -Z (reverse winding)
    indices.push(a + 1, a + 3, b + 3);
    indices.push(a + 1, b + 3, b + 1);
    // top face (sloped): outward normal +Y
    indices.push(a + 2, b + 2, b + 3);
    indices.push(a + 2, b + 3, a + 3);
    // bottom face (flat at y=0): outward normal -Y (reverse winding)
    indices.push(a + 0, a + 1, b + 1);
    indices.push(a + 0, b + 1, b + 0);
  }
  // Start cap (-X normal): front-base, top-front, top-back, back-base
  indices.push(0, 2, 3);
  indices.push(0, 3, 1);
  // End cap (+X normal): at i=N
  const e = N * 4;
  indices.push(e + 0, e + 1, e + 3);
  indices.push(e + 0, e + 3, e + 2);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * KRN-16 — extrude a wall whose plane steps back along recess zones.
 *
 * Builds a closed polygon footprint in plan that traces the exterior
 * face along non-recessed segments and steps inward (toward the wall's
 * interior normal) by `setbackMm` along recessed segments. The interior
 * face mirrors the exterior step so the wall thickness stays constant.
 * The result, extruded vertically by the wall height, reads as a deep
 * architectural recess (loggia / bay window) with end-cap "flanges".
 *
 * Optional roof + element-registry args turn each emitted box into a
 * sloped-top prism whose top follows the host roof — so a wall that has
 * BOTH `roofAttachmentId` and `recessZones` (e.g. a recessed loggia
 * under an asymmetric gable) renders as a sloped-top recess instead of
 * one or the other. The slope is sampled at 25 steps along each segment,
 * which resolves the ridge-crossing kink cleanly.
 *
 * Limitation: door / window CSG cuts are skipped for recessed walls.
 * Hosted openings render against the recessed surface (see makeDoorMesh
 * / makeWindowMesh — they offset by setbackMm when alongT falls inside
 * a recess zone).
 */
export function makeRecessedWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  roofForSlope?: Extract<Element, { kind: 'roof' }> | null,
  elementsById?: Record<string, Element>,
): THREE.Group {
  const halfThickM = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2) / 2;

  // Sort recess zones by alongTStart so we walk them in order.
  const zones = [...(wall.recessZones ?? [])].sort((a, b) => a.alongTStart - b.alongTStart);

  // Build exterior path (plan space, mm). Starts at start exterior, walks
  // Build a multi-box group: full-thickness end caps for each non-recessed
  // span, plus a back-wall box for each recess zone. This avoids the
  // self-intersecting polygon problem of trying to extrude a single
  // closed contour with cheek-wall + back-wall arches.
  const baseOff = (wall.baseConstraintOffsetMm ?? 0) / 1000;
  const yBase = elevM + baseOff;
  const height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);

  const wallMatSpec = resolveMaterial(wall.materialKey);
  const isWhite = wall.materialKey === 'white_cladding' || wall.materialKey === 'white_render';
  const wallBaseColor =
    wallMatSpec?.baseColor ?? (isWhite ? '#f4f4f0' : categoryColorOr(paint, 'wall'));
  const mat = new THREE.MeshStandardMaterial({
    color: wallBaseColor,
    roughness:
      wallMatSpec?.roughness ?? (isWhite ? 0.92 : (paint?.categories.wall.roughness ?? 0.85)),
    metalness: wallMatSpec?.metalness ?? paint?.categories.wall.metalness ?? 0.0,
    // Cladding / render walls drop sky-reflection so the catalog colour
    // reads true (warm wood as warm wood, not pale-blue from sky env map).
    envMapIntensity:
      isWhite || wallMatSpec?.category === 'render' || wallMatSpec?.category === 'cladding'
        ? 0.15
        : 1.0,
  });

  // White-render variant for end caps when the wall's primary materialKey
  // is the recess back finish (cladding_warm_wood). Approximates the
  // architectural "white frame around a wood-clad recess" pattern.
  const capMat =
    wall.materialKey === 'cladding_warm_wood'
      ? new THREE.MeshStandardMaterial({
          color: '#f4f4f0',
          roughness: 0.92,
          metalness: 0,
          envMapIntensity: 0.15,
        })
      : mat;

  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;

  // Compute non-recessed spans (full-thickness wall segments) and recessed
  // spans (where the wall plane has stepped back). Each becomes its own
  // axis-aligned box at the wall's yaw rotation.
  const yaw = Math.atan2(wall.end.yMm - wall.start.yMm, wall.end.xMm - wall.start.xMm);
  const wallLenM = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm) / 1000;
  const wallCx = (wall.start.xMm + wall.end.xMm) / 2 / 1000;
  const wallCz = (wall.start.yMm + wall.end.yMm) / 2 / 1000;

  // Plan unit vectors for sampling roof at recessed positions. Direction
  // is start→end; interior normal is rotated 90° CCW from direction.
  const planDirX = wallLenM > 0 ? (wall.end.xMm - wall.start.xMm) / (wallLenM * 1000) : 1;
  const planDirY = wallLenM > 0 ? (wall.end.yMm - wall.start.yMm) / (wallLenM * 1000) : 0;
  const planNormX = -planDirY;
  const planNormY = planDirX;

  function addBoxAt(t0: number, t1: number, perpMmOffset: number, material: THREE.Material) {
    const segLen = (t1 - t0) * wallLenM;
    if (segLen < 1e-4) return;
    const segMid = (t0 + t1) / 2;
    // Centre offset along wall direction:
    //   centre_along = (segMid - 0.5) * len
    // Then rotate by yaw to get world XZ contribution.
    const along = (segMid - 0.5) * wallLenM;
    // Perpendicular offset in plan-space (interior normal direction) → world
    // XZ. Plan-Y maps directly to world-Z under the viewport convention.
    const perpOffsetM = perpMmOffset / 1000;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    // Local: x = along, z = perpOffset. World: rotate around Y by yaw.
    const dxWorld = cosY * along - sinY * perpOffsetM;
    const dzWorld = sinY * along + cosY * perpOffsetM;
    const cx = wallCx + dxWorld;
    const cz = wallCz + dzWorld;

    let geom: THREE.BufferGeometry;
    if (roofForSlope && elementsById) {
      // Sample roof height along the segment at 25 steps. Plan position at
      // step i = wall.start + t * (wall.end - wall.start) + perpOffset * normal.
      const N = 24;
      const heights: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = t0 + (i / N) * (t1 - t0);
        const planXMm =
          wall.start.xMm + t * (wall.end.xMm - wall.start.xMm) + perpMmOffset * planNormX;
        const planYMm =
          wall.start.yMm + t * (wall.end.yMm - wall.start.yMm) + perpMmOffset * planNormY;
        const hWorldM = roofHeightAtPoint(roofForSlope, elementsById, planXMm, planYMm);
        // Relative to box base (yBase).
        heights.push(Math.max(0.25, hWorldM - yBase));
      }
      geom = buildSlopedSegmentGeometry(segLen, halfThickM * 2, heights);
      // Position at (cx, yBase, cz) — vertices already at y=0..h relative to base.
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(cx, yBase, cz);
      mesh.rotation.y = yaw;
      mesh.userData.bimPickId = wall.id;
      addEdges(mesh);
      group.add(mesh);
      return;
    }
    geom = new THREE.BoxGeometry(segLen, height, halfThickM * 2);
    const box = new THREE.Mesh(geom, material);
    box.position.set(cx, yBase + height / 2, cz);
    box.rotation.y = yaw;
    box.userData.bimPickId = wall.id;
    addEdges(box);
    // Vertical cladding board strips for cladding / wood walls — the line
    // sketch's recessed back wall reads as visible vertical wood siding,
    // not a flat panel. Pick the relevant material (recess back uses the
    // wall's primary materialKey; end caps use the white capMat which
    // doesn't get boards).
    const isRecessBack = perpMmOffset > 0;
    const boardMatSpec = isRecessBack ? wallMatSpec : null;
    if (boardMatSpec?.category === 'cladding') {
      addCladdingBoards(box, segLen, height, halfThickM * 2, 250, 12, boardMatSpec.baseColor);
    }
    group.add(box);
  }

  // End caps (full-thickness wall, on the original plane).
  let cursor = 0;
  for (const z of zones) {
    if (z.alongTStart > cursor) {
      addBoxAt(cursor, z.alongTStart, 0, capMat);
    }
    cursor = Math.max(cursor, z.alongTEnd);
  }
  if (cursor < 1) {
    addBoxAt(cursor, 1, 0, capMat);
  }

  // Recess back walls (full-thickness wall, stepped back by setbackMm).
  for (const z of zones) {
    addBoxAt(z.alongTStart, z.alongTEnd, z.setbackMm, mat);
  }

  return group;
}

export function makeWallMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Mesh | THREE.Group {
  if (wall.wallCurve?.kind === 'arc') {
    return makeCurvedWallMesh(wall, elevM, paint, elementsById);
  }

  if (wall.roofAttachmentId && elementsById) {
    const roof = elementsById[wall.roofAttachmentId];
    if (roof?.kind === 'roof') {
      const typedRoof = roof as Extract<Element, { kind: 'roof' }>;
      // KRN-16 + KRN-11 composition: a wall with BOTH a roof attachment
      // AND recess zones (e.g. a recessed loggia under an asymmetric
      // gable) renders as a sloped-top recess. The recess builder samples
      // the host roof at every emitted segment so the gable peak +
      // ridge crossing land cleanly on each end-cap and on the recess
      // back wall.
      if (wall.recessZones && wall.recessZones.length > 0) {
        return makeRecessedWallMesh(wall, elevM, paint, typedRoof, elementsById);
      }
      return makeSlopedWallMesh(wall, typedRoof, elevM, paint, elementsById);
    }
  }
  if (wall.wallTypeId) {
    const assembly = resolveWallTypeAssembly(wall.wallTypeId, elementsById);
    if (assembly) {
      return makeLayeredWallMesh(wall, assembly, elevM, paint, elementsById);
    }
  }
  if (wall.recessZones && wall.recessZones.length > 0) {
    return makeRecessedWallMesh(wall, elevM, paint);
  }
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);

  const baseOff = (wall.baseConstraintOffsetMm ?? 0) / 1000;
  const yBase = elevM + baseOff;
  let height: number;
  if (wall.topConstraintLevelId && elementsById) {
    const topLvl = elementsById[wall.topConstraintLevelId];
    const topElevM = topLvl?.kind === 'level' ? topLvl.elevationMm / 1000 : elevM;
    const topOff = (wall.topConstraintOffsetMm ?? 0) / 1000;
    height = THREE.MathUtils.clamp(topElevM + topOff - yBase, 0.25, 40);
  } else {
    height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  }

  const locFrac = locationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
  const perpX = (-dz / len) * locFrac * thick;
  const perpZ = (dx / len) * locFrac * thick;

  const wallMatSpec = resolveMaterial(wall.materialKey);
  const isWhite = wall.materialKey === 'white_cladding' || wall.materialKey === 'white_render';
  const wallBaseColor =
    wallMatSpec?.baseColor ?? (isWhite ? '#f4f4f0' : categoryColorOr(paint, 'wall'));
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, height, thick),
    new THREE.MeshStandardMaterial({
      color: wallBaseColor,
      roughness:
        wallMatSpec?.roughness ?? (isWhite ? 0.92 : (paint?.categories.wall.roughness ?? 0.85)),
      metalness: wallMatSpec?.metalness ?? paint?.categories.wall.metalness ?? 0.0,
      // Render + cladding categories drop sky reflection so the catalog
      // base color reads true (cladding_beige_grey as warm beige, not
      // washed-blue under default env map). Other materials keep full
      // env-map for metal/glass realism.
      envMapIntensity:
        isWhite || wallMatSpec?.category === 'render' || wallMatSpec?.category === 'cladding'
          ? 0.15
          : 1.0,
    }),
  );
  mesh.position.set(sx + dx / 2 + perpX, yBase + height / 2, sz + dz / 2 + perpZ);
  mesh.rotation.y = Math.atan2(dz, dx);
  mesh.userData.bimPickId = wall.id;
  addEdges(mesh);
  if (wall.materialKey === 'timber_cladding') addCladdingBoards(mesh, len, height, thick);
  else if (wall.materialKey === 'white_cladding')
    addCladdingBoards(mesh, len, height, thick, 120, 10, '#f4f4f0');
  else if (wallMatSpec?.category === 'cladding')
    // Pitch bumped 150 -> 250 mm so vertical board seams are visible
    // from iso-zoom — at 150 they were too tight to read at far camera
    // distance, leaving cladding walls looking like flat panels.
    addCladdingBoards(mesh, len, height, thick, 250, 12, wallMatSpec.baseColor);

  // GAP-R5 — slab-edge expression strip: thin horizontal band straddling
  // the slab line at the base of every elevated single-thickness wall, so
  // upper-floor walls read with a visible concrete plate. Layered walls
  // express their slab edge through the layer stack itself, so we skip
  // them here. `floorEdgeStripDisabled` is the per-instance opt-out.
  if (yBase > 0.01 && !wall.wallTypeId && wall.floorEdgeStripDisabled !== true) {
    const edgeH = 0.05; // 50 mm total band height (30 mm above + 20 mm below)
    const edgeP = 0.03; // 30 mm projection proud of wall face
    const edgeMat = new THREE.MeshStandardMaterial({
      color: paint?.categories.slab_edge.color ?? '#9a9a92',
      roughness: paint?.categories.slab_edge.roughness ?? 0.6,
      metalness: paint?.categories.slab_edge.metalness ?? 0,
    });
    const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(len, edgeH, thick + edgeP * 2), edgeMat);
    // Centre the strip 5 mm above the slab line (=> 30 mm above, 20 mm below).
    edgeMesh.position.set(0, -height / 2 + 0.005, 0);
    edgeMesh.castShadow = edgeMesh.receiveShadow = true;
    edgeMesh.userData.bimPickId = wall.id;
    edgeMesh.userData.slabEdge = true;
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

  // GAP-R7 — physically-based glass: depthWrite=false is the load-bearing
  // setting here. Without it, the glass plane writes to the z-buffer and
  // occludes interior elements (stairs, walls) drawn afterwards even though
  // the fragment is "transparent". transmission/roughness/thickness give the
  // panel its physical lensing so the interior is visibly framed by the
  // glazing rather than tinted-over.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8d6e6,
    transparent: true,
    opacity: 0.4,
    transmission: 0.95,
    roughness: 0.05,
    metalness: 0,
    thickness: 0.005,
    ior: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0.0,
  });

  const PANEL_W = 1.5;
  const PANEL_H = 1.2;
  const MW = 0.06;

  // KRN-09 — derive grid dims so we can iterate cells for overrides.
  const vCount =
    wall.curtainWallVCount != null
      ? Math.max(1, wall.curtainWallVCount)
      : Math.max(1, Math.round(len / PANEL_W));
  const hCount =
    wall.curtainWallHCount != null
      ? Math.max(1, wall.curtainWallHCount)
      : Math.max(1, Math.round(height / PANEL_H));
  const cellW = len / vCount;
  const cellH = height / hCount;
  const overrides = wall.curtainPanelOverrides ?? null;

  // Per-cell pane: one PlaneGeometry sized to the cell, with per-cell material
  // resolution (default glass / empty / system solid / family-instance via
  // FAM-01 resolver, magenta placeholder on lookup miss).
  for (let v = 0; v < vCount; v++) {
    for (let h = 0; h < hCount; h++) {
      const cellId = curtainGridCellId(v, h);
      const override = overrides ? (overrides[cellId] ?? null) : null;
      const tCenter = (v + 0.5) / vCount;
      const cellPos = new THREE.Vector3(
        sx + tCenter * dx,
        elevM + (h + 0.5) * cellH,
        sz + tCenter * dz,
      );

      if (override?.kind === 'family_instance') {
        const resolved = tryResolveFamilyInstancePanel(
          override.familyTypeId,
          cellPos,
          yaw,
          wall.id,
          cellId,
        );
        if (resolved) {
          group.add(resolved);
          continue;
        }
        // Fall through to placeholder pane below.
      }

      const cellMat = resolveCurtainPanelMaterial(override, glassMat);
      if (cellMat === null) continue; // 'empty' override — leave the bay open
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(cellW, cellH), cellMat);
      pane.position.copy(cellPos);
      pane.rotation.y = yaw;
      pane.userData.bimPickId = wall.id;
      pane.userData.curtainCellId = cellId;
      if (override?.kind === 'family_instance') {
        pane.userData.curtainPanelKind = 'family_instance';
        pane.userData.curtainPanelFamilyTypeId = override.familyTypeId ?? null;
      } else if (override?.kind === 'system') {
        pane.userData.curtainPanelKind = 'system';
        pane.userData.curtainPanelMaterialKey = override.materialKey ?? null;
      } else {
        pane.userData.curtainPanelKind = override?.kind ?? 'glass';
      }
      group.add(pane);
    }
  }

  // Vertical mullions at bay divisions
  for (let i = 0; i <= vCount; i++) {
    const t = i / vCount;
    const vm = new THREE.Mesh(new THREE.BoxGeometry(MW, height, thick), mullionMat);
    vm.position.set(sx + t * dx, elevM + height / 2, sz + t * dz);
    vm.rotation.y = yaw;
    addEdges(vm);
    group.add(vm);
  }

  // Horizontal mullions at floor divisions
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

/**
 * KRN-16 — for a hosted opening on a recessed wall, return the world-space
 * offset that places it on the recessed surface. Returns (0,0) when the
 * wall has no matching recess zone.
 */
export function recessOffsetForOpening(wall: WallElem, alongT: number): { dx: number; dz: number } {
  if (!wall.recessZones || wall.recessZones.length === 0) return { dx: 0, dz: 0 };
  const zone = wall.recessZones.find((z) => alongT >= z.alongTStart && alongT <= z.alongTEnd);
  if (!zone) return { dx: 0, dz: 0 };
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  // Convention. dx/dz are plan-space deltas (the variable named "sz"
  // actually holds plan-Y/1000). Plan interior normal = left of the
  // walking direction: plan tangent (Ux, Uy) → plan normal (-Uy, +Ux).
  // The viewport convention maps plan-Y directly onto world-Z (see
  // makeFloorSlabMesh's shape construction + rotate-X(-π/2) chain), so:
  //   worldN = (-planUy, 0, +planUx)
  const planUx = dx / len;
  const planUy = dz / len;
  const nxWorld = -planUy;
  const nzWorld = +planUx;
  const setM = zone.setbackMm / 1000;
  return { dx: nxWorld * setM, dz: nzWorld * setM };
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
  const off = recessOffsetForOpening(wall, door.alongT);
  group.position.set(px + off.dx, elevM, pz + off.dz);
  group.rotation.y = wallYaw(wall);
  return group;
}

export function makeWindowMesh(
  win: Extract<Element, { kind: 'window' }>,
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Group {
  const typeEntry = win.familyTypeId ? getTypeById(win.familyTypeId) : undefined;
  const familyDef = typeEntry ? getFamilyById(typeEntry.familyId) : undefined;
  const group = buildWindowGeometry({ win, wall, elevM, paint, familyDef, elementsById });
  const { px, pz } = hostedXZ(win, wall);
  const rawSill = Number(win.sillHeightMm);
  const sillM = Math.max(0.06, Math.min(rawSill / 1000, (wall.heightMm - 80) / 1000));
  const outlineKind = win.outlineKind ?? 'rectangle';
  // Non-rectangular outlines anchor at sill — group origin sits at sill level
  // (matches outline-space origin). Rectangular path keeps the original
  // centred-on-rect behaviour for backwards compatibility.
  const off = recessOffsetForOpening(wall, win.alongT);
  if (outlineKind !== 'rectangle') {
    group.position.set(px + off.dx, elevM + sillM, pz + off.dz);
  } else {
    const rawH = Number(win.heightMm);
    const outerH = Math.max(0.05, Math.min(rawH / 1000, (wall.heightMm - rawSill - 60) / 1000));
    group.position.set(px + off.dx, elevM + sillM + outerH / 2, pz + off.dz);
  }
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
  // Wood deck floor + low-reflection so the balcony reads as a warm
  // wood balcony per the line sketch, not a generic grey slab.
  const slabMat = new THREE.MeshStandardMaterial({
    color: '#a87a44',
    roughness: 0.85,
    envMapIntensity: 0.15,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, slabH, projM), slabMat);
  slab.position.set(slabCx, slabCy, slabCz);
  slab.rotation.y = yaw;
  addEdges(slab);
  group.add(slab);

  // Glass balustrade: frameless glass panel at outer edge, standing on slab top.
  if (balH > 0.01) {
    // Frameless glass balustrade — slightly more opaque than 0.28 so it
    // reads as a visible glass panel against light backgrounds, not as
    // near-invisible water. Edge outline (addEdges) gives it a frame
    // outline that mimics the line sketch's hand-drawn pane.
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xb0d8e8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 0.05,
      metalness: 0.05,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const balThick = 0.025;
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

export function makeColumnMesh(
  col: Extract<Element, { kind: 'column' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const bM = THREE.MathUtils.clamp((col.bMm ?? 300) / 1000, 0.05, 2);
  const hM = THREE.MathUtils.clamp((col.hMm ?? 300) / 1000, 0.05, 2);
  const baseOff = (col.baseConstraintOffsetMm ?? 0) / 1000;
  const topOff = col.topConstraintOffsetMm != null ? col.topConstraintOffsetMm / 1000 : 0;
  const heightM = col.heightMm != null ? THREE.MathUtils.clamp(col.heightMm / 1000, 0.25, 40) : 3.0;
  const yBase = elevM + baseOff;
  const geo = new THREE.BoxGeometry(bM, heightM, hM);
  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    col.positionMm.xMm / 1000,
    yBase + heightM / 2 + topOff,
    col.positionMm.yMm / 1000,
  );
  mesh.rotation.y = THREE.MathUtils.degToRad(col.rotationDeg ?? 0);
  addEdges(mesh);
  return mesh;
}

export function makeBeamMesh(
  beam: Extract<Element, { kind: 'beam' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const sx = beam.startMm.xMm / 1000;
  const sz = beam.startMm.yMm / 1000;
  const ex = beam.endMm.xMm / 1000;
  const ez = beam.endMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const wM = THREE.MathUtils.clamp((beam.widthMm ?? 200) / 1000, 0.05, 1);
  const hM = THREE.MathUtils.clamp((beam.heightMm ?? 400) / 1000, 0.05, 1);
  const geo = new THREE.BoxGeometry(len, hM, wM);
  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx + dx / 2, elevM - hM / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dz, dx);
  addEdges(mesh);
  return mesh;
}

export function makeCeilingMesh(
  ceiling: Extract<Element, { kind: 'ceiling' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const elev = elevationMForLevel(ceiling.levelId, elementsById);
  const heightOff = (ceiling.heightOffsetMm ?? 0) / 1000;
  const th = THREE.MathUtils.clamp((ceiling.thicknessMm ?? 50) / 1000, 0.02, 0.5);
  const boundary = ceiling.boundaryMm ?? [];
  const shape = new THREE.Shape(
    boundary.length >= 3
      ? boundary.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000))
      : [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(4, 0),
          new THREE.Vector2(4, -4),
          new THREE.Vector2(0, -4),
        ],
  );
  const geom = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: categoryColorOr(paint, 'floor'),
      roughness: paint?.categories.floor.roughness ?? 0.9,
    }),
  );
  mesh.position.set(0, elev + heightOff, 0);
  mesh.userData.bimPickId = ceiling.id;
  addEdges(mesh, 20);
  return mesh;
}

/**
 * Apply PBR map slots from a MaterialElem onto an existing MeshStandardMaterial.
 * imageAssetsById maps imageAsset id → data URL or blob URL.
 */
export function applyPbrMaps(
  mat: THREE.MeshStandardMaterial,
  materialElem: MaterialElem,
  imageAssetsById: Record<string, string>,
): void {
  const loader = new THREE.TextureLoader();
  const DEFAULT_REPEAT_M = 1;
  const uRepeat = materialElem.uvScaleMm ? materialElem.uvScaleMm.uMm / 1000 : DEFAULT_REPEAT_M;
  const vRepeat = materialElem.uvScaleMm ? materialElem.uvScaleMm.vMm / 1000 : DEFAULT_REPEAT_M;

  function loadSlot(id: string | undefined): THREE.Texture | null {
    if (!id) return null;
    const url = imageAssetsById[id];
    if (!url) return null;
    const tex = loader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(uRepeat, vRepeat);
    if (materialElem.uvRotationDeg) tex.rotation = (materialElem.uvRotationDeg * Math.PI) / 180;
    return tex;
  }

  const albedo = loadSlot(materialElem.albedoMapId);
  if (albedo) mat.map = albedo;

  const normal = loadSlot(materialElem.normalMapId);
  if (normal) mat.normalMap = normal;

  const roughness = loadSlot(materialElem.roughnessMapId);
  if (roughness) mat.roughnessMap = roughness;

  const metallic = loadSlot(materialElem.metallicMapId);
  if (metallic) mat.metalnessMap = metallic;

  mat.needsUpdate = true;
}

/**
 * Build a flat plane mesh representing a decal projected onto a parent surface.
 * The plane is positioned at the uvRect centre on the parentMesh's bounding box face.
 */
export function buildDecalMesh(
  decal: DecalElem,
  parentMesh: THREE.Mesh,
  imageAssetsById: Record<string, string>,
): THREE.Mesh | null {
  const url = imageAssetsById[decal.imageAssetId];
  if (!url) return null;

  const { u0, v0, u1, v1 } = decal.uvRect as {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
  };
  const uSize = u1 - u0;
  const vSize = v1 - v0;

  parentMesh.geometry.computeBoundingBox();
  const bb = parentMesh.geometry.boundingBox ?? new THREE.Box3();
  const sizeX = bb.max.x - bb.min.x;
  const sizeY = bb.max.y - bb.min.y;
  const sizeZ = bb.max.z - bb.min.z;

  const geo = new THREE.PlaneGeometry(uSize * sizeX, vSize * sizeY);

  const tex = new THREE.TextureLoader().load(url);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: decal.opacity ?? 1,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);

  const cx = bb.min.x + (u0 + uSize / 2) * sizeX;
  const cy = bb.min.y + (v0 + vSize / 2) * sizeY;
  const faceZ = decal.parentSurface === 'back' ? bb.min.z - 0.001 : bb.max.z + 0.001;
  mesh.position.set(cx, cy, faceZ);
  if (decal.parentSurface === 'back') mesh.rotation.y = Math.PI;

  mesh.renderOrder = 1;
  void sizeZ;
  return mesh;
}
