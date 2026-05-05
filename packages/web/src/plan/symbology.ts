import * as THREE from 'three';

import type { Element, PlanLinePatternToken } from '@bim-ai/core';

import {
  coerceVec2Mm,
  isPlanProjectionPrimitivesV1,
  type PlanAnnotationHintsResolved,
  type PlanGraphicHintsResolved,
  type PlanProjectionPrimitivesV1Wire,
} from './planProjectionWire';
import { deterministicSchemeColorHex } from './roomSchemeColor';

/** Plan slice elevation in world units (walls still render with real height elsewhere). */

const PLAN_Y = 0.02;

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

function ux(xMm: number) {
  return xMm / 1000;
}

function uz(yMm: number) {
  return yMm / 1000;
}

function segmentDir(wall: Extract<Element, { kind: 'wall' }>) {
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
  },
): THREE.Group {
  const grp = new THREE.Group();
  const color = opts.kind === 'floor' ? '#22c55e' : '#f97316';
  const fillY = opts.kind === 'floor' ? PLAN_Y + 0.001 : PLAN_Y + 0.004;
  const strokeY = fillY + 0.0004;
  const baseOp = opts.kind === 'floor' ? PLAN_FLOOR_FILL_OPACITY_BASE : PLAN_ROOF_FILL_OPACITY_BASE;
  const lwh =
    Number.isFinite(opts.lineWeightHint) && opts.lineWeightHint > 0 ? opts.lineWeightHint : 1;
  const fillOpacity = Math.min(0.34, Math.max(0.06, baseOp * Math.min(1.35, lwh / 1.12)));
  grp.add(horizontalOutlineMesh(outlineMm, fillY, color, fillOpacity, opts.pickId));

  if (outlineMm.length < 2) {
    grp.userData.bimPickId = opts.pickId;
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
      new THREE.LineBasicMaterial({ color: '#a855f7', linewidth: 1, depthTest: true }),
    );
    line.userData.bimPickId = id;
    return line;
  }
  const mat = new THREE.LineDashedMaterial({
    color: '#a855f7',
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

        new THREE.LineBasicMaterial({ color: '#64748b', linewidth: 2 }),
      ),
    );
  } else {
    const mat = new THREE.LineDashedMaterial({
      color: '#64748b',
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
    holder.add(
      planFloorRoofOutlineWireGroup(outline, {
        kind: 'roof',
        pickId: String(rf.id ?? ''),
        lineWeightHint: lwh,
        linePatternToken: typeof patRaw === 'string' ? patRaw : undefined,
      }),
    );
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
      roomSeparationLineFromMm(
        sMm,
        eMm,
        sid,
        typeof patRaw === 'string' ? patRaw : undefined,
      ),
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
      row.stairPlanBreakVisibilityToken !== undefined;
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

    holder.add(horizontalOutlineMesh(f.boundaryMm, PLAN_Y + 0.001, '#22c55e', 0.16, f.id));
  }

  for (const rf of Object.values(elementsById)) {
    if (rf.kind !== 'roof') continue;
    if (kindHidden('roof')) continue;

    if (level && rf.referenceLevelId !== level) continue;

    holder.add(horizontalOutlineMesh(rf.footprintMm, PLAN_Y + 0.004, '#f97316', 0.2, rf.id));
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
}

function planWallMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  lineWeightScale = 1,
): THREE.Mesh {
  const { lenM: len, nx, nz } = segmentDir(wall);

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const angle = Math.atan2(nz, nx);

  const thick = THREE.MathUtils.clamp((wall.thicknessMm * lineWeightScale) / 1000, 0.02, 1.8);

  const geom = new THREE.BoxGeometry(len, PLAN_WALL_CENTER_SLICE_HEIGHT_M, thick);

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.82,

    metalness: 0.02,

    color: wall.id === selectedId ? '#fb923c' : '#94a3b8',
  });

  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.set(sx + (nx * len) / 2, PLAN_Y, sz + (nz * len) / 2);

  mesh.rotation.y = -angle;

  mesh.userData.bimPickId = wall.id;

  return mesh;
}

