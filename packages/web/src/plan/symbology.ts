import * as THREE from 'three';

import type { Element, PlanLinePatternToken } from '@bim-ai/core';

import { liveTokenReader } from '../viewport/materials';
import {
  coerceVec2Mm,
  isPlanProjectionPrimitivesV1,
  type PlanAnnotationHintsResolved,
  type PlanGraphicHintsResolved,
  type PlanProjectionPrimitivesV1Wire,
} from './planProjectionWire';
import {
  planWallMesh,
  doorGroupThree,
  planWindowMesh,
  stairPlanThree,
  roomMesh,
  planAnnotationLabelSprite,
  gridLineThree,
  dimensionsThree,
} from './planElementMeshBuilders';

/** Plan slice elevation in world units (walls still render with real height elsewhere). */

export const PLAN_Y = 0.02;

/* ────────────────────────────────────────────────────────────────────── */
/* Plan palette — token-driven colors used in plan symbology.              */
/*                                                                          */
/* Read once per render (via getPlanPalette) so that a theme switch picks   */
/* up updated `:root` custom-property values. Each token has a defensive    */
/* fallback used when the live document has no stylesheet attached (SSR /   */
/* jsdom-without-tokens).                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export interface PlanPalette {
  wallFill: string;
  wallSelected: string;
  doorFill: string;
  doorSelected: string;
  doorSwing: string;
  doorSwingFocus: string;
  windowFill: string;
  windowSelected: string;
  windowSelectedBackline: string;
  windowFillBackline: string;
  windowGlass: string;
  windowGlassFocus: string;
  floorOutline: string;
  roofOutline: string;
  roomBoundary: string;
  roomLabel: string;
  dimLine: string;
  dimWitness: string;
  dimAlt: string;
  tagBg: string;
  tagText: string;
  regionFill: string;
  regionFillStrong: string;
  hairline: string;
  hairlineStrong: string;
}

export function readToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

export function getPlanPalette(): PlanPalette {
  return {
    wallFill: readToken('--cat-wall', '#94a3b8'),
    wallSelected: readToken('--color-accent', '#fb923c'),
    doorFill: readToken('--cat-door', '#67e8f9'),
    doorSelected: readToken('--color-accent', '#fde047'),
    doorSwing: readToken('--draft-construction-blue', '#0ea5e9'),
    doorSwingFocus: readToken('--draft-hover', '#bae6fd'),
    windowFill: readToken('--cat-window', '#9333ea'),
    windowSelected: readToken('--color-accent', '#ddd6fe'),
    windowSelectedBackline: readToken('--color-accent', '#c4b5fd'),
    windowFillBackline: readToken('--cat-window', '#a78bfa'),
    windowGlass: readToken('--cat-window', '#7c3aed'),
    windowGlassFocus: readToken('--draft-hover', '#f5d0fe'),
    floorOutline: readToken('--cat-floor', '#22c55e'),
    roofOutline: readToken('--cat-roof', '#f97316'),
    roomBoundary: readToken('--cat-room', '#a855f7'),
    roomLabel: readToken('--color-foreground', '#0f172a'),
    dimLine: readToken('--draft-construction-blue', '#0ea5e9'),
    dimWitness: readToken('--draft-witness', '#64748b'),
    dimAlt: readToken('--color-warning', '#facc15'),
    tagBg: readToken('--color-surface', '#1e293b'),
    tagText: readToken('--color-foreground', '#0f172a'),
    regionFill: readToken('--draft-construction-blue', '#3b82f6'),
    regionFillStrong: readToken('--draft-construction-blue', '#1d4ed8'),
    hairline: readToken('--color-border', '#e2e8f0'),
    hairlineStrong: readToken('--color-border-strong', '#94a3b8'),
  };
}

/** World-space dash gaps for plan linework (grid, room separation) from server tokens. */

export function planLinePatternDashWorldUnits(
  token: string | null | undefined,
): { dashSize: number; gapSize: number } | null {
  const t = (token ?? 'solid') as PlanLinePatternToken;
  switch (t) {
    case 'solid':
      return null;
    case 'dash_short':
      return { dashSize: 0.06, gapSize: 0.04 };
    case 'dash_long':
      return { dashSize: 0.12, gapSize: 0.06 };
    case 'dot':
      return { dashSize: 0.02, gapSize: 0.05 };
    default:
      return null;
  }
}

