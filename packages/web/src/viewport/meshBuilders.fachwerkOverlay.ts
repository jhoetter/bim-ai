import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { resolveMaterial } from './materials';
import { addEdges } from './sceneHelpers';
import { yawForPlanSegment } from './planSegmentOrientation';

/**
 * Issue #111 — half-timbering (Fachwerk) overlay renderer.
 *
 * Authored on a wall as the optional `fachwerkPattern` field. Instead of
 * authoring every Ständer (post), Riegel (rail) and Strebe (diagonal brace)
 * as separate geometry — which would multiply the element count by 30–50
 * for a single facade — this v0 ships an *overlay*: a thin sheet of dark
 * timber rectangles drawn ~10 mm proud of the wall's exterior face.
 *
 * Outputs a group of axis-aligned timber bands in the wall's *local* frame
 * (x along wall length, y vertical, z = +halfT for the exterior face). The
 * caller positions and rotates the group with the same `yaw` it uses on
 * the host wall. The wall's own `materialKey` provides the Gefache infill
 * (brick / plaster) — there is no separate panel mesh.
 *
 * v0 trade-offs (PR body documents these):
 *   • Per-Ständer geometric authoring is deferred — the overlay reads as
 *     relief but isn't IFC-exportable as discrete timber elements yet.
 *   • The overlay sits on a single face (assumed exterior `+halfT`). Walls
 *     with both exterior and interior Fachwerk are not yet supported.
 *   • Diagonals are drawn per-Gefach in the requested direction; complex
 *     Wilder Mann / Mann-Figur patterns are deferred.
 */

type WallElem = Extract<Element, { kind: 'wall' }>;
type FachwerkPattern = NonNullable<WallElem['fachwerkPattern']>;

const DEFAULT_PATTERN: Required<Omit<FachwerkPattern, 'midRailHeightsMm' | 'diagonalsPerPanel'>> & {
  midRailHeightsMm: number[];
  diagonalsPerPanel: NonNullable<FachwerkPattern['diagonalsPerPanel']>;
} = {
  postSpacingMm: 1500,
  postWidthMm: 140,
  railHeightMm: 140,
  sillHeightMm: 200,
  topPlateHeightMm: 200,
  midRailHeightsMm: [],
  diagonalsPerPanel: 'none',
  diagonalWidthMm: 120,
  timberMaterialKey: 'timber_dark_oak',
  proudMm: 10,
};

const FALLBACK_TIMBER_COLOR = '#3a2418';

function resolvedPattern(pattern: FachwerkPattern): typeof DEFAULT_PATTERN {
  return {
    postSpacingMm: pattern.postSpacingMm ?? DEFAULT_PATTERN.postSpacingMm,
    postWidthMm: pattern.postWidthMm ?? DEFAULT_PATTERN.postWidthMm,
    railHeightMm: pattern.railHeightMm ?? DEFAULT_PATTERN.railHeightMm,
    sillHeightMm: pattern.sillHeightMm ?? DEFAULT_PATTERN.sillHeightMm,
    topPlateHeightMm: pattern.topPlateHeightMm ?? DEFAULT_PATTERN.topPlateHeightMm,
    midRailHeightsMm: [...(pattern.midRailHeightsMm ?? [])].sort((a, b) => a - b),
    diagonalsPerPanel: pattern.diagonalsPerPanel ?? DEFAULT_PATTERN.diagonalsPerPanel,
    diagonalWidthMm: pattern.diagonalWidthMm ?? DEFAULT_PATTERN.diagonalWidthMm,
    timberMaterialKey: pattern.timberMaterialKey ?? DEFAULT_PATTERN.timberMaterialKey,
    proudMm: pattern.proudMm ?? DEFAULT_PATTERN.proudMm,
  };
}

/**
 * Compute Ständer (post) centre positions along the wall length so the
 * spacing is rounded to fit evenly inside `[0, wallLengthMm]`, with one
 * post anchoring each endpoint. The number of bays = round(wallLen /
 * spacing), clamped to >=1. Returns post centres in millimetres.
 */
export function fachwerkPostCentresMm(wallLengthMm: number, postSpacingMm: number): number[] {
  if (wallLengthMm <= 0) return [];
  const bays = Math.max(1, Math.round(wallLengthMm / Math.max(1, postSpacingMm)));
  const step = wallLengthMm / bays;
  const out: number[] = [];
  for (let i = 0; i <= bays; i += 1) {
    out.push(i * step);
  }
  return out;
}

interface RawTimberRect {
  /** Horizontal centre (mm), along wall length, 0 at start. */
  uCentreMm: number;
  /** Vertical centre (mm), 0 at wall base. */
  vCentreMm: number;
  /** Width along wall length (mm). */
  widthMm: number;
  /** Height (mm). */
  heightMm: number;
  /** Rotation about the surface normal (radians). 0 = axis-aligned. */
  rotation?: number;
  /** Optional id suffix for debugging. */
  tag?: string;
}