function doorGroupThree(
  door: Extract<Element, { kind: 'door' }>,

  wall: Extract<Element, { kind: 'wall' }>,

  selectedId?: string,

  openingFocus?: boolean,
): THREE.Group {
  const g = new THREE.Group();

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const seg = segmentDir(wall);

  const px = sx + seg.nx * seg.lenM * door.alongT;

  const pz = sz + seg.nz * seg.lenM * door.alongT;

  const width = THREE.MathUtils.clamp(door.widthMm / 1000, 0.2, Math.min(seg.lenM * 0.95, 4));

  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.02, 0.05, 1);

  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),

    new THREE.MeshStandardMaterial({
      emissive: openingFocus ? 0x084c6e : 0x000000,
      emissiveIntensity: openingFocus ? 0.35 : 0,
      color: door.id === selectedId ? '#fde047' : '#67e8f9',
    }),
  );

  opening.position.set(px, PLAN_Y + 0.025, pz);

  opening.rotation.y = Math.atan2(seg.nz, seg.nx);

  opening.userData.bimPickId = door.id;

  g.add(opening);

  const swingMinor = openingFocus
    ? PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS
    : PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT;

  const curve = new THREE.EllipseCurve(
    0,
    0,
    width / swingMinor,

    width / swingMinor,

    Math.PI / 4,

    Math.PI / 4 + Math.PI / (openingFocus ? 1.9 : 2.2),
  );

  const arcPts = curve.getPoints(28).map((p) => new THREE.Vector3(p.x, PLAN_Y + 0.03, -p.y));

  const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);

  const arc = new THREE.Line(
    arcGeom,

    new THREE.LineBasicMaterial({ color: openingFocus ? '#bae6fd' : '#0ea5e9', linewidth: 1 }),
  );

  arc.position.set(px, 0, pz);

  arc.rotation.y = Math.atan2(seg.nz, seg.nx);

  g.add(arc);

  g.userData.bimPickId = door.id;

  return g;
}

function planWindowMesh(
  win: Extract<Element, { kind: 'window' }>,

  wall: Extract<Element, { kind: 'wall' }>,

  selectedId?: string,

  openingFocus?: boolean,
): THREE.Group {
  const grp = new THREE.Group();

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const seg = segmentDir(wall);

  const px = sx + seg.nx * seg.lenM * win.alongT;

  const pz = sz + seg.nz * seg.lenM * win.alongT;

  const yaw = Math.atan2(seg.nz, seg.nx);

  grp.position.set(px, 0, pz);

  grp.rotation.y = yaw;

  const width = THREE.MathUtils.clamp(win.widthMm / 1000, 0.2, seg.lenM * 0.95);

  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.01, 0.05, 1);

  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.08, (wall.heightMm / 1000) * 0.85);

  const h = THREE.MathUtils.clamp(win.heightMm / 1000, 0.06, wall.heightMm / 1000 - sill - 0.05);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, h, depth),

    new THREE.MeshStandardMaterial({
      transparent: true,

      opacity: openingFocus ? 0.92 : 0.55,

      color: openingFocus
        ? win.id === selectedId
          ? '#ddd6fe'
          : '#9333ea'
        : win.id === selectedId
          ? '#c4b5fd'
          : '#a78bfa',
    }),
  );

  mesh.position.set(0, sill + h / 2, 0);

  mesh.userData.bimPickId = win.id;

  grp.add(mesh);

  const sillPts = [
    new THREE.Vector3(-width / 2, sill + 0.004, depth * 0.51),

    new THREE.Vector3(width / 2, sill + 0.004, depth * 0.51),
  ];

  const sillGeom = new THREE.BufferGeometry().setFromPoints(sillPts);

  const sillLn = new THREE.Line(
    sillGeom,

    new THREE.LineBasicMaterial({
      color: openingFocus ? '#f5d0fe' : '#7c3aed',

      linewidth: PLAN_WINDOW_SILL_LINE_WIDTH,
    }),
  );

  sillLn.renderOrder = 2;

  grp.add(sillLn);

  grp.userData.bimPickId = win.id;

  return grp;
}