/** Documentation-style plan projection knobs (WP-C01/C02/C03). */

export const PLAN_SLICE_ELEVATION_M = PLAN_Y;

/** Thin wall prism at the active cut — reads lighter than volumetric extrusions elsewhere. */

export const PLAN_WALL_CENTER_SLICE_HEIGHT_M = 0.048;

export const PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT = 2.2;

export const PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS = 1.95;

export const PLAN_WINDOW_SILL_LINE_WIDTH = 1.2;

/** Section viewport SVG documentation knobs (WP-E04/C03). Baseline matches historical 600px minor axis. */

export const SECTION_VIEWPORT_SCALE_BASELINE_PX = 600;

export const SECTION_VIEWPORT_LABEL_FONT_MIN_PX = 9;

export const SECTION_VIEWPORT_LABEL_FONT_MAX_PX = 15;

export const SECTION_VIEWPORT_STROKE_SCALE_MIN = 0.65;

export const SECTION_VIEWPORT_STROKE_SCALE_MAX = 1.35;

export const SECTION_VIEWPORT_OPENING_TAG_MIN_PX = 14;

/** Min viewport minor axis (px) before drawing `sectionDocMaterialHints` labels (WP-E04/C03). */

export const SECTION_VIEWPORT_MATERIAL_HINT_MIN_VIEW_PX = 20;

export const SECTION_VIEWPORT_ADVISORY_MAX_CHARS = 96;

/** Tile size (px) for edge-on (cut-through) wall hatch in section viewport SVG (WP-E04/C03). */

export const SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE = 10;

/** Tile size (px) for along-cut wall hatch (slightly wider spacing vs edge-on). */

export const SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE = 12;

/** Along-cut hatch stroke width factor vs edge-on (subtle contrast vs slab pattern). */

export const SECTION_VIEWPORT_WALL_HATCH_ALONG_STROKE_FACTOR = 0.82;

/** Right inset for elevation-span documentation bracket (section viewport SVG, WP-E04/C03). */

export const SECTION_VIEWPORT_LEVEL_SPAN_BRACKET_MARGIN_PX = 22;

/** Minimum label size for Δz elevation-span annotation in section viewport. */

export const SECTION_VIEWPORT_LEVEL_SPAN_LABEL_MIN_PX = 8;

/** Bottom inset for along-cut (Δu) documentation bracket in section viewport SVG (WP-E04/C03). */

export const SECTION_VIEWPORT_U_SPAN_BRACKET_MARGIN_PX = 40;

/** Minimum label size for Δu along-cut span annotation in section viewport. */

export const SECTION_VIEWPORT_U_SPAN_LABEL_MIN_PX = 8;

export function ux(xMm: number) {
  return xMm / 1000;
}

export function uz(yMm: number) {
  return yMm / 1000;
}

export function segmentDir(wall: Extract<Element, { kind: 'wall' }>) {
  const dx = ux(wall.end.xMm - wall.start.xMm);

  const dz = uz(wall.end.yMm - wall.start.yMm);

  const len = Math.max(1e-6, Math.hypot(dx, dz));

  return {
    lenM: len,

    nx: dx / len,

    nz: dz / len,
  };
}

export function centroidMm(poly: Array<{ xMm: number; yMm: number }>): {
  xMm: number;
  yMm: number;
} {
  let sx = 0;

  let sy = 0;

  for (const p of poly) {
    sx += p.xMm;

    sy += p.yMm;
  }

  const n = Math.max(1, poly.length);

  return { xMm: sx / n, yMm: sy / n };
}

export function polygonAreaMm2(poly: Array<{ xMm: number; yMm: number }>): number {
  let a = 0;

  const n = poly.length;

  if (n < 3) return 0;

  for (let i = 0; i < n; i++) {
    const p = poly[i]!;

    const q = poly[(i + 1) % n]!;

    a += p.xMm * q.yMm - q.xMm * p.yMm;
  }

  return Math.abs(a / 2);
}

function horizontalOutlineMesh(
  outlineMm: Array<{ xMm: number; yMm: number }>,
  yWorld: number,
  color: string,
  opacity: number,
  pickId: string,
): THREE.Mesh {
  const shape = new THREE.Shape();

  const o = outlineMm[0];

  if (!o) return new THREE.Mesh();

  shape.moveTo(ux(o.xMm), -uz(o.yMm));

  for (let i = 1; i < outlineMm.length; i++) {
    const p = outlineMm[i];

    if (p) shape.lineTo(ux(p.xMm), -uz(p.yMm));
  }

  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color,

      transparent: true,

      opacity,

      depthWrite: false,
    }),
  );

  mesh.rotation.x = -Math.PI / 2;

  mesh.position.y = yWorld;

  mesh.userData.bimPickId = pickId;

  return mesh;
}

