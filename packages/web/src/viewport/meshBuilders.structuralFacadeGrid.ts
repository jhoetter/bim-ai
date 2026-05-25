import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { addEdges } from './sceneHelpers';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

/**
 * Issue #113 — Huf-Haus Pfosten-Riegel-Strukturfassade renderer.
 *
 * Builds a flat lattice of dark timber members in front of a host wall:
 *
 *   • Vertical posts (Pfosten) at `postSpacingMm` along the wall.
 *   • Horizontal beams (Riegel) at the user-supplied `beamHeights` plus
 *     the wall foot (0) and the wall head (heightMm). Anything outside
 *     the wall span is clamped silently.
 *   • Optional diagonal struts (Streben):
 *       - "none"   — no diagonals (posts + beams only).
 *       - "single" — one diagonal per bay, sloped low-left → high-right.
 *       - "cross"  — two diagonals per bay forming an X.
 *
 * Each member is a thin box (~`memberThicknessMm` thick, default 80mm) that
 * sits `proudOffsetMm` (default 30mm) in front of the wall's outward normal.
 * The grid's bay infill is rendered as a single transparent glass quad
 * spanning the wall face so the silhouette reads as "glass behind a dark
 * timber raster" — the signature Huf-Haus appearance.
 *
 * v0 trade-offs:
 *   • Rectangular wall faces only (curved walls fall back to start→end
 *     straight-line span).
 *   • The host wall behind the grid is not transparency-coerced — projects
 *     are expected to set the host wall's material to a glass / clear key
 *     when authoring this element. The infill quad provides a fallback so
 *     a stucco/render wall still looks plausible behind the lattice.
 *   • IFC export is deferred.
 */

const DEFAULT_MEMBER_THICKNESS_MM = 80;
const DEFAULT_PROUD_OFFSET_MM = 30;
const DEFAULT_TIMBER_KEY = 'dark_oak';
const DEFAULT_INFILL_KEY = 'glass_clear';

const _warnedGridIds = new Set<string>();

/** TEST-ONLY — reset the warning dedupe so a test can assert the warning fires. */
export function _resetStructuralFacadeGridWarningsForTests(): void {
  _warnedGridIds.clear();
}

function warnEmptyGrid(id: string, reason: string): void {
  if (_warnedGridIds.has(id)) return;
  _warnedGridIds.add(id);
  console.warn(
    `[meshBuilders.structuralFacadeGrid] structural_facade_grid "${id}" produced no visible geometry: ${reason}. See issue #113.`,
  );
}