/** Match kernel `stair_riser_count_plan_proxy` (rise / riser when levels resolve). */
function computeStairPlanRiserCount(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById?: Record<string, Element>,
): number {
  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const lenM = Math.max(1e-6, Math.hypot(ex - sx, ez - sz));
  const lenMm = lenM * 1000;

  if (elementsById) {
    const bl = elementsById[stair.baseLevelId];
    const tl = elementsById[stair.topLevelId];
    if (bl?.kind === 'level' && tl?.kind === 'level') {
      const riseMm = Math.abs(tl.elevationMm - bl.elevationMm);
      if (riseMm > 1e-3) {
        const r = Math.max(stair.riserMm, 1e-6);
        const n = Math.round(riseMm / r);
        return Math.max(2, Math.min(36, n));
      }
    }
  }

  const t = Math.max(stair.treadMm, 1e-6);
  const n2 = Math.round(lenMm / t);
  return Math.max(2, Math.min(36, n2));
}

/** Optional documentation overlays from `planProjectionPrimitives_v1.stairs[]` (Prompt-2). */
type StairPlanWireDocOverlays = {
  runBearingDegCcFromPlanX?: number;
  planUpDownLabel?: string;
  stairPlanBreakVisibilityToken?: string;
};

/** Footprint tread preview on the stair base level (OG plan hides it). */

function stairPlanThree(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById?: Record<string, Element>,
  wireDoc?: StairPlanWireDocOverlays | null,
): THREE.Group | null {
  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(1e-6, Math.hypot(dx, dz));
  const uxDir = dx / len;
  const uzDir = dz / len;
  const px = -uzDir * (stair.widthMm / 2000);

  const pz = uxDir * (stair.widthMm / 2000);

  const g = new THREE.Group();

  const outline = [
    new THREE.Vector3(sx + px, PLAN_Y + 0.012, sz + pz),

    new THREE.Vector3(ex + px, PLAN_Y + 0.012, ez + pz),

    new THREE.Vector3(ex - px, PLAN_Y + 0.012, ez - pz),

    new THREE.Vector3(sx - px, PLAN_Y + 0.012, sz - pz),

    new THREE.Vector3(sx + px, PLAN_Y + 0.012, sz + pz),
  ];

  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outline),
      new THREE.LineBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.92 }),
    ),
  );

  const nSteps = computeStairPlanRiserCount(stair, elementsById);
  const stepLen = len / nSteps;

  const runOffX = uxDir * stepLen;

  const runOffZ = uzDir * stepLen;

  for (let i = 0; i <= nSteps; i++) {
    const t = sx + uxDir * stepLen * i;

    const w = sz + uzDir * stepLen * i;

    const p1 = new THREE.Vector3(t + px, PLAN_Y + 0.018, w + pz);

    const p2 = new THREE.Vector3(t - px, PLAN_Y + 0.018, w - pz);

    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p1, p2]),
        new THREE.LineBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.55 }),
      ),
    );

    if (i < nSteps) {
      const c1 = new THREE.Vector3(
        t + runOffX + px * 0.15,
        PLAN_Y + 0.018,
        w + runOffZ + pz * 0.15,
      );

      const c2 = new THREE.Vector3(
        t + runOffX - px * 0.15,
        PLAN_Y + 0.018,
        w + runOffZ - pz * 0.15,
      );

      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([c1, c2]),
          new THREE.LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.45 }),
        ),
      );
    }
  }

  if (wireDoc) {
    const mx = (sx + ex) * 0.5;
    const mz = (sz + ez) * 0.5;
    const yDoc = PLAN_Y + 0.024;
    let bx = uxDir;
    let bz = uzDir;
    if (
      wireDoc.runBearingDegCcFromPlanX !== undefined &&
      Number.isFinite(wireDoc.runBearingDegCcFromPlanX)
    ) {
      const rad = (wireDoc.runBearingDegCcFromPlanX * Math.PI) / 180;
      bx = Math.cos(rad);
      bz = Math.sin(rad);
    }
    const alen = Math.min(len, 0.55) * 0.35;
    const tip = new THREE.Vector3(mx + bx * alen * 0.45, yDoc, mz + bz * alen * 0.45);
    const tail = new THREE.Vector3(mx - bx * alen * 0.55, yDoc, mz - bz * alen * 0.55);
    const arrMat = new THREE.LineBasicMaterial({
      color: '#0ea5e9',
      transparent: true,
      opacity: 0.88,
    });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tail, tip]), arrMat));
    const perpX = -bz * 0.06;
    const perpZ = bx * 0.06;
    const b1 = new THREE.Vector3(tip.x - bx * 0.12 + perpX, yDoc, tip.z - bz * 0.12 + perpZ);
    const b2 = new THREE.Vector3(tip.x - bx * 0.12 - perpX, yDoc, tip.z - bz * 0.12 - perpZ);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tip, b1]), arrMat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tip, b2]), arrMat));

    const label = wireDoc.planUpDownLabel?.trim();
    if (label) {
      const lx = sx + uxDir * Math.min(len * 0.2, 0.35);
      const lz = sz + uzDir * Math.min(len * 0.2, 0.35);
      g.add(planAnnotationLabelSprite(lx, lz, label, stair.id, 0.85));
    }

    if (wireDoc.stairPlanBreakVisibilityToken === 'cutSplitsSpan') {
      const zx = mx - bz * (stair.widthMm / 2000) * 0.35;
      const zz = mz + bx * (stair.widthMm / 2000) * 0.35;
      const zig = 0.04;
      const p0 = new THREE.Vector3(zx - bx * zig, PLAN_Y + 0.026, zz - bz * zig);
      const p1 = new THREE.Vector3(zx + bx * zig, PLAN_Y + 0.026, zz + bz * zig);
      const p2 = new THREE.Vector3(zx + bx * zig * 2, PLAN_Y + 0.026, zz + bz * zig * 2);
      const brkMat = new THREE.LineBasicMaterial({
        color: '#64748b',
        transparent: true,
        opacity: 0.7,
      });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), brkMat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), brkMat));
    }
  }

  g.userData.bimPickId = stair.id;

  return g;
}