const PLAN_FLOOR_FILL_OPACITY_BASE = 0.16;

const PLAN_ROOF_FILL_OPACITY_BASE = 0.2;

/** Wire-path floor/roof: category-weighted fill + closed outline stroke (pattern from server). */
function planFloorRoofOutlineWireGroup(
  outlineMm: Array<{ xMm: number; yMm: number }>,
  opts: {
    kind: 'floor' | 'roof';
    pickId: string;
    lineWeightHint: number;
    linePatternToken?: string | null;
    roofGeometrySupportToken?: string | null;
  },
): THREE.Group {
  const grp = new THREE.Group();
  const palette = getPlanPalette();
  const color = opts.kind === 'floor' ? palette.floorOutline : palette.roofOutline;
  const fillY = opts.kind === 'floor' ? PLAN_Y + 0.001 : PLAN_Y + 0.004;
  const strokeY = fillY + 0.0004;
  const baseOp = opts.kind === 'floor' ? PLAN_FLOOR_FILL_OPACITY_BASE : PLAN_ROOF_FILL_OPACITY_BASE;
  const lwh =
    Number.isFinite(opts.lineWeightHint) && opts.lineWeightHint > 0 ? opts.lineWeightHint : 1;
  const fillOpacity = Math.min(0.34, Math.max(0.06, baseOp * Math.min(1.35, lwh / 1.12)));
  grp.add(horizontalOutlineMesh(outlineMm, fillY, color, fillOpacity, opts.pickId));

  if (outlineMm.length < 2) {
    grp.userData.bimPickId = opts.pickId;
    if (opts.kind === 'roof' && opts.roofGeometrySupportToken) {
      grp.userData.bimAiRoofGeometrySupportToken = opts.roofGeometrySupportToken;
    }
    return grp;
  }

  const pts = outlineMm.map((p) => new THREE.Vector3(ux(p.xMm), strokeY, uz(p.yMm)));
  const dashSpec = planLinePatternDashWorldUnits(opts.linePatternToken ?? undefined);
  if (dashSpec == null) {
    const loop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, depthTest: true }),
    );
    loop.userData.bimPickId = opts.pickId;
    grp.add(loop);
  } else {
    const closed = [...pts, pts[0]!];
    const mat = new THREE.LineDashedMaterial({
      color,
      dashSize: dashSpec.dashSize,
      gapSize: dashSpec.gapSize,
      depthTest: true,
    });
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(closed), mat);
    ln.computeLineDistances();
    ln.userData.bimPickId = opts.pickId;
    grp.add(ln);
  }

  grp.userData.bimPickId = opts.pickId;
  if (opts.kind === 'roof' && opts.roofGeometrySupportToken) {
    grp.userData.bimAiRoofGeometrySupportToken = opts.roofGeometrySupportToken;
  }
  return grp;
}

/** Server `ROOM_PLAN_OVERLAP_THRESHOLD_MM2` in `app/bim_ai/constraints.py` (`room_overlap_plan`). */
export const ROOM_PLAN_OVERLAP_ADVISOR_MM2 = 50_000;

/** Plan authoring display bias (orthogonal to BIM levels). */
export type PlanPresentationPreset = 'default' | 'opening_focus' | 'room_scheme';

function outlineMmFromWire(raw: unknown): Array<{ xMm: number; yMm: number }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => coerceVec2Mm(p));
}

function wallElemFromWirePrimitive(
  row: Record<string, unknown>,
): Extract<Element, { kind: 'wall' }> {
  const lwh = Number(row.lineWeightHint ?? 1);
  const baseT = Number(row.thicknessMm ?? 200);
  const scale = Number.isFinite(lwh) && lwh > 0 && lwh <= 3 ? lwh : 1;
  return {
    kind: 'wall',
    id: String(row.id ?? ''),
    name: 'Wall',
    levelId: String(row.levelId ?? ''),
    start: coerceVec2Mm(row.startMm),
    end: coerceVec2Mm(row.endMm),
    thicknessMm: baseT * scale,
    heightMm: Number(row.heightMm ?? 2800),
  };
}

