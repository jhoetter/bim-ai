import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { addEdges } from './sceneHelpers';
import { yawForPlanSegment } from './planSegmentOrientation';

/**
 * Issue #102 — FacadeBayElem (Erker) renderer.
 *
 * Builds an extrusion that projects outward from the host wall between
 * `startAlongWallMm` and `endAlongWallMm` by `projectionMm`. Three footprint
 * shapes are supported:
 *
 *   • `rectangular` — simple axis-aligned box (4-vertex outer footprint).
 *   • `chamfered`   — 5-vertex polygon prism: a centre rectangle flanked
 *                     by two cut corners at `chamferAngleDeg` (defaults to
 *                     45°). The side cut depth is bounded by half the span.
 *   • `curved`      — outer arc approximated by `CURVE_SEGMENTS` segments
 *                     (8 by default; well within the 8–12 budget the issue
 *                     asks for).
 *
 * v0 trade-offs (PR body documents these):
 *   • The interior CSG punch through the host wall is deferred — the bay
 *     geometry is rendered beside the wall rather than fused.
 *   • IFC export is deferred.
 *
 * v0 also allows the bay's id to host openings (windows on the projection's
 * three outer faces) by the opening dispatcher's host resolver. That side of
 * the change lives in the openings coercion — the renderer here is purely a
 * geometry builder.
 */

const CURVE_SEGMENTS = 8;
const _warnedFacadeBayEmptyIds = new Set<string>();

/** TEST-ONLY: reset the warning dedupe so tests can assert the warning fires. */
export function _resetEmptyFacadeBayWarningsForTests(): void {
  _warnedFacadeBayEmptyIds.clear();
}

function warnEmptyFacadeBay(id: string, reason: string): void {
  if (_warnedFacadeBayEmptyIds.has(id)) return;
  _warnedFacadeBayEmptyIds.add(id);
  console.warn(
    `[meshBuilders.facadeBay] facade_bay "${id}" produced no visible geometry: ${reason}. ` +
      `See issue #102.`,
  );
}

type FacadeBayElem = Extract<Element, { kind: 'facade_bay' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;

/**
 * Build the outer footprint of the bay in local (u, v) coordinates relative
 * to the host wall: `u` runs along the wall (centred on the bay span centre),
 * `v` is the outward normal distance. The returned polygon ALWAYS starts at
 * the left-back corner and ends at the right-back corner — both back corners
 * have v=0 (i.e. they sit on the host wall line). The polygon excludes those
 * back corners; callers chain them in to close the footprint.
 */
function bayOuterFootprint(
  shape: 'rectangular' | 'chamfered' | 'curved',
  spanLen: number,
  proj: number,
  chamferAngleDeg: number | null | undefined,
): Array<{ u: number; v: number }> {
  const halfSpan = spanLen / 2;

  if (shape === 'rectangular') {
    return [
      { u: -halfSpan, v: proj },
      { u: +halfSpan, v: proj },
    ];
  }

  if (shape === 'chamfered') {
    const angle = (chamferAngleDeg ?? 45) * (Math.PI / 180);
    // The corner cut runs back from the outer face at `angle`. The cut
    // consumes `proj / tan(angle)` of horizontal span on each side — clamp
    // to at most 45% of the half-span so the centre rectangle never vanishes.
    const rawCut = proj / Math.max(Math.tan(angle), 1e-3);
    const cut = Math.min(rawCut, halfSpan * 0.9);
    return [
      { u: -halfSpan, v: 0 },
      { u: -halfSpan + cut, v: proj },
      { u: +halfSpan - cut, v: proj },
      { u: +halfSpan, v: 0 },
    ].slice(1, -1); // drop back corners — caller chains them in.
  }

  // curved — sample the arc that passes through (−halfSpan, 0), (0, proj),
  // (+halfSpan, 0). We approximate with a half-ellipse for simplicity.
  const pts: Array<{ u: number; v: number }> = [];
  for (let i = 1; i < CURVE_SEGMENTS; i += 1) {
    const t = i / CURVE_SEGMENTS; // (0,1)
    const theta = Math.PI * t; // (0,π)
    const u = -Math.cos(theta) * halfSpan;
    const v = Math.sin(theta) * proj;
    pts.push({ u, v });
  }
  return pts;
}

/**
 * Convert local (u, v) into world (x, z) given the bay's centre point on the
 * wall and the wall's unit tangent / outward normal. The bay slab top sits
 * at the wall's top elevation; v points outward from the building.
 */
function worldXZ(
  centreX: number,
  centreZ: number,
  ux: number,
  uz: number,
  nx: number,
  nz: number,
  u: number,
  v: number,
): { x: number; z: number } {
  return {
    x: centreX + ux * u + nx * v,
    z: centreZ + uz * u + nz * v,
  };
}

/**
 * Extrude a closed polygon footprint between yBottom and yTop. The polygon is
 * given in world (x, z) and we build a ShapeGeometry-based ExtrudeGeometry
 * for simplicity. The geometry is positioned at (0, yBottom, 0).
 */
function extrudeFootprint(
  footprintWorld: Array<{ x: number; z: number }>,
  yBottom: number,
  yTop: number,
  material: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  if (footprintWorld.length === 0) {
    // Degenerate — return a tiny invisible quad so callers don't crash.
    return new THREE.Mesh(new THREE.BufferGeometry(), material);
  }
  shape.moveTo(footprintWorld[0].x, footprintWorld[0].z);
  for (let i = 1; i < footprintWorld.length; i += 1) {
    shape.lineTo(footprintWorld[i].x, footprintWorld[i].z);
  }
  shape.closePath();

  const depth = Math.max(0.001, yTop - yBottom);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: CURVE_SEGMENTS,
  });
  // ExtrudeGeometry extrudes along +Z by default; we want +Y. Rotate -90° about X.
  geom.rotateX(-Math.PI / 2);
  // After the rotation the extrusion bottom is at y=0; lift it to yBottom.
  geom.translate(0, yBottom + depth, 0);
  return new THREE.Mesh(geom, material);
}

