import * as THREE from 'three';

import type { Element, PlanLinePatternToken } from '@bim-ai/core';

import { liveTokenReader } from '../viewport/materials';
import {
  makePlacedAssetPlanSymbol,
  type AssetLibraryEntryElement,
  type PlacedAssetElement,
} from '../viewport/placedAssetRendering';
import type { LineWeights } from './draftingStandards';
import {
  coerceVec2Mm,
  isPlanProjectionPrimitivesV1,
  type PlanAnnotationHintsResolved,
  type PlanGraphicHintsResolved,
  type PlanProjectionPrimitivesV1Wire,
} from './planProjectionWire';
import {
  planWallMesh,
  planWallSectionMesh,
  computeWallSectionPolygon,
  doorGroupThree,
  planWindowMesh,
  planWallOpeningMesh,
  stairPlanThree,
  roomMesh,
  planAnnotationLabelSprite,
  gridLineThree,
  dimensionsThree,
  referencePlanePlanThree,
  propertyLinePlanThree,
} from './planElementMeshBuilders';
import type { WallJoinRecord } from './planElementMeshBuilders';
import { dormerPlanGroup } from './dormerPlanSymbol';
import { addFamilyInstancePlanSymbols } from './familyInstancePlanRendering';

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
    wallFill: readToken('--plan-wall', '#1c1917'),
    wallSelected: readToken('--color-accent', '#fb923c'),
    doorFill: readToken('--plan-door', '#2d2a27'),
    doorSelected: readToken('--color-accent', '#fde047'),
    doorSwing: readToken('--draft-construction-blue', '#0ea5e9'),
    doorSwingFocus: readToken('--draft-hover', '#bae6fd'),
    windowFill: readToken('--cat-window', '#9333ea'),
    windowSelected: readToken('--color-accent', '#ddd6fe'),
    windowSelectedBackline: readToken('--color-accent', '#c4b5fd'),
    windowFillBackline: readToken('--cat-window', '#a78bfa'),
    windowGlass: readToken('--cat-window', '#7c3aed'),
    windowGlassFocus: readToken('--draft-hover', '#f5d0fe'),
    floorOutline: readToken('--plan-floor', '#e8e2d8'),
    roofOutline: readToken('--cat-roof', '#f97316'),
    roomBoundary: readToken('--cat-room', '#a855f7'),
    roomLabel: readToken('--color-foreground', '#0f172a'),
    dimLine: readToken('--draft-anno', '#b5451b'),
    dimWitness: readToken('--draft-witness', '#5a7da3'),
    dimAlt: readToken('--color-warning', '#facc15'),
    tagBg: readToken('--draft-anno', '#b5451b'),
    tagText: readToken('--draft-paper', '#fdfcf9'),
    regionFill: readToken('--cat-room', '#c9dfd2'),
    regionFillStrong: readToken('--cat-room', '#b2d4c4'),
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

/** 45° diagonal hatch lines clipped to an arbitrary polygon outline (mm coords).
 * Uses proper edge-intersection scanline — no AABB bleed at polygon corners. */
function hatchPolygon2D(
  pts: Array<{ xMm: number; yMm: number }>,
  spacingMm: number,
  yWorld: number,
  color: string,
  opacity: number,
): THREE.LineSegments | null {
  const n = pts.length;
  if (n < 3) return null;
  let minC = Infinity,
    maxC = -Infinity;
  for (const p of pts) {
    const c = p.xMm - p.yMm;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const positions: number[] = [];
  for (let c = minC; c <= maxC; c += spacingMm) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i]!;
      const p2 = pts[(i + 1) % n]!;
      const dx = p2.xMm - p1.xMm;
      const dy = p2.yMm - p1.yMm;
      const denom = dx - dy;
      if (Math.abs(denom) < 1e-6) continue;
      const t = (c - p1.xMm + p1.yMm) / denom;
      if (t < -1e-9 || t > 1 + 1e-9) continue;
      xs.push(p1.xMm + t * dx);
    }
    xs.sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const x0 = xs[j]!;
      const x1 = xs[j + 1]!;
      positions.push(ux(x0), yWorld, -uz(x0 - c), ux(x1), yWorld, -uz(x1 - c));
    }
  }
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 5;
  return lines;
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

const PLAN_FLOOR_FILL_OPACITY_BASE = 0.42;