function resolveWallForWire(
  wallId: string,
  elementsById: Record<string, Element>,
  wallsByWireId: Map<string, Extract<Element, { kind: 'wall' }>>,
): Extract<Element, { kind: 'wall' }> | undefined {
  const live = elementsById[wallId];
  if (live?.kind === 'wall') return live;
  return wallsByWireId.get(wallId);
}

function roomSeparationLineFromMm(
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
  id: string,
  linePatternToken?: string | null,
): THREE.Line {
  const pts = [
    new THREE.Vector3(ux(start.xMm), PLAN_Y + 0.003, uz(start.yMm)),
    new THREE.Vector3(ux(end.xMm), PLAN_Y + 0.003, uz(end.yMm)),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const tok =
    linePatternToken === undefined || linePatternToken === null || linePatternToken === ''
      ? 'dash_short'
      : linePatternToken;
  const dashSpec = planLinePatternDashWorldUnits(tok);
  if (dashSpec == null) {
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: getPlanPalette().roomBoundary,
        linewidth: 1,
        depthTest: true,
      }),
    );
    line.userData.bimPickId = id;
    return line;
  }
  const mat = new THREE.LineDashedMaterial({
    color: getPlanPalette().roomBoundary,
    dashSize: dashSpec.dashSize,
    gapSize: dashSpec.gapSize,
    depthTest: true,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  line.userData.bimPickId = id;
  return line;
}

function gridLineThreeFromPlanWire(
  gl: Extract<Element, { kind: 'grid_line' }>,
  linePatternToken?: string | null,
): THREE.Group {
  const grp = new THREE.Group();

  const pts = [
    new THREE.Vector3(ux(gl.start.xMm), PLAN_Y, uz(gl.start.yMm)),

    new THREE.Vector3(ux(gl.end.xMm), PLAN_Y, uz(gl.end.yMm)),
  ];

  const dashSpec = planLinePatternDashWorldUnits(linePatternToken ?? undefined);
  if (dashSpec == null) {
    grp.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),

        new THREE.LineBasicMaterial({ color: getPlanPalette().dimWitness, linewidth: 2 }),
      ),
    );
  } else {
    const mat = new THREE.LineDashedMaterial({
      color: getPlanPalette().dimWitness,
      dashSize: dashSpec.dashSize,
      gapSize: dashSpec.gapSize,
      depthTest: true,
    });
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    ln.computeLineDistances();
    grp.add(ln);
  }

  grp.userData.bimPickId = gl.id;

  grp.userData.gridLabel = gl.label;

  return grp;
}