/**
 * Public test helper: compute the list of timber rectangles the overlay
 * will render for a wall of given length/height with the given pattern.
 * Used by vitest to assert post-count + diagonal coverage without spinning
 * up THREE.
 */
export function fachwerkOverlayRectsForTests(
  wallLengthMm: number,
  wallHeightMm: number,
  pattern: FachwerkPattern,
): RawTimberRect[] {
  return buildOverlayRects(wallLengthMm, wallHeightMm, resolvedPattern(pattern));
}

function buildOverlayRects(
  wallLengthMm: number,
  wallHeightMm: number,
  p: typeof DEFAULT_PATTERN,
): RawTimberRect[] {
  const out: RawTimberRect[] = [];
  if (wallLengthMm <= 0 || wallHeightMm <= 0) return out;

  // ── Schwelle (sill) at wall foot ────────────────────────────────────
  if (p.sillHeightMm > 0) {
    out.push({
      uCentreMm: wallLengthMm / 2,
      vCentreMm: p.sillHeightMm / 2,
      widthMm: wallLengthMm,
      heightMm: p.sillHeightMm,
      tag: 'sill',
    });
  }

  // ── Rähm (top plate) at wall top ────────────────────────────────────
  if (p.topPlateHeightMm > 0) {
    out.push({
      uCentreMm: wallLengthMm / 2,
      vCentreMm: wallHeightMm - p.topPlateHeightMm / 2,
      widthMm: wallLengthMm,
      heightMm: p.topPlateHeightMm,
      tag: 'top_plate',
    });
  }

  // ── Mid-rails (Geschossriegel) ──────────────────────────────────────
  const midRails: { vCentreMm: number; heightMm: number }[] = [];
  for (const h of p.midRailHeightsMm) {
    if (h <= 0 || h >= wallHeightMm) continue;
    const halfBand = p.railHeightMm / 2;
    out.push({
      uCentreMm: wallLengthMm / 2,
      vCentreMm: h,
      widthMm: wallLengthMm,
      heightMm: p.railHeightMm,
      tag: 'mid_rail',
    });
    midRails.push({ vCentreMm: h, heightMm: halfBand * 2 });
  }

  // ── Ständer (posts) — full height between sill top and top-plate bottom ─
  const sillTop = p.sillHeightMm;
  const topPlateBottom = Math.max(sillTop, wallHeightMm - p.topPlateHeightMm);
  const postSpanHeight = Math.max(0, topPlateBottom - sillTop);
  const postCentres = fachwerkPostCentresMm(wallLengthMm, p.postSpacingMm);
  if (postSpanHeight > 0) {
    for (const u of postCentres) {
      out.push({
        uCentreMm: u,
        vCentreMm: sillTop + postSpanHeight / 2,
        widthMm: p.postWidthMm,
        heightMm: postSpanHeight,
        tag: 'post',
      });
    }
  }

  // ── Diagonals (Streben) per Gefach panel ────────────────────────────
  if (p.diagonalsPerPanel !== 'none' && postCentres.length >= 2 && postSpanHeight > 0) {
    // Vertical panel divisions: sill-top, midrails (between sill and topPlate), topPlate-bottom.
    const vSplits = [sillTop];
    for (const mr of midRails) {
      const top = mr.vCentreMm + mr.heightMm / 2;
      const bot = mr.vCentreMm - mr.heightMm / 2;
      if (bot > sillTop && top < topPlateBottom) {
        vSplits.push(bot);
        vSplits.push(top);
      }
    }
    vSplits.push(topPlateBottom);
    // Sort + dedupe so we walk strictly-increasing rows.
    const rowEdges = Array.from(new Set(vSplits.map((v) => +v.toFixed(3)))).sort((a, b) => a - b);

    for (let bay = 0; bay < postCentres.length - 1; bay += 1) {
      const uLeft = postCentres[bay] + p.postWidthMm / 2;
      const uRight = postCentres[bay + 1] - p.postWidthMm / 2;
      const panelW = uRight - uLeft;
      if (panelW <= p.diagonalWidthMm) continue;
      for (let row = 0; row < rowEdges.length - 1; row += 1) {
        const vBot = rowEdges[row];
        const vTop = rowEdges[row + 1];
        const panelH = vTop - vBot;
        if (panelH <= p.diagonalWidthMm) continue;
        const cx = (uLeft + uRight) / 2;
        const cy = (vBot + vTop) / 2;
        const diagLen = Math.hypot(panelW, panelH);
        const angle = Math.atan2(panelH, panelW); // diagonal "/" angle from horizontal
        const dirs: Array<'left' | 'right'> = (() => {
          switch (p.diagonalsPerPanel) {
            case 'left':
              return ['left'];
            case 'right':
              return ['right'];
            case 'vee':
              // Alternating per bay: classic fußstrebe pair pattern.
              return [bay % 2 === 0 ? 'left' : 'right'];
            case 'andreas_kreuz':
              return ['left', 'right'];
            default:
              return [];
          }
        })();
        for (const dir of dirs) {
          out.push({
            uCentreMm: cx,
            vCentreMm: cy,
            widthMm: diagLen,
            heightMm: p.diagonalWidthMm,
            rotation: dir === 'left' ? -angle : angle,
            tag: `diagonal_${dir}`,
          });
        }
      }
    }
  }

  return out;
}