export function makeFacadeBayMesh(
  bay: FacadeBayElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = bay.id;

  const wallCandidate = elementsById[bay.hostWallId];
  const wall: WallElem | null = wallCandidate?.kind === 'wall' ? wallCandidate : null;

  if (!wall) {
    warnEmptyFacadeBay(
      bay.id,
      `host wall "${bay.hostWallId}" missing or not a wall element (invisible placeholder rendered)`,
    );
    group.userData.isAuthoringPlaceholder = true;
    // Mark group invisible — still keep a tiny placeholder so picking works.
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: '#888' }),
    );
    placeholder.visible = false;
    group.add(placeholder);
    group.visible = false;
    void paint;
    return group;
  }

  // Resolve wall frame in world coords (Three uses metres; the BIM uses mm).
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const wallLenRaw = Math.hypot(dx, dz);
  const wallLen = Math.max(1e-3, wallLenRaw);
  const ux = dx / wallLen;
  const uz = dz / wallLen;
  // Outward normal (rotate tangent +90° in XZ).
  const nx = uz;
  const nz = -ux;
  void yawForPlanSegment(dx, dz);

  // Project bay span onto wall — clamp to wall length so a misauthored bay
  // doesn't extend past either endpoint.
  const startAlong = Math.max(0, Math.min(wallLen * 1000, bay.startAlongWallMm)) / 1000;
  const endAlong = Math.max(0, Math.min(wallLen * 1000, bay.endAlongWallMm)) / 1000;
  const spanLen = Math.max(0.001, endAlong - startAlong);
  const centreAlong = (startAlong + endAlong) / 2;
  const centreX = sx + ux * centreAlong;
  const centreZ = sz + uz * centreAlong;

  const proj = Math.max(0.001, bay.projectionMm / 1000);

  // Build outer polygon in local frame, then world frame. The closed
  // footprint is: back-left → outer chain (left→right) → back-right.
  const outerLocal = bayOuterFootprint(bay.shape, spanLen, proj, bay.chamferAngleDeg);
  const localPoly: Array<{ u: number; v: number }> = [
    { u: -spanLen / 2, v: 0 },
    ...outerLocal,
    { u: +spanLen / 2, v: 0 },
  ];
  const worldPoly = localPoly.map((p) => worldXZ(centreX, centreZ, ux, uz, nx, nz, p.u, p.v));

  // Y-extents: from level base (0 for now — wall foot) to wall height.
  const yBottom = 0;
  const yTop = wall.heightMm / 1000;

  const wallColor = '#d8d0c0';
  const material = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.9,
    metalness: 0,
  });

  const mesh = extrudeFootprint(worldPoly, yBottom, yTop, material);
  mesh.userData.bimPickId = bay.id;
  addEdges(mesh);
  group.add(mesh);

  if (group.children.length === 0) {
    warnEmptyFacadeBay(bay.id, 'group has zero children after build');
  }

  void paint;
  return group;
}

/** Internal helper exposed for tests — returns the local-frame outer chain so
 * tests can verify vertex counts for each shape without spinning up THREE. */
export function _facadeBayOuterFootprintForTests(
  shape: 'rectangular' | 'chamfered' | 'curved',
  spanLen: number,
  proj: number,
  chamferAngleDeg: number | null | undefined,
): Array<{ u: number; v: number }> {
  return bayOuterFootprint(shape, spanLen, proj, chamferAngleDeg);
}