function rebuildPlanMeshesFromWire(
  holder: THREE.Object3D,
  elementsById: Record<string, Element>,
  opts: {
    selectedId?: string;
    presentation?: PlanPresentationPreset;
    wirePrimitives: PlanProjectionPrimitivesV1Wire;
    roomFillOpacityScale?: number;
    planAnnotationHints?: PlanAnnotationHintsResolved | null;
    planTagFontScales?: { opening: number; room: number } | null;
  },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  const prim = opts.wirePrimitives;
  const presentation = opts.presentation ?? 'default';
  const selectedId = opts.selectedId;
  const roomFillOpacityScale = opts.roomFillOpacityScale ?? 1;
  const ann = opts.planAnnotationHints ?? null;
  const tagOpenScale = opts.planTagFontScales?.opening ?? 1;
  const tagRoomScale = opts.planTagFontScales?.room ?? 1;

  const wallsRaw = Array.isArray(prim.walls) ? (prim.walls as Record<string, unknown>[]) : [];
  const wallsByWireId = new Map<string, Extract<Element, { kind: 'wall' }>>();
  for (const row of wallsRaw) {
    const id = String(row.id ?? '');
    if (!id) continue;
    wallsByWireId.set(id, wallElemFromWirePrimitive(row));
  }

  const grids = Array.isArray(prim.gridLines) ? (prim.gridLines as Record<string, unknown>[]) : [];
  for (const g of grids) {
    const id = String(g.id ?? '');
    const gl: Extract<Element, { kind: 'grid_line' }> = {
      kind: 'grid_line',
      id,
      name: 'Grid',
      label: typeof g.label === 'string' ? g.label : '',
      start: coerceVec2Mm(g.startMm),
      end: coerceVec2Mm(g.endMm),
      ...(g.levelId !== undefined && g.levelId !== null ? { levelId: String(g.levelId) } : {}),
    };
    const patRaw = g.linePatternToken ?? g.line_pattern_token;
    const linePat = typeof patRaw === 'string' ? patRaw : undefined;
    holder.add(gridLineThreeFromPlanWire(gl, linePat));
  }

  const rooms = Array.isArray(prim.rooms) ? (prim.rooms as Record<string, unknown>[]) : [];
  for (const r of rooms) {
    const id = String(r.id ?? '');
    const outline = outlineMmFromWire(r.outlineMm);
    if (outline.length < 2) continue;
    const live = elementsById[id];
    const roomEl: Extract<Element, { kind: 'room' }> =
      live?.kind === 'room'
        ? live
        : {
            kind: 'room',
            id,
            name: id,
            levelId: String(r.levelId ?? ''),
            outlineMm: outline,
          };
    const hexRaw = r.schemeColorHex ?? r.scheme_color_hex;
    const schemeHex =
      typeof hexRaw === 'string' && /^#[0-9a-fA-F]{6}$/.test(hexRaw.trim())
        ? hexRaw.trim()
        : undefined;
    const mesh = roomMesh(roomEl, presentation, {
      schemeColorHex: schemeHex,
      roomFillOpacityScale,
    });
    holder.add(mesh);
    if (ann?.roomLabelsVisible === true && typeof mesh.userData.roomLabel === 'object') {
      const labelRaw = typeof r.planTagLabel === 'string' ? r.planTagLabel.trim() : '';
      if (labelRaw) {
        const rl = mesh.userData.roomLabel as { cx?: number; cz?: number };
        if (
          rl &&
          typeof rl.cx === 'number' &&
          Number.isFinite(rl.cx) &&
          typeof rl.cz === 'number' &&
          Number.isFinite(rl.cz)
        ) {
          holder.add(
            planAnnotationLabelSprite(
              rl.cx,
              rl.cz,
              labelRaw,
              mesh.userData.bimPickId,
              tagRoomScale,
            ),
          );
        }
      }
    }
  }

  const floors = Array.isArray(prim.floors) ? (prim.floors as Record<string, unknown>[]) : [];
  for (const f of floors) {
    const outline = outlineMmFromWire(f.outlineMm);
    if (outline.length < 2) continue;
    const lwh = Number(f.lineWeightHint ?? f.line_weight_hint ?? 1);
    const patRaw = f.linePatternToken ?? f.line_pattern_token;
    holder.add(
      planFloorRoofOutlineWireGroup(outline, {
        kind: 'floor',
        pickId: String(f.id ?? ''),
        lineWeightHint: lwh,
        linePatternToken: typeof patRaw === 'string' ? patRaw : undefined,
      }),
    );
  }

  const roofs = Array.isArray(prim.roofs) ? (prim.roofs as Record<string, unknown>[]) : [];
  for (const rf of roofs) {
    const outline = outlineMmFromWire(rf.footprintMm);
    if (outline.length < 2) continue;
    const lwh = Number(rf.lineWeightHint ?? rf.line_weight_hint ?? 1);
    const patRaw = rf.linePatternToken ?? rf.line_pattern_token;
    const supportTokRaw = rf.roofGeometrySupportToken;
    const supportTok =
      typeof supportTokRaw === 'string' && supportTokRaw.trim() ? supportTokRaw.trim() : null;
    const grp = planFloorRoofOutlineWireGroup(outline, {
      kind: 'roof',
      pickId: String(rf.id ?? ''),
      lineWeightHint: lwh,
      linePatternToken: typeof patRaw === 'string' ? patRaw : undefined,
      roofGeometrySupportToken: supportTok,
    });
    holder.add(grp);
  }

  for (const w of wallsByWireId.values()) holder.add(planWallMesh(w, selectedId));

  const sepsRaw = Array.isArray(prim.roomSeparations)
    ? (prim.roomSeparations as Record<string, unknown>[])
    : [];
  for (const row of sepsRaw) {
    const sid = String(row.id ?? '');
    if (!sid) continue;
    const sMm = coerceVec2Mm(row.startMm);
    const eMm = coerceVec2Mm(row.endMm);
    const patRaw = row.linePatternToken ?? row.line_pattern_token;
    holder.add(
      roomSeparationLineFromMm(sMm, eMm, sid, typeof patRaw === 'string' ? patRaw : undefined),
    );
  }

  const doors = Array.isArray(prim.doors) ? (prim.doors as Record<string, unknown>[]) : [];
  for (const d of doors) {
    const id = String(d.id ?? '');
    const wallId = String(d.wallId ?? '');
    const host = resolveWallForWire(wallId, elementsById, wallsByWireId);
    const doorEl = elementsById[id];
    if (!host || doorEl?.kind !== 'door') continue;
    const doorGrp = doorGroupThree(doorEl, host, selectedId, presentation === 'opening_focus');
    holder.add(doorGrp);
    if (ann?.openingTagsVisible === true) {
      const labelRaw = typeof d.planTagLabel === 'string' ? d.planTagLabel.trim() : '';
      if (labelRaw) {
        doorGrp.updateMatrixWorld(true);
        const pos = new THREE.Vector3();
        doorGrp.getWorldPosition(pos);
        holder.add(planAnnotationLabelSprite(pos.x, pos.z, labelRaw, doorEl.id, tagOpenScale));
      }
    }
  }

  const wins = Array.isArray(prim.windows) ? (prim.windows as Record<string, unknown>[]) : [];
  for (const w of wins) {
    const id = String(w.id ?? '');
    const wallId = String(w.wallId ?? '');
    const host = resolveWallForWire(wallId, elementsById, wallsByWireId);
    const winEl = elementsById[id];
    if (!host || winEl?.kind !== 'window') continue;
    const winGrp = planWindowMesh(winEl, host, selectedId, presentation === 'opening_focus');
    holder.add(winGrp);
    if (ann?.openingTagsVisible === true) {
      const labelRaw = typeof w.planTagLabel === 'string' ? w.planTagLabel.trim() : '';
      if (labelRaw) {
        winGrp.updateMatrixWorld(true);
        const pos = new THREE.Vector3();
        winGrp.getWorldPosition(pos);
        holder.add(planAnnotationLabelSprite(pos.x, pos.z, labelRaw, winEl.id, tagOpenScale));
      }
    }
  }

  const stairsRaw = Array.isArray(prim.stairs) ? (prim.stairs as Record<string, unknown>[]) : [];
  for (const row of stairsRaw) {
    const id = String(row.id ?? '');
    const live = elementsById[id];
    const stairEl: Extract<Element, { kind: 'stair' }> =
      live?.kind === 'stair'
        ? live
        : ({
            kind: 'stair',
            id,
            name: 'Stair',
            baseLevelId: String(row.baseLevelId ?? ''),
            topLevelId: String(row.topLevelId ?? row.baseLevelId ?? ''),
            runStartMm: coerceVec2Mm(row.runStartMm),
            runEndMm: coerceVec2Mm(row.runEndMm),
            widthMm: Number(row.widthMm ?? 1000),
            riserMm: Number(row.riserMm ?? 175),
            treadMm: Number(row.treadMm ?? 275),
          } as Extract<Element, { kind: 'stair' }>);
    const hasDoc =
      row.runBearingDegCcFromPlanX !== undefined ||
      row.planUpDownLabel !== undefined ||
      row.stairPlanBreakVisibilityToken !== undefined ||
      row.stairPlanSectionDocumentationLabel !== undefined ||
      row.stairDocumentationPlaceholders_v0 !== undefined;
    const phRaw = row.stairDocumentationPlaceholders_v0;
    const phObj = phRaw && typeof phRaw === 'object' ? (phRaw as Record<string, unknown>) : null;
    const wireDoc = hasDoc
      ? {
          runBearingDegCcFromPlanX:
            typeof row.runBearingDegCcFromPlanX === 'number'
              ? Number(row.runBearingDegCcFromPlanX)
              : undefined,
          planUpDownLabel:
            typeof row.planUpDownLabel === 'string' ? row.planUpDownLabel : undefined,
          stairPlanBreakVisibilityToken:
            typeof row.stairPlanBreakVisibilityToken === 'string'
              ? row.stairPlanBreakVisibilityToken
              : undefined,
          stairPlanSectionDocumentationLabel:
            typeof row.stairPlanSectionDocumentationLabel === 'string'
              ? row.stairPlanSectionDocumentationLabel
              : undefined,
          stairDocumentationPlaceholders_v0:
            phObj &&
            phObj.bottomLandingFootprintBoundsMm &&
            phObj.topLandingFootprintBoundsMm &&
            typeof phObj.bottomLandingFootprintBoundsMm === 'object' &&
            typeof phObj.topLandingFootprintBoundsMm === 'object'
              ? {
                  bottomLandingFootprintBoundsMm:
                    phObj.bottomLandingFootprintBoundsMm as BoundsXYmm,
                  topLandingFootprintBoundsMm: phObj.topLandingFootprintBoundsMm as BoundsXYmm,
                }
              : undefined,
        }
      : undefined;
    const g = stairPlanThree(stairEl, elementsById, wireDoc);
    if (g) holder.add(g);
  }

  const dims = Array.isArray(prim.dimensions) ? (prim.dimensions as Record<string, unknown>[]) : [];
  for (const dm of dims) {
    const id = String(dm.id ?? '');
    const live = elementsById[id];
    const dEl: Extract<Element, { kind: 'dimension' }> =
      live?.kind === 'dimension'
        ? live
        : {
            kind: 'dimension',
            id,
            name: 'Dimension',
            levelId: String(dm.levelId ?? ''),
            aMm: coerceVec2Mm(dm.aMm),
            bMm: coerceVec2Mm(dm.bMm),
            offsetMm: coerceVec2Mm(dm.offsetMm ?? { x: 0, y: 0 }),
          };
    holder.add(dimensionsThree(dEl));
  }
}