const PLAN_ROOF_FILL_OPACITY_BASE = 0.32;

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
  const fillOpacity = Math.min(0.65, Math.max(0.12, baseOp * Math.min(1.35, lwh / 1.12)));
  grp.add(horizontalOutlineMesh(outlineMm, fillY, color, fillOpacity, opts.pickId));

  // Floor hatch — 45° diagonal lines at 500 mm spacing, subtle overlay.
  if (opts.kind === 'floor' && outlineMm.length >= 3) {
    const hatch = hatchPolygon2D(
      outlineMm,
      500,
      fillY + 0.002,
      readToken('--draft-cut', '#1d2330'),
      0.12,
    );
    if (hatch) grp.add(hatch);
  }

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
  const joinDisallowStart =
    typeof row.joinDisallowStart === 'boolean' ? row.joinDisallowStart : undefined;
  const joinDisallowEnd =
    typeof row.joinDisallowEnd === 'boolean' ? row.joinDisallowEnd : undefined;
  return {
    kind: 'wall',
    id: String(row.id ?? ''),
    name: 'Wall',
    levelId: String(row.levelId ?? ''),
    start: coerceVec2Mm(row.startMm),
    end: coerceVec2Mm(row.endMm),
    thicknessMm: baseT * scale,
    heightMm: Number(row.heightMm ?? 2800),
    ...(joinDisallowStart !== undefined ? { joinDisallowStart } : {}),
    ...(joinDisallowEnd !== undefined ? { joinDisallowEnd } : {}),
  };
}