/**
 * Build a group of timber-band meshes in the wall's local frame:
 *   • x runs along wall length (start → end), origin at wall midpoint.
 *   • y is vertical (0 at wall base).
 *   • z is perpendicular to the wall plane; we draw on +z (exterior) at
 *     `+halfThickM + proudM`.
 *
 * The returned group is centred on the wall midpoint at y=0 — apply the
 * wall's yaw + world position to place it. (See useViewportSceneEffects:
 * the host wall mesh applies the same transform.)
 */
export function makeFachwerkOverlayMeshLocal(
  wall: WallElem,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;
  group.userData.fachwerkOverlay = true;
  group.userData.isOverlay = true;
  group.name = `fachwerk-overlay:${wall.id}`;

  const pattern = wall.fachwerkPattern;
  if (!pattern) return group;

  const resolved = resolvedPattern(pattern);
  const wallLenMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
  const wallHeightMm = wall.heightMm;
  const halfThickM = Math.max(0.025, wall.thicknessMm / 2000); // mirror clamp used elsewhere
  const proudM = resolved.proudMm / 1000;
  const zM = halfThickM + proudM;
  // Tag the group with the offset so tests can verify the overlay sits proud.
  group.userData.proudMm = resolved.proudMm;
  group.userData.overlayZM = zM;

  const matSpec = resolveMaterial(resolved.timberMaterialKey);
  const color = matSpec?.baseColor ?? FALLBACK_TIMBER_COLOR;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: matSpec?.roughness ?? 0.85,
    metalness: matSpec?.metalness ?? 0,
  });
  void paint;

  const rects = buildOverlayRects(wallLenMm, wallHeightMm, resolved);
  // Each timber band is a *thin slab* — depth (along world-Z, post-rotation)
  // is a constant ~30 mm so it reads as relief in shaded views and shows up
  // in the wireframe pass.
  const SLAB_DEPTH_M = 0.03;

  for (const r of rects) {
    const widthM = Math.max(0.001, r.widthMm / 1000);
    const heightM = Math.max(0.001, r.heightMm / 1000);
    const geom = new THREE.BoxGeometry(widthM, heightM, SLAB_DEPTH_M);
    const mesh = new THREE.Mesh(geom, material);
    // local x: along wall, centred on wall midpoint, so subtract half wallLen.
    const xLocal = r.uCentreMm / 1000 - wallLenMm / 2000;
    const yLocal = r.vCentreMm / 1000;
    mesh.position.set(xLocal, yLocal, zM);
    if (r.rotation) {
      // Rotation about the wall-face normal (z axis in local frame).
      mesh.rotation.z = r.rotation;
    }
    mesh.userData.bimPickId = wall.id;
    mesh.userData.fachwerkTag = r.tag ?? 'timber';
    addEdges(mesh);
    group.add(mesh);
  }

  return group;
}

/**
 * Convenience world-space wrapper: builds the local overlay group and
 * applies the wall's plan-yaw + midpoint translation. The renderer can
 * either call this directly (and add to scene root) or call
 * `makeFachwerkOverlayMeshLocal` and parent it next to the wall mesh.
 */
export function makeFachwerkOverlayMesh(
  wall: WallElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const local = makeFachwerkOverlayMeshLocal(wall, paint);
  if (local.children.length === 0) {
    // Nothing to draw — bail out cheaply.
    return local;
  }
  const dx = wall.end.xMm - wall.start.xMm;
  const dz = wall.end.yMm - wall.start.yMm;
  const yaw = yawForPlanSegment(dx, dz);
  const cxM = (wall.start.xMm + wall.end.xMm) / 2 / 1000;
  const czM = (wall.start.yMm + wall.end.yMm) / 2 / 1000;
  const outer = new THREE.Group();
  outer.userData.bimPickId = wall.id;
  outer.userData.fachwerkOverlay = true;
  outer.userData.isOverlay = true;
  outer.name = `fachwerk-overlay-world:${wall.id}`;
  outer.position.set(cxM, elevM, czM);
  outer.rotation.y = yaw;
  outer.add(local);
  return outer;
}