function sectionCutPlanThree(sc: Extract<Element, { kind: 'section_cut' }>): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = sc.id;

  const sx = ux(sc.lineStartMm.xMm);
  const sz = uz(sc.lineStartMm.yMm);
  const ex = ux(sc.lineEndMm.xMm);
  const ez = uz(sc.lineEndMm.yMm);
  const Y = PLAN_Y + 0.007;
  const color = readToken('--cat-section', '#ef4444');

  // Dashed cut body
  const linePts = [new THREE.Vector3(sx, Y, sz), new THREE.Vector3(ex, Y, ez)];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.14 });
  const line = new THREE.Line(lineGeom, lineMat);
  line.computeLineDistances();
  group.add(line);

  // Direction along cut and right-hand perpendicular (view direction).
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const nx = dx / len;
  const nz = dz / len;
  const vx = nz;
  const vz = -nx;

  const STUB = 0.25;
  const ARROW = 0.55;
  for (const [px, pz] of [
    [sx, sz],
    [ex, ez],
  ] as [number, number][]) {
    const stubPts = [
      new THREE.Vector3(px - nz * STUB, Y, pz + nx * STUB),
      new THREE.Vector3(px + nz * STUB, Y, pz - nx * STUB),
    ];
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(stubPts),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
    const arrPts = [
      new THREE.Vector3(px, Y, pz),
      new THREE.Vector3(px + vx * ARROW, Y, pz + vz * ARROW),
    ];
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arrPts),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
  }

  return group;
}