type StructuralFacadeGridElem = Extract<Element, { kind: 'structural_facade_grid' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;

/** Internal — normalise the `beamHeights` list against the wall span.
 *  Always returns a sorted, de-duplicated list including 0 + wallHeightMm. */
export function _normaliseBeamHeights(
  rawHeights: readonly number[] | null | undefined,
  wallHeightMm: number,
): number[] {
  const set = new Set<number>();
  set.add(0);
  set.add(wallHeightMm);
  for (const h of rawHeights ?? []) {
    if (!Number.isFinite(h)) continue;
    if (h < 0 || h > wallHeightMm) continue;
    // Quantise to 1mm so near-duplicates collapse.
    set.add(Math.round(h));
  }
  const out = Array.from(set).sort((a, b) => a - b);
  return out;
}

/**
 * Internal — enumerate the post X positions (mm-from-wall-start) for the
 * given wall length and `postSpacingMm`. The first post sits at 0; the last
 * post is snapped to `wallLengthMm` so the grid always frames the corners.
 */
export function _enumeratePostXs(wallLengthMm: number, postSpacingMm: number): number[] {
  if (wallLengthMm <= 0) return [0];
  const spacing = Math.max(100, postSpacingMm);
  // ceil so a 6000mm wall at 1500 spacing → 4 bays / 5 posts including ends.
  const bayCount = Math.max(1, Math.ceil(wallLengthMm / spacing));
  const xs: number[] = [];
  for (let i = 0; i <= bayCount; i += 1) {
    xs.push((wallLengthMm * i) / bayCount);
  }
  return xs;
}

interface MemberSpec {
  /** Wall-local: along-axis start (mm from wall start). */
  u0: number;
  /** Wall-local: along-axis end (mm from wall start). */
  u1: number;
  /** Wall-local: vertical start (mm from wall foot). */
  y0: number;
  /** Wall-local: vertical end (mm from wall foot). */
  y1: number;
  /** Member id for picking — '<gridId>::<kind>::<index>'. */
  partId: string;
}

/**
 * Internal — enumerate every visible member (post, beam, diagonal) for the
 * given grid. Each spec is a line in wall-local 2D (u along the wall foot,
 * y up); the renderer turns each into a thin box.
 */
export function _enumerateMembers(grid: StructuralFacadeGridElem, wall: WallElem): MemberSpec[] {
  const wallLengthMm = Math.max(
    0,
    Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm),
  );
  const wallHeightMm = Math.max(0, wall.heightMm);
  if (wallLengthMm <= 0 || wallHeightMm <= 0) return [];

  const xs = _enumeratePostXs(wallLengthMm, grid.postSpacingMm);
  const ys = _normaliseBeamHeights(grid.beamHeights, wallHeightMm);

  const out: MemberSpec[] = [];

  // Posts — one full-height vertical line at each x.
  for (let i = 0; i < xs.length; i += 1) {
    out.push({
      u0: xs[i],
      u1: xs[i],
      y0: 0,
      y1: wallHeightMm,
      partId: `${grid.id}::post::${i}`,
    });
  }

  // Beams — one full-width horizontal line at each y.
  for (let j = 0; j < ys.length; j += 1) {
    out.push({
      u0: 0,
      u1: wallLengthMm,
      y0: ys[j],
      y1: ys[j],
      partId: `${grid.id}::beam::${j}`,
    });
  }

  // Diagonals — one or two per bay (i, j) → (i+1, j+1).
  if (grid.diagonalStrutPattern !== 'none') {
    for (let i = 0; i + 1 < xs.length; i += 1) {
      for (let j = 0; j + 1 < ys.length; j += 1) {
        const ul = xs[i];
        const ur = xs[i + 1];
        const yb = ys[j];
        const yt = ys[j + 1];
        // "single" — low-left → high-right.
        out.push({
          u0: ul,
          u1: ur,
          y0: yb,
          y1: yt,
          partId: `${grid.id}::strut::${i}-${j}`,
        });
        if (grid.diagonalStrutPattern === 'cross') {
          // second leg — high-left → low-right.
          out.push({
            u0: ul,
            u1: ur,
            y0: yt,
            y1: yb,
            partId: `${grid.id}::strut::${i}-${j}-x`,
          });
        }
      }
    }
  }

  return out;
}

/** Build a single thin-box member from a wall-local line spec. */
function buildMemberMesh(
  spec: MemberSpec,
  wall: WallElem,
  proudM: number,
  thickM: number,
  material: THREE.Material,
): THREE.Mesh {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const wallLenM = Math.max(1e-3, Math.hypot(dx, dz));
  const ux = dx / wallLenM;
  const uz = dz / wallLenM;
  // Outward normal in plan: rotate tangent +90°.
  const nx = uz;
  const nz = -ux;

  const du = (spec.u1 - spec.u0) / 1000;
  const dy = (spec.y1 - spec.y0) / 1000;
  const memberLenM = Math.max(1e-3, Math.hypot(du, dy));
  const memberCentreU = (spec.u0 + spec.u1) / 2 / 1000;
  const memberCentreY = (spec.y0 + spec.y1) / 2 / 1000;

  // The member is a box of size (memberLenM, thickM, thickM). We orient it so
  // the long axis lies along the wall-local (u, y) direction, then yaw the
  // whole thing so wall-u runs along the wall tangent in world XZ.
  const geom = new THREE.BoxGeometry(memberLenM, thickM, thickM);
  // Tilt the long axis within the wall plane: arctan(dy / du) about the
  // wall-tangent axis. After this rotation, +X-local is the member's length
  // direction in the wall plane.
  const rotAroundLocal = Math.atan2(dy, du);
  geom.rotateZ(rotAroundLocal);

  // Position the member centre in world coords:
  //   centreX = sx + ux * memberCentreU + nx * proudM
  //   centreY = wallBase + memberCentreY
  //   centreZ = sz + uz * memberCentreU + nz * proudM
  const centreX = sx + ux * memberCentreU + nx * proudM;
  const centreZ = sz + uz * memberCentreU + nz * proudM;

  const mesh = new THREE.Mesh(geom, material);
  // Yaw the box so its local +X (which currently points along world +X) aligns
  // with the wall tangent in world XZ. wallYaw = atan2(dz, dx).
  mesh.rotation.y = -Math.atan2(dz, dx);
  // The wall base elevation is handled by the parent group's translation; here
  // we just lift the member to its (u, y) centre relative to that base.
  mesh.position.set(centreX, memberCentreY, centreZ);
  mesh.userData.bimPickId = spec.partId;
  return mesh;
}