function roomMesh(
  room: Extract<Element, { kind: 'room' }>,
  presentation?: PlanPresentationPreset,
  opts?: { schemeColorHex?: string; roomFillOpacityScale?: number },
): THREE.Mesh {
  const scheme = presentation ?? 'default';

  const shape = new THREE.Shape();

  const o = room.outlineMm[0];

  if (!o) return new THREE.Mesh();

  // Shape lives in XY; rotate mesh −90°X so planar Y aligns with world −Z.

  shape.moveTo(ux(o.xMm), -uz(o.yMm));

  for (let i = 1; i < room.outlineMm.length; i++) {
    const p = room.outlineMm[i];

    if (p) shape.lineTo(ux(p.xMm), -uz(p.yMm));
  }

  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);

  const seed =
    typeof room.programmeCode === 'string' && room.programmeCode.trim()
      ? room.programmeCode.trim()
      : room.id;

  const fill =
    scheme === 'room_scheme'
      ? {
          opacity: 0.34,

          color:
            opts?.schemeColorHex && /^#[0-9a-fA-F]{6}$/.test(opts.schemeColorHex)
              ? opts.schemeColorHex
              : deterministicSchemeColorHex(seed),
        }
      : scheme === 'opening_focus'
        ? { opacity: 0.045, color: '#1d4ed8' }
        : {
            opacity: 0.14,

            color: '#3b82f6',
          };

  const scale = opts?.roomFillOpacityScale ?? 1;

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color: fill.color,

      transparent: true,

      opacity: THREE.MathUtils.clamp(fill.opacity * scale, 0, 1),

      depthWrite: false,
    }),
  );

  mesh.rotation.x = -Math.PI / 2;

  mesh.position.y = PLAN_Y;

  mesh.userData.bimPickId = room.id;

  const c = centroidMm(room.outlineMm);

  mesh.userData.roomLabel = {
    cx: ux(c.xMm),
    cz: uz(c.yMm),
    name: room.name,
    areaMm2: polygonAreaMm2(room.outlineMm),
  };

  return mesh;
}