export function rebuildPlanMeshes(
  holder: THREE.Object3D,

  elementsById: Record<string, Element>,

  opts: {
    activeLevelId?: string;
    selectedId?: string;
    presentation?: PlanPresentationPreset;
    hiddenSemanticKinds?: ReadonlySet<string>;
    wirePrimitives?: PlanProjectionPrimitivesV1Wire | null;
    planGraphicHints?: PlanGraphicHintsResolved | null;
    planAnnotationHints?: PlanAnnotationHintsResolved | null;
    planTagFontScales?: { opening: number; room: number } | null;
  },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  const gh = opts.planGraphicHints;
  const roomFillOpacityScale = gh?.roomFillOpacityScale ?? 1;
  const lineWeightScale = gh?.lineWeightScale ?? 1;

  if (opts.wirePrimitives && isPlanProjectionPrimitivesV1(opts.wirePrimitives)) {
    rebuildPlanMeshesFromWire(holder, elementsById, {
      selectedId: opts.selectedId,
      presentation: opts.presentation,
      wirePrimitives: opts.wirePrimitives,
      roomFillOpacityScale,
      planAnnotationHints: opts.planAnnotationHints ?? null,
      planTagFontScales: opts.planTagFontScales ?? null,
    });
    return;
  }

  const level = opts.activeLevelId;
  const presentation = opts.presentation ?? 'default';
  const hidden = opts.hiddenSemanticKinds;
  const kindHidden = (k: string) => Boolean(hidden?.has(k));

  type WallElem = Extract<Element, { kind: 'wall' }>;

  const walls = Object.values(elementsById).filter(
    (e): e is WallElem =>
      e.kind === 'wall' && !kindHidden('wall') && (!level || e.levelId === level),
  );

  const wallsById: Record<string, WallElem> = Object.fromEntries(walls.map((w) => [w.id, w]));

  for (const g of Object.values(elementsById)) {
    if (g.kind !== 'grid_line') continue;
    if (kindHidden('grid_line')) continue;

    if (g.levelId && level && g.levelId !== level) continue;

    holder.add(gridLineThree(g));
  }

  for (const r of Object.values(elementsById)) {
    if (r.kind !== 'room') continue;
    if (kindHidden('room')) continue;

    if (level && r.levelId !== level) continue;

    holder.add(roomMesh(r, presentation, { roomFillOpacityScale }));
  }

  for (const f of Object.values(elementsById)) {
    if (f.kind !== 'floor') continue;
    if (kindHidden('floor')) continue;

    if (level && f.levelId !== level) continue;

    holder.add(
      horizontalOutlineMesh(
        f.boundaryMm,
        PLAN_Y + 0.001,
        getPlanPalette().floorOutline,
        0.16,
        f.id,
      ),
    );
  }

  for (const rf of Object.values(elementsById)) {
    if (rf.kind !== 'roof') continue;
    if (kindHidden('roof')) continue;

    if (level && rf.referenceLevelId !== level) continue;

    holder.add(
      horizontalOutlineMesh(
        rf.footprintMm,
        PLAN_Y + 0.004,
        getPlanPalette().roofOutline,
        0.2,
        rf.id,
      ),
    );
  }

  for (const cl of Object.values(elementsById)) {
    if (cl.kind !== 'ceiling') continue;
    if (kindHidden('ceiling')) continue;
    if (level && cl.levelId !== level) continue;
    holder.add(horizontalOutlineMesh(cl.boundaryMm, PLAN_Y + 0.003, getPlanPalette().floorOutline, 0.14, cl.id));
  }

  for (const wall of walls) holder.add(planWallMesh(wall, opts.selectedId, lineWeightScale));

  for (const rs of Object.values(elementsById)) {
    if (rs.kind !== 'room_separation') continue;
    if (kindHidden('room_separation')) continue;
    if (level && rs.levelId !== level) continue;
    holder.add(roomSeparationLineFromMm(rs.start, rs.end, rs.id));
  }

  for (const d of Object.values(elementsById)) {
    if (d.kind !== 'door') continue;
    if (kindHidden('door')) continue;

    const host = wallsById[d.wallId];

    if (!host) continue;

    holder.add(doorGroupThree(d, host, opts.selectedId, presentation === 'opening_focus'));
  }

  for (const win of Object.values(elementsById)) {
    if (win.kind !== 'window') continue;
    if (kindHidden('window')) continue;

    const host = wallsById[win.wallId];

    if (!host) continue;

    holder.add(planWindowMesh(win, host, opts.selectedId, presentation === 'opening_focus'));
  }

  for (const st of Object.values(elementsById)) {
    if (st.kind !== 'stair') continue;
    if (kindHidden('stair')) continue;
    if (level && st.baseLevelId !== level) continue;
    const g = stairPlanThree(st, elementsById);

    if (g) holder.add(g);
  }

  for (const dm of Object.values(elementsById)) {
    if (dm.kind !== 'dimension') continue;
    if (kindHidden('dimension')) continue;

    if (level && dm.levelId !== level) continue;

    holder.add(dimensionsThree(dm));
  }

  for (const sc of Object.values(elementsById)) {
    if (sc.kind !== 'section_cut') continue;
    if (kindHidden('section_cut')) continue;
    holder.add(sectionCutPlanThree(sc));
  }
}

/** Optional documentation overlays from `planProjectionPrimitives_v1.stairs[]` (Prompt-2). */

export type BoundsXYmm = {
  minXmMm: number;
  maxXmMm: number;
  minYmMm: number;
  maxYmMm: number;
};

export type StairPlanWireDocOverlays = {
  runBearingDegCcFromPlanX?: number;
  planUpDownLabel?: string;
  stairPlanBreakVisibilityToken?: string;
  stairPlanSectionDocumentationLabel?: string;
  stairDocumentationPlaceholders_v0?: {
    bottomLandingFootprintBoundsMm?: BoundsXYmm;
    topLandingFootprintBoundsMm?: BoundsXYmm;
  };
};