function mergeWireWallWithLiveState(
  wireWall: Extract<Element, { kind: 'wall' }>,
  elementsById: Record<string, Element>,
): Extract<Element, { kind: 'wall' }> {
  const live = elementsById[wireWall.id];
  if (!live || live.kind !== 'wall') return wireWall;
  return {
    ...live,
    levelId: wireWall.levelId,
    start: wireWall.start,
    end: wireWall.end,
    thicknessMm: wireWall.thicknessMm,
    heightMm: wireWall.heightMm,
    joinDisallowStart: wireWall.joinDisallowStart ?? live.joinDisallowStart,
    joinDisallowEnd: wireWall.joinDisallowEnd ?? live.joinDisallowEnd,
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
    activeLevelId?: string;
    activeViewId?: string;
    selectedId?: string;
    presentation?: PlanPresentationPreset;
    hiddenSemanticKinds?: ReadonlySet<string>;
    wirePrimitives: PlanProjectionPrimitivesV1Wire;
    roomFillOpacityScale?: number;
    planAnnotationHints?: PlanAnnotationHintsResolved | null;
    planTagFontScales?: { opening: number; room: number } | null;
    detailLevel?: 'coarse' | 'medium' | 'fine';
    /** CAN-V3-01: when projMinor is null, floor/roof outlines are suppressed entirely. */
    lineWeights?: LineWeights | null;
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
  const kindHidden = (kind: string): boolean => opts.hiddenSemanticKinds?.has(kind) ?? false;
  const wireDetail = opts.detailLevel ?? 'medium';

  const wallsRaw = Array.isArray(prim.walls) ? (prim.walls as Record<string, unknown>[]) : [];
  const wallsByWireId = new Map<string, Extract<Element, { kind: 'wall' }>>();
  for (const row of wallsRaw) {
    const id = String(row.id ?? '');
    if (!id) continue;
    wallsByWireId.set(id, wallElemFromWirePrimitive(row));
  }

  const rawJoinSummary = (opts.wirePrimitives as Record<string, unknown>)?.wallCornerJoinSummary_v1;
  const joinRecords: WallJoinRecord[] = Array.isArray(
    (rawJoinSummary as Record<string, unknown>)?.joins,
  )
    ? ((rawJoinSummary as { joins: unknown[] }).joins as WallJoinRecord[])
    : [];

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
    const overrideRaw = r.roomFillOverrideHex ?? r.room_fill_override_hex;
    const roomFillOverrideHex =
      typeof overrideRaw === 'string' && /^#[0-9a-fA-F]{6}$/.test(overrideRaw.trim())
        ? overrideRaw.trim()
        : undefined;
    const patternRaw = r.roomFillPatternOverride ?? r.room_fill_pattern_override;
    const roomFillPatternOverride =
      typeof patternRaw === 'string' &&
      ['solid', 'hatch_45', 'hatch_90', 'crosshatch', 'dots'].includes(patternRaw.trim())
        ? (patternRaw.trim() as 'solid' | 'hatch_45' | 'hatch_90' | 'crosshatch' | 'dots')
        : undefined;
    const mesh = roomMesh(roomEl, presentation, {
      schemeColorHex: schemeHex,
      roomFillOpacityScale,
      roomFillOverrideHex,
      roomFillPatternOverride,
    });
    holder.add(mesh);
    if (ann?.roomLabelsVisible === true && typeof mesh.userData.roomLabel === 'object') {
      const rl = mesh.userData.roomLabel as { cx?: number; cz?: number; areaMm2?: number };
      const base = typeof r.planTagLabel === 'string' ? r.planTagLabel.trim() : '';
      const areaMm2 = typeof rl?.areaMm2 === 'number' ? rl.areaMm2 : 0;
      const areaText = areaMm2 > 0 ? `${(areaMm2 / 1_000_000).toFixed(1)} m²` : '';
      const labelRaw = base && areaText ? `${base} · ${areaText}` : base || areaText;
      if (labelRaw) {
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

  addPlacedAssetPlanSymbols(holder, elementsById, {
    activeLevelId: opts.activeLevelId,
    kindHidden,
  });
  addFamilyInstancePlanSymbols(holder, elementsById, {
    activeLevelId: opts.activeLevelId,
    activeViewId: opts.activeViewId,
    detailLevel: wireDetail,
    kindHidden,
  });

  const suppressProjection = opts.lineWeights?.projMinor === null;

  const floors = Array.isArray(prim.floors) ? (prim.floors as Record<string, unknown>[]) : [];
  if (!suppressProjection) {
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
  }

  const roofs = Array.isArray(prim.roofs) ? (prim.roofs as Record<string, unknown>[]) : [];
  if (!suppressProjection) {
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
  }

  // Build a merged elementsById that includes wire-sourced walls for join lookups
  const elementsWithWireWalls: Record<string, Element> = { ...elementsById };
  for (const [id, w] of wallsByWireId.entries()) {
    elementsWithWireWalls[id] = mergeWireWallWithLiveState(w, elementsById);
  }

  for (const w of wallsByWireId.values()) {
    const mergedWall = elementsWithWireWalls[w.id];
    const renderWall: Extract<Element, { kind: 'wall' }> =
      mergedWall?.kind === 'wall' ? mergedWall : w;
    const joinsForWall = joinRecords.filter((j) => j.wallIds.includes(renderWall.id));
    const outlineMm = computeWallSectionPolygon(renderWall, joinsForWall, elementsWithWireWalls);
    if (outlineMm.length >= 3) {
      holder.add(planWallSectionMesh(renderWall, outlineMm, selectedId));
    } else {
      holder.add(planWallMesh(renderWall, selectedId, 1, elementsById, wireDetail));
    }
  }

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
    const doorGrp = doorGroupThree(
      doorEl,
      host,
      selectedId,
      presentation === 'opening_focus',
      opts.detailLevel,
    );
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
    const winGrp = planWindowMesh(
      winEl,
      host,
      selectedId,
      presentation === 'opening_focus',
      opts.detailLevel,
    );
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

  // KRN-04: render frameless wall_opening cuts as plan rectangles. These don't
  // come through the server prim emission path yet — read directly from
  // elementsById and resolve their host wall.
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall_opening') continue;
    const host = resolveWallForWire(el.hostWallId, elementsById, wallsByWireId);
    if (!host) continue;
    holder.add(planWallOpeningMesh(el, host, selectedId));
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
    const g = stairPlanThree(stairEl, elementsById, wireDoc, opts.detailLevel);
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

function addPlacedAssetPlanSymbols(
  holder: THREE.Object3D,
  elementsById: Record<string, Element>,
  opts: {
    activeLevelId?: string;
    kindHidden?: (kind: string) => boolean;
  },
): void {
  if (opts.kindHidden?.('placed_asset')) return;

  const assetEntries: Record<string, AssetLibraryEntryElement> = {};
  for (const e of Object.values(elementsById)) {
    if (e.kind === 'asset_library_entry') {
      assetEntries[e.id] = e as AssetLibraryEntryElement;
    }
  }

  const placedAssets = Object.values(elementsById).filter(
    (e): e is PlacedAssetElement =>
      e.kind === 'placed_asset' && (!opts.activeLevelId || e.levelId === opts.activeLevelId),
  );

  for (const asset of placedAssets) {
    const entry = assetEntries[asset.assetId];
    holder.add(makePlacedAssetPlanSymbol(asset, entry, { y: PLAN_Y + 0.045 }));
  }
}

/**
 * VIE-03: model bounds (walls + floors + roofs) used to anchor an elevation
 * marker on the corresponding bounding-box edge.
 */
export function modelXyBoundsMm(
  elementsById: Record<string, Element>,
): { minXmm: number; minYmm: number; maxXmm: number; maxYmm: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const pushWallCurveBounds = (wall: Extract<Element, { kind: 'wall' }>) => {
    const curve = wall.wallCurve;
    if (!curve || curve.kind !== 'arc') return;
    const sweepRad = THREE.MathUtils.degToRad(curve.sweepDeg);
    const startRad = THREE.MathUtils.degToRad(curve.startAngleDeg);
    const steps = Math.max(8, Math.ceil(Math.abs(sweepRad) / (Math.PI / 24)));
    const radiusMm = curve.radiusMm + wall.thicknessMm / 2;
    for (let i = 0; i <= steps; i++) {
      const a = startRad + (sweepRad * i) / steps;
      xs.push(curve.center.xMm + Math.cos(a) * radiusMm);
      ys.push(curve.center.yMm + Math.sin(a) * radiusMm);
    }
  };
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'wall') {
      xs.push(el.start.xMm, el.end.xMm);
      ys.push(el.start.yMm, el.end.yMm);
      pushWallCurveBounds(el);
    } else if (el.kind === 'floor') {
      for (const p of el.boundaryMm) {
        xs.push(p.xMm);
        ys.push(p.yMm);
      }
    } else if (el.kind === 'roof') {
      for (const p of el.footprintMm) {
        xs.push(p.xMm);
        ys.push(p.yMm);
      }
    }
  }
  if (xs.length === 0 || ys.length === 0) return null;
  return {
    minXmm: Math.min(...xs),
    minYmm: Math.min(...ys),
    maxXmm: Math.max(...xs),
    maxYmm: Math.max(...ys),
  };
}

/**
 * VIE-03: anchor point + view direction for an elevation_view marker, in mm.
 * `anchor` sits on the bounding-box edge facing the viewer; `viewX/viewY` is
 * the unit vector from the viewer toward the model (also the triangle's tip
 * direction).
 */
export function elevationMarkerAnchorMm(
  ev: Extract<Element, { kind: 'elevation_view' }>,
  bounds: { minXmm: number; minYmm: number; maxXmm: number; maxYmm: number },
  marginMm = 1500,
): { anchorXmm: number; anchorYmm: number; viewX: number; viewY: number } {
  const cx = 0.5 * (bounds.minXmm + bounds.maxXmm);
  const cy = 0.5 * (bounds.minYmm + bounds.maxYmm);
  switch (ev.direction) {
    case 'north':
      return { anchorXmm: cx, anchorYmm: bounds.maxYmm + marginMm, viewX: 0, viewY: -1 };
    case 'south':
      return { anchorXmm: cx, anchorYmm: bounds.minYmm - marginMm, viewX: 0, viewY: 1 };
    case 'east':
      return { anchorXmm: bounds.maxXmm + marginMm, anchorYmm: cy, viewX: -1, viewY: 0 };
    case 'west':
      return { anchorXmm: bounds.minXmm - marginMm, anchorYmm: cy, viewX: 1, viewY: 0 };
    case 'custom': {
      const ang = ((ev.customAngleDeg ?? 0) * Math.PI) / 180;
      const radius =
        Math.max(bounds.maxXmm - bounds.minXmm, bounds.maxYmm - bounds.minYmm) / 2 + marginMm;
      // Viewer stands along +ang from centroid; view direction points back at centroid.
      return {
        anchorXmm: cx + Math.cos(ang) * radius,
        anchorYmm: cy + Math.sin(ang) * radius,
        viewX: -Math.cos(ang),
        viewY: -Math.sin(ang),
      };
    }
  }
}

function elevationViewPlanThree(
  ev: Extract<Element, { kind: 'elevation_view' }>,
  elementsById: Record<string, Element>,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = ev.id;
  group.userData.bimElevationViewId = ev.id;

  const bounds = modelXyBoundsMm(elementsById) ?? {
    minXmm: -5000,
    minYmm: -5000,
    maxXmm: 5000,
    maxYmm: 5000,
  };
  const { anchorXmm, anchorYmm, viewX, viewY } = elevationMarkerAnchorMm(ev, bounds);

  const ax = ux(anchorXmm);
  const az = uz(anchorYmm);
  const Y = PLAN_Y + 0.008;
  const color = readToken('--cat-section', '#ef4444');

  // Triangle pointing in the view direction (toward the model).
  const TRI_LEN = 0.6;
  const TRI_HALF = 0.35;
  // Tangent perpendicular to view direction in plan (right-hand).
  const tx = -viewY;
  const ty = viewX;
  const tipX = ax + viewX * TRI_LEN;
  const tipZ = az + viewY * TRI_LEN;
  const baseLx = ax + tx * TRI_HALF;
  const baseLz = az + ty * TRI_HALF;
  const baseRx = ax - tx * TRI_HALF;
  const baseRz = az - ty * TRI_HALF;

  const triPts = [
    new THREE.Vector3(baseLx, Y, baseLz),
    new THREE.Vector3(tipX, Y, tipZ),
    new THREE.Vector3(baseRx, Y, baseRz),
    new THREE.Vector3(baseLx, Y, baseLz),
  ];
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(triPts),
      new THREE.LineBasicMaterial({ color }),
    ),
  );

  // Filled triangle so the cardinal direction reads at a glance.
  const fillGeom = new THREE.BufferGeometry();
  const fillVerts = new Float32Array([
    baseLx,
    Y - 0.0005,
    baseLz,
    tipX,
    Y - 0.0005,
    tipZ,
    baseRx,
    Y - 0.0005,
    baseRz,
  ]);
  fillGeom.setAttribute('position', new THREE.BufferAttribute(fillVerts, 3));
  fillGeom.setIndex([0, 1, 2]);
  fillGeom.computeVertexNormals();
  const fillMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const fill = new THREE.Mesh(fillGeom, fillMat);
  fill.userData.bimPickId = ev.id;
  fill.userData.bimElevationViewId = ev.id;
  group.add(fill);

  // Callout line from the anchor toward the bounding-box centroid so the
  // marker visually "looks at" the model.
  const cx = ux(0.5 * (bounds.minXmm + bounds.maxXmm));
  const cz = uz(0.5 * (bounds.minYmm + bounds.maxYmm));
  const calloutPts = [new THREE.Vector3(tipX, Y, tipZ), new THREE.Vector3(cx, Y, cz)];
  const calloutGeom = new THREE.BufferGeometry().setFromPoints(calloutPts);
  const calloutMat = new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12 });
  const callout = new THREE.Line(calloutGeom, calloutMat);
  callout.computeLineDistances();
  group.add(callout);

  return group;
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
    /** F-014: when set, kinds in this set render in magenta (55% opacity) instead of being hidden. */
    revealHiddenKinds?: ReadonlySet<string>;
    /** F-102: element IDs individually hidden in this plan view. */
    hiddenElementIds?: ReadonlySet<string>;
    /** F-102: element IDs that are individually hidden but shown magenta in reveal mode. */
    revealHiddenElementIds?: ReadonlySet<string>;
    wirePrimitives?: PlanProjectionPrimitivesV1Wire | null;
    activeViewId?: string;
    planGraphicHints?: PlanGraphicHintsResolved | null;
    planAnnotationHints?: PlanAnnotationHintsResolved | null;
    planTagFontScales?: { opening: number; room: number } | null;
    /** B01: current plot scale denominator (1:N) so mesh builders can be scale-aware. */
    plotScale?: number;
    /** CAN-V3-01: structured line-weight set; null projMinor suppresses floor/roof draw calls. */
    lineWeights?: LineWeights | null;
  },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  const gh = opts.planGraphicHints;
  const roomFillOpacityScale = gh?.roomFillOpacityScale ?? 1;
  const lineWeightScale = gh?.lineWeightScale ?? 1;
  // VIE-01: route the active plan view's detail level into the per-kind mesh
  // builders so coarse / medium / fine actually differ on screen.
  const detailLevel: 'coarse' | 'medium' | 'fine' =
    gh?.detailLevel === 'coarse' || gh?.detailLevel === 'fine' ? gh.detailLevel : 'medium';

  if (opts.wirePrimitives && isPlanProjectionPrimitivesV1(opts.wirePrimitives)) {
    rebuildPlanMeshesFromWire(holder, elementsById, {
      activeLevelId: opts.activeLevelId,
      activeViewId: opts.activeViewId,
      selectedId: opts.selectedId,
      presentation: opts.presentation,
      hiddenSemanticKinds: opts.hiddenSemanticKinds,
      wirePrimitives: opts.wirePrimitives,
      roomFillOpacityScale,
      planAnnotationHints: opts.planAnnotationHints ?? null,
      planTagFontScales: opts.planTagFontScales ?? null,
      detailLevel,
      lineWeights: opts.lineWeights,
    });
    return;
  }

  const level = opts.activeLevelId;
  const presentation = opts.presentation ?? 'default';
  const hidden = opts.hiddenSemanticKinds;
  const revealed = opts.revealHiddenKinds;
  // F-014: in reveal mode, nothing is actually hidden (show all elements)
  const kindHidden = (k: string) => (hidden?.has(k) ?? false) && !(revealed?.has(k) ?? false);
  const kindRevealMagenta = (k: string) => Boolean(revealed?.has(k));

  /** Tint all mesh/line children of obj to magenta at 55% opacity. */
  function tintMagenta(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh | THREE.Line;
      if (!(mesh instanceof THREE.Mesh) && !(mesh instanceof THREE.Line)) return;
      if (!mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((m: THREE.Material) => {
        const c = m.clone();
        if ('color' in c) (c as unknown as { color: THREE.Color }).color.setHex(0xff00ff);
        (c as unknown as { transparent: boolean; opacity: number }).transparent = true;
        (c as unknown as { transparent: boolean; opacity: number }).opacity = 0.55;
        return c;
      });
    });
  }

  type WallElem = Extract<Element, { kind: 'wall' }>;

  const walls = Object.values(elementsById).filter(
    (e): e is WallElem =>
      e.kind === 'wall' && !kindHidden('wall') && (!level || e.levelId === level),
  );

  const wallsById: Record<string, WallElem> = Object.fromEntries(walls.map((w) => [w.id, w]));

  /** Helper: tint children added since beforeIdx with magenta if the kind is revealed. */
  function tintNewChildren(beforeIdx: number, kind: string): void {
    if (!kindRevealMagenta(kind)) return;
    for (let i = beforeIdx; i < holder.children.length; i++) {
      tintMagenta(holder.children[i]!);
    }
  }

  {
    const before = holder.children.length;
    for (const g of Object.values(elementsById)) {
      if (g.kind !== 'grid_line') continue;
      if (kindHidden('grid_line')) continue;
      if (g.levelId && level && g.levelId !== level) continue;
      holder.add(gridLineThree(g));
    }
    tintNewChildren(before, 'grid_line');
  }

  // KRN-05: project-scope reference planes (dashed grey line + label).
  {
    let rpAutoIdx = 0;
    const before = holder.children.length;
    for (const rp of Object.values(elementsById)) {
      if (rp.kind !== 'reference_plane') continue;
      if (kindHidden('reference_plane')) continue;
      // Skip the family-editor variant (no levelId).
      if (!('levelId' in rp) || typeof rp.levelId !== 'string') continue;
      if (level && rp.levelId !== level) continue;
      rpAutoIdx += 1;
      holder.add(referencePlanePlanThree(rp, `RP-${rpAutoIdx}`));
    }
    tintNewChildren(before, 'reference_plane');
  }

  // KRN-01: property lines render in plan regardless of active level (site-wide).
  {
    const before = holder.children.length;
    for (const pl of Object.values(elementsById)) {
      if (pl.kind !== 'property_line') continue;
      if (kindHidden('property_line')) continue;
      holder.add(propertyLinePlanThree(pl));
    }
    tintNewChildren(before, 'property_line');
  }

  {
    const before = holder.children.length;
    for (const r of Object.values(elementsById)) {
      if (r.kind !== 'room') continue;
      if (kindHidden('room')) continue;
      if (level && r.levelId !== level) continue;
      holder.add(roomMesh(r, presentation, { roomFillOpacityScale }));
    }
    tintNewChildren(before, 'room');
  }

  // F-114: placed_asset schematic plan symbols (rectangle outline + cross diagonal).
  {
    const before = holder.children.length;
    addPlacedAssetPlanSymbols(holder, elementsById, { activeLevelId: level, kindHidden });
    tintNewChildren(before, 'placed_asset');
  }

  {
    const before = holder.children.length;
    addFamilyInstancePlanSymbols(holder, elementsById, {
      activeLevelId: level,
      activeViewId: opts.activeViewId,
      detailLevel,
      kindHidden,
    });
    tintNewChildren(before, 'family_instance');
  }

  // CAN-V3-01: floor/roof outlines are projection geometry — suppress when projMajor is null (1:500+).
  const suppressProjectionFallback = opts.lineWeights != null && opts.lineWeights.projMajor == null;

  if (!suppressProjectionFallback) {
    {
      const before = holder.children.length;
      for (const f of Object.values(elementsById)) {
        if (f.kind !== 'floor') continue;
        if (kindHidden('floor')) continue;

        if (level && f.levelId !== level) continue;

        const floorFillY = PLAN_Y + 0.001;
        holder.add(
          horizontalOutlineMesh(
            f.boundaryMm,
            floorFillY,
            getPlanPalette().floorOutline,
            PLAN_FLOOR_FILL_OPACITY_BASE,
            f.id,
          ),
        );
        const floorHatch = hatchPolygon2D(
          f.boundaryMm,
          500,
          floorFillY + 0.002,
          readToken('--draft-cut', '#1d2330'),
          0.12,
        );
        if (floorHatch) holder.add(floorHatch);
      }
      tintNewChildren(before, 'floor');
    }

    {
      const before = holder.children.length;
      for (const rf of Object.values(elementsById)) {
        if (rf.kind !== 'roof') continue;
        if (kindHidden('roof')) continue;

        if (level && rf.referenceLevelId !== level) continue;

        holder.add(
          horizontalOutlineMesh(
            rf.footprintMm,
            PLAN_Y + 0.004,
            getPlanPalette().roofOutline,
            PLAN_ROOF_FILL_OPACITY_BASE,
            rf.id,
          ),
        );
      }
      tintNewChildren(before, 'roof');
    }
  }

  {
    const before = holder.children.length;
    for (const cl of Object.values(elementsById)) {
      if (cl.kind !== 'ceiling') continue;
      if (kindHidden('ceiling')) continue;
      if (level && cl.levelId !== level) continue;
      holder.add(
        horizontalOutlineMesh(
          cl.boundaryMm,
          PLAN_Y + 0.003,
          getPlanPalette().floorOutline,
          PLAN_FLOOR_FILL_OPACITY_BASE * 0.7,
          cl.id,
        ),
      );
    }
    tintNewChildren(before, 'ceiling');
  }

  {
    const before = holder.children.length;
    for (const wall of walls)
      holder.add(planWallMesh(wall, opts.selectedId, lineWeightScale, elementsById, detailLevel));
    tintNewChildren(before, 'wall');
  }

  {
    const before = holder.children.length;
    for (const rs of Object.values(elementsById)) {
      if (rs.kind !== 'room_separation') continue;
      if (kindHidden('room_separation')) continue;
      if (level && rs.levelId !== level) continue;
      holder.add(roomSeparationLineFromMm(rs.start, rs.end, rs.id));
    }
    tintNewChildren(before, 'room_separation');
  }

  {
    const before = holder.children.length;
    for (const d of Object.values(elementsById)) {
      if (d.kind !== 'door') continue;
      if (kindHidden('door')) continue;

      const host = wallsById[d.wallId];

      if (!host) continue;

      holder.add(
        doorGroupThree(d, host, opts.selectedId, presentation === 'opening_focus', detailLevel),
      );
    }
    tintNewChildren(before, 'door');
  }

  {
    const before = holder.children.length;
    for (const win of Object.values(elementsById)) {
      if (win.kind !== 'window') continue;
      if (kindHidden('window')) continue;

      const host = wallsById[win.wallId];

      if (!host) continue;

      holder.add(
        planWindowMesh(win, host, opts.selectedId, presentation === 'opening_focus', detailLevel),
      );
    }
    tintNewChildren(before, 'window');
  }

  {
    const before = holder.children.length;
    for (const st of Object.values(elementsById)) {
      if (st.kind !== 'stair') continue;
      if (kindHidden('stair')) continue;
      if (level && st.baseLevelId !== level) continue;
      const g = stairPlanThree(st, elementsById, undefined, detailLevel);

      if (g) holder.add(g);
    }
    tintNewChildren(before, 'stair');
  }

  // KRN-14: dormer plan symbols (dashed outline + "DR" label) on the host
  // roof's reference-level plan view only.
  {
    const before = holder.children.length;
    for (const dm of Object.values(elementsById)) {
      if (dm.kind !== 'dormer') continue;
      if (kindHidden('dormer' as never)) continue;
      const g = dormerPlanGroup(dm, elementsById, level ?? null);
      if (g) holder.add(g);
    }
    tintNewChildren(before, 'dormer');
  }

  {
    const before = holder.children.length;
    for (const dm of Object.values(elementsById)) {
      if (dm.kind !== 'dimension') continue;
      if (kindHidden('dimension')) continue;

      if (level && dm.levelId !== level) continue;

      holder.add(dimensionsThree(dm));
    }
    tintNewChildren(before, 'dimension');
  }

  {
    const before = holder.children.length;
    for (const sc of Object.values(elementsById)) {
      if (sc.kind !== 'section_cut') continue;
      if (kindHidden('section_cut')) continue;
      holder.add(sectionCutPlanThree(sc));
    }
    tintNewChildren(before, 'section_cut');
  }

  // VIE-03: triangular markers for first-class elevation views.
  {
    const before = holder.children.length;
    for (const ev of Object.values(elementsById)) {
      if (ev.kind !== 'elevation_view') continue;
      if (kindHidden('elevation_view')) continue;
      holder.add(elevationViewPlanThree(ev, elementsById));
    }
    tintNewChildren(before, 'elevation_view');
  }

  // KRN-06: plan-canvas 2D origin markers (F-022 extension).
  // Renders project_base_point (blue cross-in-circle) and survey_point (green triangle)
  // gated by the site_origin VG category visibility.
  if (!kindHidden('site_origin')) {
    const Y = PLAN_Y + 0.009;

    for (const el of Object.values(elementsById)) {
      if (el.kind !== 'project_base_point' && el.kind !== 'survey_point') continue;
      const pos = (el as { positionMm: { xMm: number; yMm: number } }).positionMm;
      const xM = ux(pos.xMm);
      const zM = uz(pos.yMm);

      if (el.kind === 'project_base_point') {
        // Blue cross-in-circle marker
        const color = 0x2563eb;
        const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
        const r = 0.3; // 300 mm radius

        // Circle outline (approximated with segments)
        const circlePoints: THREE.Vector3[] = [];
        const segs = 32;
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          circlePoints.push(new THREE.Vector3(xM + Math.cos(a) * r, Y, zM + Math.sin(a) * r));
        }
        const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
        const circleLine = new THREE.Line(circleGeo, mat);
        circleLine.renderOrder = 990;
        circleLine.userData.bimPickId = el.id;
        holder.add(circleLine);

        // Cross
        const crossMat = new THREE.LineBasicMaterial({ color, depthTest: false });
        const crossH = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xM - r, Y, zM),
            new THREE.Vector3(xM + r, Y, zM),
          ]),
          crossMat,
        );
        const crossV = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xM, Y, zM - r),
            new THREE.Vector3(xM, Y, zM + r),
          ]),
          crossMat,
        );
        crossH.renderOrder = 990;
        crossV.renderOrder = 990;
        crossH.userData.bimPickId = el.id;
        crossV.userData.bimPickId = el.id;
        holder.add(crossH, crossV);
      } else {
        // survey_point — green triangle marker
        const color = 0x16a34a;
        const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
        const s = 0.3;
        const h = (s * Math.sqrt(3)) / 2;
        const triPts = [
          new THREE.Vector3(xM, Y, zM - h * (2 / 3)),
          new THREE.Vector3(xM + s / 2, Y, zM + h * (1 / 3)),
          new THREE.Vector3(xM - s / 2, Y, zM + h * (1 / 3)),
          new THREE.Vector3(xM, Y, zM - h * (2 / 3)),
        ];
        const triGeo = new THREE.BufferGeometry().setFromPoints(triPts);
        const triLine = new THREE.Line(triGeo, mat);
        triLine.renderOrder = 990;
        triLine.userData.bimPickId = el.id;
        holder.add(triLine);
      }
    }
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