function planAnnotationLabelSprite(
  cxM: number,
  czM: number,
  text: string,
  pickId?: string,
  fontScale = 1,
): THREE.Sprite {
  const scaleMul = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const trimmed = text.trim().slice(0, 96);
  const safe = trimmed.length ? trimmed : '—';

  const doc = typeof globalThis.document !== 'undefined' ? globalThis.document : null;
  const emptySprite = (): THREE.Sprite => {
    const mat = new THREE.SpriteMaterial({ color: '#1e293b', transparent: true, opacity: 0.92 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(cxM, PLAN_Y + 0.003, czM);
    sprite.scale.set(0.08 * scaleMul, 0.03 * scaleMul, 1);
    sprite.renderOrder = 10;
    sprite.userData.planAnnotationOverlay = true;
    if (pickId) sprite.userData.bimPickId = pickId;
    return sprite;
  };
  if (!doc?.createElement) return emptySprite();

  const viteMode =
    typeof import.meta !== 'undefined' &&
    typeof (import.meta as { env?: { MODE?: string } }).env?.MODE === 'string'
      ? (import.meta as { env: { MODE: string } }).env.MODE
      : '';
  if (viteMode === 'test') return emptySprite();

  const dpr =
    typeof (globalThis as { devicePixelRatio?: number }).devicePixelRatio === 'number'
      ? (globalThis as { devicePixelRatio: number }).devicePixelRatio
      : 1;
  const fontPx = Math.round(64 * Math.min(Math.max(dpr, 1), 2));
  const size = Math.max(Math.floor(fontPx * 1.125), 32);
  const ch = Math.max(Math.floor(fontPx * 1.5625), 36);

  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = ch;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return emptySprite();

  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 4;
  const pad = Math.max(12, Math.floor(fontPx / 16));
  const r = pad * 1.05;
  const wBox = canvas.width - pad * 2;
  ctx.beginPath();
  ctx.moveTo(wBox + pad, canvas.height / 2);
  ctx.arcTo(canvas.width - pad + 1e-3, canvas.height / 2, canvas.width - pad, pad, r);
  ctx.arcTo(canvas.width - pad, pad + 1e-3, canvas.width / 2, pad, r);
  ctx.arcTo(pad + 1e-3, pad, pad, canvas.height / 2, r);
  ctx.arcTo(pad, canvas.height / 2, pad, canvas.height - pad, r);
  ctx.arcTo(pad + 1e-3, canvas.height - pad, canvas.width / 2, canvas.height - pad, r);
  ctx.arcTo(canvas.width - pad, canvas.height - pad, canvas.width - pad, canvas.height / 2, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.font = `600 ${fontPx}px system-ui,sans-serif`;
  ctx.fillStyle = '#fafafa';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.lineWidth = 3;
    ctx.strokeText(safe, canvas.width / 2, canvas.height / 2);
  } catch {
    /* strokeText unsupported in some canvas implementations */
  }
  ctx.fillText(safe, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(cxM, PLAN_Y + 0.003, czM);
  sprite.scale.set(0.22 * scaleMul, 0.22 * (canvas.height / canvas.width) * scaleMul, 1);
  sprite.renderOrder = 10;
  sprite.userData.planAnnotationOverlay = true;
  if (pickId) sprite.userData.bimPickId = pickId;
  return sprite;
}

function gridLineThree(g: Extract<Element, { kind: 'grid_line' }>): THREE.Group {
  const grp = new THREE.Group();

  const pts = [
    new THREE.Vector3(ux(g.start.xMm), PLAN_Y, uz(g.start.yMm)),

    new THREE.Vector3(ux(g.end.xMm), PLAN_Y, uz(g.end.yMm)),
  ];

  grp.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),

      new THREE.LineBasicMaterial({ color: '#64748b', linewidth: 2 }),
    ),
  );

  grp.userData.bimPickId = g.id;

  grp.userData.gridLabel = g.label;

  return grp;
}

function dimensionsThree(d: Extract<Element, { kind: 'dimension' }>): THREE.LineSegments {
  const a = new THREE.Vector3(ux(d.aMm.xMm), PLAN_Y + 0.002, uz(d.aMm.yMm));

  const b = new THREE.Vector3(ux(d.bMm.xMm), PLAN_Y + 0.002, uz(d.bMm.yMm));

  const off = new THREE.Vector3(ux(d.offsetMm.xMm), 0, uz(d.offsetMm.yMm));

  const aa = a.clone().add(off);

  const bb = b.clone().add(off);

  const arr = [
    ...a.toArray(),
    ...aa.toArray(),
    ...aa.toArray(),
    ...bb.toArray(),
    ...bb.toArray(),
    ...b.toArray(),
  ];

  const geo = new THREE.BufferGeometry();

  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));

  const dimSpanMm = Math.hypot(d.bMm.xMm - d.aMm.xMm, d.bMm.yMm - d.aMm.yMm);

  const ls = new THREE.LineSegments(
    geo,

    new THREE.LineBasicMaterial({ color: '#f472b6' }),
  );

  ls.userData.dimensionSpanMm = dimSpanMm;

  return ls;
}