/** Build a translucent infill quad covering the whole wall face, sitting
 *  slightly in front of the wall plane but BEHIND the timber lattice. */
function buildInfillQuad(
  wall: WallElem,
  proudM: number,
  material: THREE.Material,
  gridId: string,
): THREE.Mesh {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const wallLenM = Math.max(1e-3, Math.hypot(dx, dz));
  const wallHeightM = Math.max(1e-3, wall.heightMm / 1000);
  const ux = dx / wallLenM;
  const uz = dz / wallLenM;
  const nx = uz;
  const nz = -ux;

  // Plane in front of the wall — sits at half the proud offset so it visually
  // backs the timber lattice without z-fighting the wall.
  const infillProud = Math.max(1e-3, proudM * 0.5);

  const geom = new THREE.PlaneGeometry(wallLenM, wallHeightM);
  // PlaneGeometry's normal is +Z by default. Yaw it to match the wall.
  const mesh = new THREE.Mesh(geom, material);
  mesh.rotation.y = -Math.atan2(dz, dx);
  // Centre of the wall face in world coordinates:
  const centreU = wallLenM / 2;
  const centreY = wallHeightM / 2;
  const centreX = sx + ux * centreU + nx * infillProud;
  const centreZ = sz + uz * centreU + nz * infillProud;
  mesh.position.set(centreX, centreY, centreZ);
  mesh.userData.bimPickId = `${gridId}::infill`;
  return mesh;
}

export function makeStructuralFacadeGridMesh(
  grid: StructuralFacadeGridElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = grid.id;
  group.userData.bimGridKind = 'huf_haus_structural_facade';

  const wallCandidate = elementsById[grid.hostWallId];
  const wall: WallElem | null = wallCandidate?.kind === 'wall' ? wallCandidate : null;

  if (!wall) {
    warnEmptyGrid(
      grid.id,
      `host wall "${grid.hostWallId}" missing or not a wall element (invisible placeholder rendered)`,
    );
    group.userData.isAuthoringPlaceholder = true;
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

  // Lift the whole group to the host wall's foot elevation so beam y=0 aligns
  // with the wall foot, not the world origin. Levels live on the WallElem.
  const lvl = elementsById[wall.levelId];
  const baseY = lvl?.kind === 'level' ? lvl.elevationMm / 1000 : 0;
  const baseOffset = (wall.baseConstraintOffsetMm ?? 0) / 1000;
  group.position.y = baseY + baseOffset;

  const memberThickMm = Math.max(10, grid.memberThicknessMm ?? DEFAULT_MEMBER_THICKNESS_MM);
  const proudMm = Math.max(0, grid.proudOffsetMm ?? DEFAULT_PROUD_OFFSET_MM);
  const thickM = memberThickMm / 1000;
  const proudM = proudMm / 1000;

  const timberKey = grid.timberMaterialKey ?? DEFAULT_TIMBER_KEY;
  const infillKey = grid.infillMaterialKey ?? DEFAULT_INFILL_KEY;

  const timberMaterial = makeThreeMaterialForKey(timberKey, {
    elementsById,
    usage: 'generic',
    fallbackColor: '#3b2a1a',
    fallbackRoughness: 0.88,
    fallbackMetalness: 0,
  });
  const infillMaterial = makeThreeMaterialForKey(infillKey, {
    elementsById,
    usage: 'generic',
    fallbackColor: '#b8d6e6',
    fallbackRoughness: 0.05,
    fallbackMetalness: 0,
    side: THREE.DoubleSide,
  });
  // Make the infill genuinely translucent so the silhouette reads as glass.
  if (infillMaterial instanceof THREE.MeshStandardMaterial) {
    infillMaterial.transparent = true;
    if (infillMaterial.opacity > 0.6) {
      infillMaterial.opacity = 0.35;
    }
    infillMaterial.depthWrite = false;
  }

  // Infill first so the lattice z-renders on top of it.
  const infill = buildInfillQuad(wall, proudM, infillMaterial, grid.id);
  group.add(infill);

  const specs = _enumerateMembers(grid, wall);
  for (const spec of specs) {
    const mesh = buildMemberMesh(spec, wall, proudM, thickM, timberMaterial);
    addEdges(mesh);
    group.add(mesh);
  }

  if (group.children.length === 0) {
    warnEmptyGrid(grid.id, 'group has zero children after build');
  }

  void paint;
  return group;
}
