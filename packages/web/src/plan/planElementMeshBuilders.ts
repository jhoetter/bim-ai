import * as THREE from 'three';

import { curtainGridCellId, type Element, type WallLocationLine } from '@bim-ai/core';
import { materialBaseColor } from '../viewport/materials';
import type { PlanDetailLevel } from './planDetailLevelLines';

import { deterministicSchemeColorHex } from './roomSchemeColor';
import {
  ux,
  uz,
  segmentDir,
  getPlanPalette,
  readToken,
  centroidMm,
  polygonAreaMm2,
  PLAN_Y,
  PLAN_WALL_CENTER_SLICE_HEIGHT_M,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS,
  PLAN_WINDOW_SILL_LINE_WIDTH,
} from './symbology';
import type { PlanPresentationPreset, StairPlanWireDocOverlays } from './symbology';
import { getBuiltInWallType, materialHexFor } from '../families/wallTypeCatalog';
import { darkenHex } from '../viewport/meshBuilders.layeredWall';
import { spiralStairPlanGroup, sketchStairPlanGroup } from './stairPlanSymbol';

export type WallJoinRecord = {
  joinId: string;
  wallIds: [string, string];
  vertexMm: { xMm: number; yMm: number };
  levelId: string;
  joinKind: 'butt' | 'miter_candidate' | 'unsupported_skew' | 'proxy_overlap';
  planDisplayToken: string;
  affectedOpeningIds: string[];
  skipReason: string | null;
};

type RoomFillPatternOverride = NonNullable<
  Extract<Element, { kind: 'room' }>['roomFillPatternOverride']
>;

const ROOM_FILL_PATTERN_VALUES = new Set<string>([
  'solid',
  'hatch_45',
  'hatch_90',
  'crosshatch',
  'dots',
]);

function planLocationLineOffsetFrac(loc: WallLocationLine): number {
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

function wallCurvePointsMm(
  curve: NonNullable<Extract<Element, { kind: 'wall' }>['wallCurve']>,
  radiusOrOffsetMm: number,
): Array<{ xMm: number; yMm: number }> {
  if (curve.kind === 'bezier') {
    const pts: Array<{ xMm: number; yMm: number }> = [];
    const cp = curve.controlPoints;
    const steps = 32;
    const pointAt = (t: number) => {
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const c = 3 * mt * t * t;
      const d = t * t * t;
      return {
        xMm: a * cp[0].xMm + b * cp[1].xMm + c * cp[2].xMm + d * cp[3].xMm,
        yMm: a * cp[0].yMm + b * cp[1].yMm + c * cp[2].yMm + d * cp[3].yMm,
      };
    };
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = pointAt(t);
      const prev = pointAt(Math.max(0, t - 1 / steps));
      const next = pointAt(Math.min(1, t + 1 / steps));
      const dx = next.xMm - prev.xMm;
      const dy = next.yMm - prev.yMm;
      const len = Math.hypot(dx, dy) || 1;
      pts.push({
        xMm: p.xMm + (-dy / len) * radiusOrOffsetMm,
        yMm: p.yMm + (dx / len) * radiusOrOffsetMm,
      });
    }
    return pts;
  }
  const sweepRad = THREE.MathUtils.degToRad(curve.sweepDeg);
  const startRad = THREE.MathUtils.degToRad(curve.startAngleDeg);
  const steps = Math.max(8, Math.ceil(Math.abs(sweepRad) / (Math.PI / 24)));
  const pts: Array<{ xMm: number; yMm: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startRad + (sweepRad * i) / steps;
    pts.push({
      xMm: curve.center.xMm + Math.cos(angle) * radiusOrOffsetMm,
      yMm: curve.center.yMm + Math.sin(angle) * radiusOrOffsetMm,
    });
  }
  return pts;
}

function planCurvedWallMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  lineWeightScale = 1,
): THREE.Object3D {
  const curve = wall.wallCurve;
  if (!curve) return new THREE.Group();

  const p = getPlanPalette();
  const fillColor = wall.id === selectedId ? p.wallSelected : p.wallFill;
  const thickMm = THREE.MathUtils.clamp(wall.thicknessMm * lineWeightScale, 20, 1800);
  const locFrac = planLocationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
  const outer =
    curve.kind === 'arc'
      ? wallCurvePointsMm(curve, Math.max(1, curve.radiusMm + locFrac * thickMm + thickMm / 2))
      : wallCurvePointsMm(curve, locFrac * thickMm + thickMm / 2);
  const inner =
    curve.kind === 'arc'
      ? wallCurvePointsMm(
          curve,
          Math.max(1, curve.radiusMm + locFrac * thickMm - thickMm / 2),
        ).reverse()
      : wallCurvePointsMm(curve, locFrac * thickMm - thickMm / 2).reverse();
  const outline = [...outer, ...inner];

  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;
  if (outline.length < 4) return group;

  const shape = new THREE.Shape();
  shape.moveTo(ux(outline[0]!.xMm), -uz(outline[0]!.yMm));
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(ux(outline[i]!.xMm), -uz(outline[i]!.yMm));
  }
  shape.closePath();

  const fillMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: fillColor, depthWrite: false }),
  );
  fillMesh.rotation.x = -Math.PI / 2;
  fillMesh.position.y = PLAN_Y;
  fillMesh.userData.bimPickId = wall.id;
  group.add(fillMesh);

  const outlinePts = outline.map((pt) => new THREE.Vector3(ux(pt.xMm), PLAN_Y + 0.001, uz(pt.yMm)));
  outlinePts.push(outlinePts[0]!.clone());
  const outlineLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePts),
    new THREE.LineBasicMaterial({
      color: readToken('--draft-cut', '#1d2330'),
      linewidth: 1,
      depthTest: false,
    }),
  );
  outlineLine.renderOrder = 3;
  outlineLine.userData.bimPickId = wall.id;
  group.add(outlineLine);

  if (wall.id !== selectedId && thickMm >= 40) {
    const centerline =
      curve.kind === 'arc'
        ? wallCurvePointsMm(curve, Math.max(1, curve.radiusMm + locFrac * thickMm))
        : wallCurvePointsMm(curve, locFrac * thickMm);
    const hatchPositions: number[] = [];
    const stride = Math.max(2, Math.floor(centerline.length / 12));
    for (let i = 1; i < centerline.length - 1; i += stride) {
      const pt = centerline[i]!;
      const prev = centerline[i - 1]!;
      const next = centerline[i + 1]!;
      const dx = next.xMm - prev.xMm;
      const dy = next.yMm - prev.yMm;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const half = thickMm * 0.32;
      hatchPositions.push(
        ux(pt.xMm - nx * half),
        PLAN_Y + 0.003,
        uz(pt.yMm - ny * half),
        ux(pt.xMm + nx * half),
        PLAN_Y + 0.003,
        uz(pt.yMm + ny * half),
      );
    }
    if (hatchPositions.length > 0) {
      const hatchGeo = new THREE.BufferGeometry();
      hatchGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(hatchPositions), 3),
      );
      const hatch = new THREE.LineSegments(
        hatchGeo,
        new THREE.LineBasicMaterial({
          color: new THREE.Color(readToken('--draft-paper', '#fdfcf9')),
          transparent: true,
          opacity: 0.35,
          depthTest: false,
        }),
      );
      hatch.renderOrder = 5;
      hatch.userData.bimPickId = wall.id;
      group.add(hatch);
    }
  }

  return group;
}

export function planWallMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  lineWeightScale = 1,
  elementsById?: Record<string, Element>,
  detailLevel: PlanDetailLevel = 'medium',
): THREE.Object3D {
  if (wall.wallCurve) {
    return planCurvedWallMesh(wall, selectedId, lineWeightScale);
  }

  const { lenM: len, nx, nz } = segmentDir(wall);

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const angle = Math.atan2(nz, nx);

  const thick = THREE.MathUtils.clamp((wall.thicknessMm * lineWeightScale) / 1000, 0.02, 1.8);

  const locFrac = planLocationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
  const perpX = -nz * locFrac * thick;
  const perpZ = nx * locFrac * thick;

  const geom = new THREE.BoxGeometry(len, PLAN_WALL_CENTER_SLICE_HEIGHT_M, thick);

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.82,

    metalness: 0.02,

    color: (() => {
      const p = getPlanPalette();
      return wall.id === selectedId ? p.wallSelected : p.wallFill;
    })(),
  });

  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.set(sx + (nx * len) / 2 + perpX, PLAN_Y, sz + (nz * len) / 2 + perpZ);

  mesh.rotation.y = -angle;

  mesh.userData.bimPickId = wall.id;

  const hatch =
    wall.id === selectedId
      ? null
      : buildWallCutHatch(len, thick, sx, sz, nx, nz, angle, perpX, perpZ);

  // FL-08 + VIE-01: when the wall has a wall_type, overlay layer boundary
  // lines — but gate by detail level (coarse drops them entirely so the wall
  // reads as a single solid bar; medium shows just the core boundaries; fine
  // shows the full layer stack).
  if (wall.wallTypeId && detailLevel !== 'coarse') {
    const lines = buildPlanWallLayerLines(wall, len, sx, sz, nx, nz, elementsById, detailLevel);
    if (lines) {
      const group = new THREE.Group();
      group.userData.bimPickId = wall.id;
      group.add(mesh);
      group.add(lines);
      if (hatch) group.add(hatch);
      return group;
    }
  }

  // KRN-09: per-cell curtain-panel fills overlaid on the plan box.
  if (wall.isCurtainWall && wall.curtainPanelOverrides) {
    const fills = buildCurtainPanelPlanFills(wall, len, sx, sz, nx, nz, thick);
    if (fills) {
      const group = new THREE.Group();
      group.userData.bimPickId = wall.id;
      group.add(mesh);
      group.add(fills);
      if (hatch) group.add(hatch);
      return group;
    }
  }

  if (hatch) {
    const group = new THREE.Group();
    group.userData.bimPickId = wall.id;
    group.add(mesh);
    group.add(hatch);
    return group;
  }
  return mesh;
}

/**
 * Generates diagonal 45° hatch lines inside the wall cut body for the plan
 * view — standard architectural section-cut (poché) convention.
 *
 * Works entirely in local wall space (X along wall axis, Z across thickness)
 * before the caller applies the world-space rotation.  Lines follow z = x + c
 * (slope +1) at evenly-spaced c values.
 */
function buildWallCutHatch(
  len: number,
  thick: number,
  sx: number,
  sz: number,
  nx: number,
  nz: number,
  angle: number,
  perpX: number,
  perpZ: number,
): THREE.LineSegments | null {
  // Skip walls that are too thin to be worth hatching.
  if (thick < 0.04) return null;

  const halfLen = len / 2;
  const halfThick = thick / 2;
  const spacing = Math.max(0.02, thick / 3);

  const cMin = -halfLen - halfThick;
  const cMax = halfLen + halfThick;

  const positions: number[] = [];

  for (let c = cMin; c <= cMax + 1e-9; c += spacing) {
    // Candidate intersection points of the line z = x + c with the rectangle.
    const candidates: { x: number; z: number }[] = [];

    // Left edge x = -halfLen
    const zLeft = -halfLen + c;
    if (zLeft >= -halfThick && zLeft <= halfThick) {
      candidates.push({ x: -halfLen, z: zLeft });
    }

    // Right edge x = halfLen
    const zRight = halfLen + c;
    if (zRight >= -halfThick && zRight <= halfThick) {
      candidates.push({ x: halfLen, z: zRight });
    }

    // Bottom edge z = -halfThick (strict interior to avoid duplicate corners)
    const xBot = -halfThick - c;
    if (xBot > -halfLen && xBot < halfLen) {
      candidates.push({ x: xBot, z: -halfThick });
    }

    // Top edge z = halfThick (strict interior)
    const xTop = halfThick - c;
    if (xTop > -halfLen && xTop < halfLen) {
      candidates.push({ x: xTop, z: halfThick });
    }

    if (candidates.length < 2) continue;

    // Sort by x and take the two extreme points as the segment endpoints.
    candidates.sort((a, b) => a.x - b.x);
    const p0 = candidates[0]!;
    const p1 = candidates[candidates.length - 1]!;

    positions.push(p0.x, 0, p0.z, p1.x, 0, p1.z);
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

  const hatchColor = readToken('--draft-paper', '#fdfcf9');
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(hatchColor),
    transparent: true,
    opacity: 0.35,
    depthTest: false, // overlay — must not be occluded by wall fill mesh
  });

  const lines = new THREE.LineSegments(geom, mat);
  lines.renderOrder = 5; // draw after all opaque geometry
  lines.position.set(sx + (nx * len) / 2 + perpX, PLAN_Y + 0.003, sz + (nz * len) / 2 + perpZ);
  lines.rotation.y = -angle;
  // Intentionally no bimPickId — hatch is purely visual, picking goes via the
  // group's userData.bimPickId set by the caller.
  return lines;
}

/**
 * KRN-09 — overlay short rectangular fills on a curtain wall's plan symbol,
 * one per overridden grid cell. Empty = white, system = registered material
 * colour, family_instance = placeholder magenta. Cells without overrides
 * leave the underlying wall-fill colour visible.
 */
function buildCurtainPanelPlanFills(
  wall: Extract<Element, { kind: 'wall' }>,
  lenM: number,
  sx: number,
  sz: number,
  nx: number,
  nz: number,
  thickM: number,
): THREE.Group | null {
  const overrides = wall.curtainPanelOverrides;
  if (!overrides) return null;
  const vCount =
    wall.curtainWallVCount != null
      ? Math.max(1, wall.curtainWallVCount)
      : Math.max(1, Math.round(wall.heightMm > 0 ? lenM / 1.5 : 1));
  const cellLenM = lenM / vCount;
  // The plan symbol is a flat rectangle; for each overridden cell we stack
  // a thin coloured tile slightly above the wall fill so it reads in the
  // top-down view without z-fighting.
  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;
  group.userData.curtainPanelFills = true;
  let added = 0;
  for (let v = 0; v < vCount; v++) {
    // The plan symbol collapses the H grid into a single strip — we colour
    // the cell stripe based on the override at row 0 if present, falling
    // back to any other row that has an override (so a wood panel shows
    // up regardless of which floor it sits on in the V/H grid).
    const cellOverride =
      overrides[curtainGridCellId(v, 0)] ??
      Object.entries(overrides).find(([k]) => k.startsWith(`v${v}h`))?.[1];
    if (!cellOverride) continue;
    let colorHex: string;
    if (cellOverride.kind === 'empty') colorHex = '#ffffff';
    else if (cellOverride.kind === 'family_instance') colorHex = '#ff66cc';
    else colorHex = materialBaseColor(cellOverride.materialKey);
    const tileGeom = new THREE.PlaneGeometry(cellLenM * 0.9, thickM * 0.9);
    const tileMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: cellOverride.kind === 'empty',
      opacity: cellOverride.kind === 'empty' ? 0.6 : 1.0,
      side: THREE.DoubleSide,
    });
    const tile = new THREE.Mesh(tileGeom, tileMat);
    const tCenter = (v + 0.5) / vCount;
    const cxMid = sx + nx * lenM * tCenter;
    const czMid = sz + nz * lenM * tCenter;
    tile.position.set(cxMid, PLAN_Y + 0.01, czMid);
    tile.rotation.x = -Math.PI / 2;
    tile.rotation.z = -Math.atan2(nz, nx);
    tile.userData.bimPickId = wall.id;
    tile.userData.curtainCellId = curtainGridCellId(v, 0);
    tile.userData.curtainPanelKind = cellOverride.kind;
    group.add(tile);
    added += 1;
  }
  return added > 0 ? group : null;
}

function resolvePlanWallAssembly(
  wallTypeId: string,
  elementsById?: Record<string, Element>,
): {
  basisLine: 'center' | 'face_interior' | 'face_exterior';
  layers: { thicknessMm: number; materialKey: string; function?: string }[];
} | null {
  const builtIn = getBuiltInWallType(wallTypeId);
  if (builtIn) {
    return {
      basisLine: builtIn.basisLine,
      layers: builtIn.layers.map((l) => ({
        thicknessMm: l.thicknessMm,
        materialKey: l.materialKey,
        function: l.function,
      })),
    };
  }
  if (!elementsById) return null;
  const el = elementsById[wallTypeId];
  if (!el || el.kind !== 'wall_type') return null;
  return {
    basisLine: (el.basisLine ?? 'center') as 'center' | 'face_interior' | 'face_exterior',
    layers: el.layers.map((l) => ({
      thicknessMm: Number(l.thicknessMm),
      materialKey: String(l.materialKey ?? ''),
      function:
        typeof (l as { function?: unknown }).function === 'string'
          ? String((l as { function: string }).function)
          : undefined,
    })),
  };
}

function buildPlanWallLayerLines(
  wall: Extract<Element, { kind: 'wall' }>,
  lenM: number,
  sx: number,
  sz: number,
  nx: number,
  nz: number,
  elementsById?: Record<string, Element>,
  detailLevel: PlanDetailLevel = 'fine',
): THREE.LineSegments | null {
  if (!wall.wallTypeId) return null;
  if (detailLevel === 'coarse') return null;
  const assembly = resolvePlanWallAssembly(wall.wallTypeId, elementsById);
  if (!assembly || assembly.layers.length === 0) return null;

  const totalThickMm = assembly.layers.reduce((acc, l) => acc + l.thicknessMm, 0);
  if (totalThickMm <= 0) return null;

  // Wall normal direction (perpendicular to (nx,nz) tangent in plan space).
  const perpX = -nz;
  const perpZ = nx;

  // Plan-space basis offset from wall centerline to the interior face.
  let cursorMm: number;
  switch (assembly.basisLine) {
    case 'face_exterior':
      cursorMm = totalThickMm / 2;
      break;
    case 'face_interior':
    case 'center':
    default:
      cursorMm = -totalThickMm / 2;
      break;
  }

  const positions: number[] = [];
  const colors: number[] = [];

  // Half-length along the wall axis in metres.
  const halfLenM = lenM / 2;
  const cxM = sx + (nx * lenM) / 2;
  const czM = sz + (nz * lenM) / 2;

  // VIE-01: at 'medium', emit only the boundaries that delimit the core
  // (transitions between structure and non-structure layers). At 'fine', emit
  // every boundary for the full layer stack.
  const includeBoundaryAtIndex = (i: number, prevFn: string | null): boolean => {
    if (detailLevel === 'fine') return true;
    if (detailLevel !== 'medium') return false;
    if (i === 0 || i === assembly.layers.length) {
      // Outer faces always render at medium so the wall reads as 2 lines for a
      // typical structure-only assembly.
      return true;
    }
    const layer = assembly.layers[i];
    const isStructure = (fn: string | undefined | null) => fn === 'structure';
    return isStructure(prevFn) !== isStructure(layer?.function ?? null);
  };

  // Boundary at the start of the stack:
  let prevCursorMm = cursorMm;
  let prevFn: string | null = null;
  for (let i = 0; i < assembly.layers.length; i++) {
    const layer = assembly.layers[i]!;
    if (includeBoundaryAtIndex(i, prevFn)) {
      const boundaryMm = prevCursorMm;
      const offM = boundaryMm / 1000;
      const ax = cxM + perpX * offM - nx * halfLenM;
      const az = czM + perpZ * offM - nz * halfLenM;
      const bx = cxM + perpX * offM + nx * halfLenM;
      const bz = czM + perpZ * offM + nz * halfLenM;
      const baseHex = materialHexFor(layer.materialKey);
      const lineHex = darkenHex(baseHex, 0.3);
      const color = new THREE.Color(lineHex);
      positions.push(ax, PLAN_Y + 0.005, az, bx, PLAN_Y + 0.005, bz);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    prevFn = layer.function ?? null;
    prevCursorMm += layer.thicknessMm;
  }
  // Final boundary at the exterior face — always emitted (at any detail level
  // ≥ medium it forms the outer wall outline).
  if (includeBoundaryAtIndex(assembly.layers.length, prevFn)) {
    const offM = prevCursorMm / 1000;
    const ax = cxM + perpX * offM - nx * halfLenM;
    const az = czM + perpZ * offM - nz * halfLenM;
    const bx = cxM + perpX * offM + nx * halfLenM;
    const bz = czM + perpZ * offM + nz * halfLenM;
    const lastLayer = assembly.layers[assembly.layers.length - 1]!;
    const lineHex = darkenHex(materialHexFor(lastLayer.materialKey), 0.3);
    const color = new THREE.Color(lineHex);
    positions.push(ax, PLAN_Y + 0.005, az, bx, PLAN_Y + 0.005, bz);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1 });
  const lines = new THREE.LineSegments(geom, lineMat);
  lines.userData.bimPickId = wall.id;
  lines.userData.layerBoundary = true;
  return lines;
}

/**
 * KRN-13: emit the per-operationType plan-symbol primitives in unrotated
 * door-local coords (door centred at origin; wall axis = +x, wall thickness = z).
 * The caller positions/rotates the returned children to align with the wall.
 */
export function planDoorSymbolPrimitives(
  door: Extract<Element, { kind: 'door' }>,
  width: number,
  openingFocus?: boolean,
): THREE.Object3D[] {
  const op = door.operationType ?? 'swing_single';
  const palette = getPlanPalette();
  const swingColor = openingFocus ? palette.doorSwingFocus : palette.doorSwing;
  const lineMat = new THREE.LineBasicMaterial({ color: swingColor, linewidth: 1 });
  const dashedMat = new THREE.LineDashedMaterial({
    color: swingColor,
    linewidth: 1,
    dashSize: 0.05,
    gapSize: 0.04,
  });

  const out: THREE.Object3D[] = [];
  const halfW = width / 2;

  const swingArc = (radius: number, sign: 1 | -1, hingeOffset: number): THREE.Line => {
    const swingMinor = openingFocus
      ? PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS
      : PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT;
    const r = radius / swingMinor;
    const start = Math.PI / 4;
    const end = Math.PI / 4 + Math.PI / (openingFocus ? 1.9 : 2.2);
    const curve = new THREE.EllipseCurve(0, 0, r, r, start, end);
    const pts = curve
      .getPoints(28)
      .map((p) => new THREE.Vector3(hingeOffset + sign * p.x, PLAN_Y + 0.03, -p.y));
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    arc.userData.bimPickId = door.id;
    return arc;
  };

  const lineFromPts = (pts: THREE.Vector3[], dashed = false): THREE.Line => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      dashed ? dashedMat : lineMat,
    );
    if (dashed) (line as THREE.Line).computeLineDistances();
    line.userData.bimPickId = door.id;
    return line;
  };

  switch (op) {
    case 'swing_single':
      out.push(swingArc(width, 1, -halfW));
      break;

    case 'swing_double':
      out.push(swingArc(width / 2, 1, -halfW));
      out.push(swingArc(width / 2, -1, halfW));
      break;

    case 'sliding_single': {
      const yLine = PLAN_Y + 0.03;
      out.push(
        lineFromPts([new THREE.Vector3(-halfW, yLine, 0), new THREE.Vector3(halfW, yLine, 0)]),
      );
      const arrowSize = Math.min(0.08, width * 0.08);
      out.push(
        lineFromPts([
          new THREE.Vector3(halfW - arrowSize, yLine, -arrowSize / 2),
          new THREE.Vector3(halfW, yLine, 0),
          new THREE.Vector3(halfW - arrowSize, yLine, arrowSize / 2),
        ]),
      );
      break;
    }

    case 'sliding_double': {
      const yLine = PLAN_Y + 0.03;
      out.push(
        lineFromPts([new THREE.Vector3(-halfW, yLine, 0), new THREE.Vector3(halfW, yLine, 0)]),
      );
      const arrow = Math.min(0.08, width * 0.08);
      out.push(
        lineFromPts([
          new THREE.Vector3(-halfW + arrow, yLine, -arrow / 2),
          new THREE.Vector3(-halfW, yLine, 0),
          new THREE.Vector3(-halfW + arrow, yLine, arrow / 2),
        ]),
      );
      out.push(
        lineFromPts([
          new THREE.Vector3(halfW - arrow, yLine, -arrow / 2),
          new THREE.Vector3(halfW, yLine, 0),
          new THREE.Vector3(halfW - arrow, yLine, arrow / 2),
        ]),
      );
      break;
    }

    case 'bi_fold': {
      const yLine = PLAN_Y + 0.03;
      const offset = width * 0.18;
      const quarter = width / 4;
      // Two zigzags: \/ on left half and \/ on right half.
      out.push(
        lineFromPts([
          new THREE.Vector3(-halfW, yLine, 0),
          new THREE.Vector3(-quarter, yLine, offset),
          new THREE.Vector3(0, yLine, 0),
          new THREE.Vector3(quarter, yLine, offset),
          new THREE.Vector3(halfW, yLine, 0),
        ]),
      );
      break;
    }

    case 'pocket': {
      // Dashed extent line indicating the wall pocket the panel slides into.
      const yLine = PLAN_Y + 0.03;
      out.push(
        lineFromPts(
          [new THREE.Vector3(-halfW - width, yLine, 0), new THREE.Vector3(-halfW, yLine, 0)],
          true,
        ),
      );
      // Solid panel rect inside the wall.
      out.push(
        lineFromPts([
          new THREE.Vector3(-halfW * 0.95, yLine, 0),
          new THREE.Vector3(halfW * 0.95, yLine, 0),
        ]),
      );
      break;
    }

    case 'pivot': {
      // Pivot dot offset from the leaf edge, plus an offset arc indicating swing.
      const pivotOffset = -halfW * 0.7;
      const pivotMat = new THREE.MeshBasicMaterial({ color: '#dc2626' });
      const pivotDot = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), pivotMat);
      pivotDot.rotation.x = -Math.PI / 2;
      pivotDot.position.set(pivotOffset, PLAN_Y + 0.04, 0);
      pivotDot.userData.bimPickId = door.id;
      out.push(pivotDot);
      out.push(swingArc(width * 0.7, 1, pivotOffset));
      break;
    }

    case 'automatic_double': {
      const yLine = PLAN_Y + 0.03;
      const arrow = Math.min(0.1, width * 0.1);
      // Two outward arrows pointing away from threshold.
      out.push(
        lineFromPts([
          new THREE.Vector3(0, yLine, 0),
          new THREE.Vector3(-halfW * 0.7, yLine, 0),
          new THREE.Vector3(-halfW * 0.7 + arrow, yLine, -arrow / 2),
          new THREE.Vector3(-halfW * 0.7, yLine, 0),
          new THREE.Vector3(-halfW * 0.7 + arrow, yLine, arrow / 2),
        ]),
      );
      out.push(
        lineFromPts([
          new THREE.Vector3(0, yLine, 0),
          new THREE.Vector3(halfW * 0.7, yLine, 0),
          new THREE.Vector3(halfW * 0.7 - arrow, yLine, -arrow / 2),
          new THREE.Vector3(halfW * 0.7, yLine, 0),
          new THREE.Vector3(halfW * 0.7 - arrow, yLine, arrow / 2),
        ]),
      );
      break;
    }
  }

  return out;
}

export function doorGroupThree(
  door: Extract<Element, { kind: 'door' }>,
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  openingFocus?: boolean,
  detailLevel: PlanDetailLevel = 'medium',
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
      color: (() => {
        const p = getPlanPalette();
        // Use draft-paper (white) for the door opening so it reads as a white
        // gap in the black wall — standard architectural plan convention.
        return door.id === selectedId ? p.doorSelected : readToken('--draft-paper', '#fdfcf9');
      })(),
    }),
  );

  opening.position.set(px, PLAN_Y + 0.025, pz);

  opening.rotation.y = Math.atan2(seg.nz, seg.nx);

  opening.userData.bimPickId = door.id;

  g.add(opening);

  // VIE-V3-01: coarse = opening box only; medium/fine = full symbol (swing arc etc.)
  if (detailLevel !== 'coarse') {
    const symbolGroup = new THREE.Group();
    symbolGroup.position.set(px, 0, pz);
    symbolGroup.rotation.y = Math.atan2(seg.nz, seg.nx);
    for (const primitive of planDoorSymbolPrimitives(door, width, openingFocus)) {
      symbolGroup.add(primitive);
    }
    g.add(symbolGroup);
  }

  g.userData.bimPickId = door.id;

  return g;
}

export function planWindowMesh(
  win: Extract<Element, { kind: 'window' }>,
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  openingFocus?: boolean,
  detailLevel: PlanDetailLevel = 'medium',
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

      color: (() => {
        const p = getPlanPalette();
        if (win.id === selectedId) {
          return openingFocus ? p.windowSelected : p.windowSelectedBackline;
        }
        // Use draft-paper (white) for the wall-cut fill so windows read as
        // white openings in the black wall; the --cat-window glass centerline
        // is drawn on top in the sill line below.
        return readToken('--draft-paper', '#fdfcf9');
      })(),
    }),
  );

  mesh.position.set(0, sill + h / 2, 0);

  mesh.userData.bimPickId = win.id;

  grp.add(mesh);

  // VIE-V3-01: coarse = box only; medium/fine = add sill (glass) line.
  if (detailLevel !== 'coarse') {
    const sillPts = [
      new THREE.Vector3(-width / 2, sill + 0.004, depth * 0.51),

      new THREE.Vector3(width / 2, sill + 0.004, depth * 0.51),
    ];

    const sillGeom = new THREE.BufferGeometry().setFromPoints(sillPts);

    const sillLn = new THREE.Line(
      sillGeom,

      new THREE.LineBasicMaterial({
        color: (() => {
          const p = getPlanPalette();
          return openingFocus ? p.windowGlassFocus : p.windowGlass;
        })(),

        linewidth: PLAN_WINDOW_SILL_LINE_WIDTH,
      }),
    );

    sillLn.renderOrder = 2;

    grp.add(sillLn);
  }

  grp.userData.bimPickId = win.id;

  return grp;
}

/**
 * KRN-04 plan symbol: rectangular outline spanning the opening's wall-length
 * interval, drawn in the wall thickness (matches Revit's wall-opening symbol).
 * No frame, no swing, no glazing line — just the cut outline.
 */
export function planWallOpeningMesh(
  op: Extract<Element, { kind: 'wall_opening' }>,
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
): THREE.Group {
  const grp = new THREE.Group();

  const sx = ux(wall.start.xMm);
  const sz = uz(wall.start.yMm);
  const seg = segmentDir(wall);

  const tStart = THREE.MathUtils.clamp(Math.min(op.alongTStart, op.alongTEnd), 0, 1);
  const tEnd = THREE.MathUtils.clamp(Math.max(op.alongTStart, op.alongTEnd), 0, 1);
  const tMid = (tStart + tEnd) / 2;

  const px = sx + seg.nx * seg.lenM * tMid;
  const pz = sz + seg.nz * seg.lenM * tMid;

  const yaw = Math.atan2(seg.nz, seg.nx);
  grp.position.set(px, 0, pz);
  grp.rotation.y = yaw;

  const widthM = Math.max(0.05, (tEnd - tStart) * seg.lenM);
  const depthM = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.01, 0.05, 1);

  const palette = getPlanPalette();
  const isSelected = op.id === selectedId;
  const outlineColor = isSelected ? palette.doorSelected : palette.doorSwing;

  const half = depthM / 2;
  const w2 = widthM / 2;
  const corners = [
    new THREE.Vector3(-w2, PLAN_Y + 0.025, -half),
    new THREE.Vector3(w2, PLAN_Y + 0.025, -half),
    new THREE.Vector3(w2, PLAN_Y + 0.025, half),
    new THREE.Vector3(-w2, PLAN_Y + 0.025, half),
    new THREE.Vector3(-w2, PLAN_Y + 0.025, -half),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(corners),
    new THREE.LineBasicMaterial({ color: outlineColor, linewidth: 1 }),
  );
  outline.userData.bimPickId = op.id;
  outline.renderOrder = 2;
  grp.add(outline);

  // Diagonal slash inside the rectangle distinguishes wall_opening from door/window.
  const slashPts = [
    new THREE.Vector3(-w2, PLAN_Y + 0.025, -half),
    new THREE.Vector3(w2, PLAN_Y + 0.025, half),
  ];
  const slash = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(slashPts),
    new THREE.LineBasicMaterial({ color: outlineColor, linewidth: 1 }),
  );
  slash.userData.bimPickId = op.id;
  slash.renderOrder = 2;
  grp.add(slash);

  grp.userData.bimPickId = op.id;
  return grp;
}

/** Match kernel `stair_riser_count_plan_proxy` (rise / riser when levels resolve). */
export function computeStairPlanRiserCount(
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

/** Footprint tread preview on the stair base level (OG plan hides it). */

export function stairPlanThree(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById?: Record<string, Element>,
  wireDoc?: StairPlanWireDocOverlays | null,
  detailLevel: PlanDetailLevel = 'medium',
): THREE.Group | null {
  if (stair.shape === 'spiral') {
    return spiralStairPlanGroup(stair);
  }
  if (stair.shape === 'sketch') {
    return sketchStairPlanGroup(stair);
  }
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
      new THREE.LineBasicMaterial({
        // Stair outline uses the cut line color (near-black), not warning yellow.
        color: readToken('--draft-cut', '#1d2330'),
        transparent: true,
        opacity: 0.92,
      }),
    ),
  );

  // VIE-V3-01: coarse = outline only; medium/fine = individual tread lines.
  if (detailLevel !== 'coarse') {
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
          new THREE.LineBasicMaterial({
            // Tread risers use the stair cut token (near-black), not hairline grey.
            color: readToken('--plan-stair', '#2a2825'),
            transparent: true,
            opacity: 0.55,
          }),
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
            new THREE.LineBasicMaterial({
              // Tread nosing lines use the stair cut token, slightly dimmer than risers.
              color: readToken('--plan-stair', '#2a2825'),
              transparent: true,
              opacity: 0.38,
            }),
          ),
        );
      }
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
      color: getPlanPalette().dimLine,
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

    const ph = wireDoc.stairDocumentationPlaceholders_v0;
    if (ph?.bottomLandingFootprintBoundsMm && ph?.topLandingFootprintBoundsMm) {
      const yLand = PLAN_Y + 0.021;
      const landMat = new THREE.LineBasicMaterial({
        color: getPlanPalette().windowFillBackline,
        transparent: true,
        opacity: 0.52,
      });
      for (const b of [ph.bottomLandingFootprintBoundsMm, ph.topLandingFootprintBoundsMm]) {
        const x0 = b.minXmMm / 1000;
        const x1 = b.maxXmMm / 1000;
        const z0 = b.minYmMm / 1000;
        const z1 = b.maxYmMm / 1000;
        const ring = [
          new THREE.Vector3(x0, yLand, z0),
          new THREE.Vector3(x1, yLand, z0),
          new THREE.Vector3(x1, yLand, z1),
          new THREE.Vector3(x0, yLand, z1),
          new THREE.Vector3(x0, yLand, z0),
        ];
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), landMat));
      }
    }

    const ann =
      wireDoc.stairPlanSectionDocumentationLabel?.trim() || wireDoc.planUpDownLabel?.trim();
    if (ann) {
      const lx = sx + uxDir * Math.min(len * 0.2, 0.35);
      const lz = sz + uzDir * Math.min(len * 0.2, 0.35);
      const tagScale = wireDoc.stairPlanSectionDocumentationLabel ? 0.62 : 0.85;
      g.add(planAnnotationLabelSprite(lx, lz, ann, stair.id, tagScale));
    }

    if (wireDoc.stairPlanBreakVisibilityToken === 'cutSplitsSpan') {
      const zx = mx - bz * (stair.widthMm / 2000) * 0.35;
      const zz = mz + bx * (stair.widthMm / 2000) * 0.35;
      const zig = 0.04;
      const p0 = new THREE.Vector3(zx - bx * zig, PLAN_Y + 0.026, zz - bz * zig);
      const p1 = new THREE.Vector3(zx + bx * zig, PLAN_Y + 0.026, zz + bz * zig);
      const p2 = new THREE.Vector3(zx + bx * zig * 2, PLAN_Y + 0.026, zz + bz * zig * 2);
      const brkMat = new THREE.LineBasicMaterial({
        color: getPlanPalette().dimWitness,
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

export function roomMesh(
  room: Extract<Element, { kind: 'room' }>,
  presentation?: PlanPresentationPreset,
  opts?: {
    schemeColorHex?: string;
    roomFillOpacityScale?: number;
    roomFillOverrideHex?: string;
    roomFillPatternOverride?: RoomFillPatternOverride;
  },
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
        ? { opacity: 0.045, color: getPlanPalette().regionFillStrong }
        : {
            opacity: 0.26,

            color: getPlanPalette().regionFill,
          };

  const scale = opts?.roomFillOpacityScale ?? 1;
  const instanceOverride =
    typeof opts?.roomFillOverrideHex === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(opts.roomFillOverrideHex)
      ? opts.roomFillOverrideHex
      : typeof room.roomFillOverrideHex === 'string' &&
          /^#[0-9a-fA-F]{6}$/.test(room.roomFillOverrideHex)
        ? room.roomFillOverrideHex
        : undefined;
  const fillColor = instanceOverride ?? fill.color;
  const patternOverride =
    opts?.roomFillPatternOverride ??
    normalizeRoomFillPatternOverride(room.roomFillPatternOverride ?? undefined);

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color: fillColor,

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

  if (patternOverride && patternOverride !== 'solid') {
    const pattern = buildRoomFillPatternLines(room.outlineMm, patternOverride, fillColor);
    if (pattern) mesh.add(pattern);
  }

  return mesh;
}

function normalizeRoomFillPatternOverride(raw: unknown): RoomFillPatternOverride | undefined {
  return typeof raw === 'string' && ROOM_FILL_PATTERN_VALUES.has(raw)
    ? (raw as RoomFillPatternOverride)
    : undefined;
}

function buildRoomFillPatternLines(
  outlineMm: Array<{ xMm: number; yMm: number }>,
  pattern: RoomFillPatternOverride,
  fillColor: string,
): THREE.LineSegments | null {
  const positions =
    pattern === 'dots'
      ? dotPatternSegments(outlineMm)
      : [
          ...parallelPatternSegments(
            outlineMm,
            pattern === 'hatch_90' ? 1 : 1 / Math.SQRT2,
            pattern === 'hatch_90' ? 0 : -1 / Math.SQRT2,
          ),
          ...(pattern === 'crosshatch'
            ? parallelPatternSegments(outlineMm, 1 / Math.SQRT2, 1 / Math.SQRT2)
            : []),
        ];
  if (positions.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(darkenHex(fillColor, 0.45)),
    transparent: true,
    opacity: 0.72,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 7;
  lines.userData.roomFillPatternOverride = pattern;
  return lines;
}

function parallelPatternSegments(
  pts: Array<{ xMm: number; yMm: number }>,
  nx: number,
  ny: number,
): number[] {
  if (pts.length < 3) return [];
  const spacingMm = 450;
  const zLocal = 0.002;
  let minC = Infinity;
  let maxC = -Infinity;
  for (const p of pts) {
    const c = p.xMm * nx + p.yMm * ny;
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }

  const positions: number[] = [];
  const dx = -ny;
  const dy = nx;
  const first = Math.floor(minC / spacingMm) * spacingMm;
  for (let c = first; c <= maxC + spacingMm; c += spacingMm) {
    const xs: Array<{ xMm: number; yMm: number; t: number }> = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i]!;
      const p2 = pts[(i + 1) % pts.length]!;
      const d = (p2.xMm - p1.xMm) * nx + (p2.yMm - p1.yMm) * ny;
      if (Math.abs(d) < 1e-9) continue;
      const u = (c - (p1.xMm * nx + p1.yMm * ny)) / d;
      if (u < -1e-9 || u >= 1 - 1e-9) continue;
      const xMm = p1.xMm + (p2.xMm - p1.xMm) * u;
      const yMm = p1.yMm + (p2.yMm - p1.yMm) * u;
      xs.push({ xMm, yMm, t: xMm * dx + yMm * dy });
    }
    xs.sort((a, b) => a.t - b.t);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const a = xs[j]!;
      const b = xs[j + 1]!;
      positions.push(ux(a.xMm), -uz(a.yMm), zLocal, ux(b.xMm), -uz(b.yMm), zLocal);
    }
  }
  return positions;
}

function dotPatternSegments(pts: Array<{ xMm: number; yMm: number }>): number[] {
  if (pts.length < 3) return [];
  const xs = pts.map((p) => p.xMm);
  const ys = pts.map((p) => p.yMm);
  const spacingMm = 450;
  const dotHalfMm = 36;
  const zLocal = 0.002;
  const positions: number[] = [];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let x = Math.ceil(minX / spacingMm) * spacingMm; x <= maxX; x += spacingMm) {
    for (let y = Math.ceil(minY / spacingMm) * spacingMm; y <= maxY; y += spacingMm) {
      if (!pointInPolygonMm(x, y, pts)) continue;
      positions.push(
        ux(x - dotHalfMm),
        -uz(y),
        zLocal,
        ux(x + dotHalfMm),
        -uz(y),
        zLocal,
        ux(x),
        -uz(y - dotHalfMm),
        zLocal,
        ux(x),
        -uz(y + dotHalfMm),
        zLocal,
      );
    }
  }
  return positions;
}

function pointInPolygonMm(
  xMm: number,
  yMm: number,
  pts: Array<{ xMm: number; yMm: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const crosses =
      pi.yMm > yMm !== pj.yMm > yMm &&
      xMm < ((pj.xMm - pi.xMm) * (yMm - pi.yMm)) / (pj.yMm - pi.yMm) + pi.xMm;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function planAnnotationLabelSprite(
  cxM: number,
  czM: number,
  text: string,
  pickId?: string,
  fontScale = 1,
): THREE.Sprite {
  const scaleMul = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const trimmed = text.trim().slice(0, 160);
  const safe = trimmed.length ? trimmed : '—';

  const doc = typeof globalThis.document !== 'undefined' ? globalThis.document : null;
  const emptySprite = (): THREE.Sprite => {
    const mat = new THREE.SpriteMaterial({
      color: getPlanPalette().tagBg,
      transparent: true,
      opacity: 0.92,
    });
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
  const baselineSize = Math.max(Math.floor(fontPx * 1.125), 32);
  const lines = planAnnotationLabelLines(safe);
  const lineHeight = Math.max(Math.floor(fontPx * 1.18), Math.floor(fontPx * 0.95));

  const canvas = doc.createElement('canvas');
  canvas.width = baselineSize;
  canvas.height = Math.max(Math.floor(fontPx * 1.5625), 36);
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return emptySprite();

  ctx.font = `500 ${fontPx}px Inter,system-ui,sans-serif`;
  const pad = Math.max(12, Math.floor(fontPx / 16));
  const measuredTextWidth = Math.max(...lines.map((line) => ctx!.measureText(line).width), fontPx);
  canvas.width = Math.max(baselineSize, Math.ceil(measuredTextWidth + pad * 3));
  canvas.height = Math.max(
    Math.floor(fontPx * 1.5625),
    Math.ceil(lines.length * lineHeight + pad * 2),
  );
  ctx = canvas.getContext('2d');
  if (!ctx) return emptySprite();

  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.fillStyle = getPlanPalette().tagBg;
  ctx.lineWidth = 4;
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
  ctx.font = `500 ${fontPx}px Inter,system-ui,sans-serif`;
  // tagText color for high-contrast room/tag labels on the dark pill.
  ctx.fillStyle = getPlanPalette().tagText;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const totalTextHeight = lines.length * lineHeight;
  let baselineY = (canvas.height - totalTextHeight) / 2 + lineHeight * 0.8;
  for (const line of lines) {
    try {
      ctx.lineWidth = 3;
      ctx.strokeText(line, canvas.width / 2, baselineY);
    } catch {
      /* strokeText unsupported in some canvas implementations */
    }
    ctx.fillText(line, canvas.width / 2, baselineY);
    baselineY += lineHeight;
  }

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
  sprite.scale.set(
    0.22 * (canvas.width / baselineSize) * scaleMul,
    0.22 * (canvas.height / baselineSize) * scaleMul,
    1,
  );
  sprite.renderOrder = 10;
  sprite.userData.planAnnotationOverlay = true;
  if (pickId) sprite.userData.bimPickId = pickId;
  return sprite;
}

export function planAnnotationLabelLines(
  rawText: string,
  maxCharsPerLine = 28,
  maxLines = 3,
): string[] {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!text) return ['—'];
  if (text.length <= maxCharsPerLine) return [text];

  const lines: string[] = [];
  let current = '';
  const tokens = text.split(' ');

  const pushToken = (token: string): void => {
    if (token.length <= maxCharsPerLine) {
      lines.push(token);
      return;
    }
    let rest = token;
    while (rest.length > maxCharsPerLine) {
      lines.push(rest.slice(0, maxCharsPerLine));
      rest = rest.slice(maxCharsPerLine);
    }
    if (rest) lines.push(rest);
  };

  for (const token of tokens) {
    if (!token) continue;
    if (!current) {
      current = token;
      continue;
    }
    const candidate = `${current} ${token}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    pushToken(current);
    current = token;
  }
  if (current) pushToken(current);

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const tailLimit = Math.max(3, maxCharsPerLine - 3);
  const tail = clipped[maxLines - 1]!;
  clipped[maxLines - 1] = `${tail.slice(0, tailLimit).trimEnd()}...`;
  return clipped;
}

export function gridLineThree(g: Extract<Element, { kind: 'grid_line' }>): THREE.Group {
  const grp = new THREE.Group();

  const pts = [
    new THREE.Vector3(ux(g.start.xMm), PLAN_Y, uz(g.start.yMm)),

    new THREE.Vector3(ux(g.end.xMm), PLAN_Y, uz(g.end.yMm)),
  ];

  grp.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),

      new THREE.LineBasicMaterial({ color: getPlanPalette().dimWitness, linewidth: 2 }),
    ),
  );

  grp.userData.bimPickId = g.id;

  grp.userData.gridLabel = g.label;

  return grp;
}

export function dimensionsThree(d: Extract<Element, { kind: 'dimension' }>): THREE.Group {
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

    new THREE.LineBasicMaterial({
      color:
        d.state === 'unlinked'
          ? readToken('--color-drift', '#9b6f1b')
          : d.state === 'partial'
            ? readToken('--color-muted-foreground', '#6b7280')
            : getPlanPalette().dimLine,
    }),
  );

  ls.userData.dimensionSpanMm = dimSpanMm;
  ls.userData.bimPickId = d.id;

  // F-088 — text label sprite at midpoint of the dimension line, shifted by
  // textOffsetMm when set.
  const midXMm = (d.aMm.xMm + d.bMm.xMm) / 2 + d.offsetMm.xMm;
  const midYMm = (d.aMm.yMm + d.bMm.yMm) / 2 + d.offsetMm.yMm;
  const textXMm = midXMm + (d.textOffsetMm?.xMm ?? 0);
  const textYMm = midYMm + (d.textOffsetMm?.yMm ?? 0);

  const labelText =
    dimSpanMm >= 1000 ? `${(dimSpanMm / 1000).toFixed(2)} m` : `${Math.round(dimSpanMm)} mm`;

  const sprite = planAnnotationLabelSprite(ux(textXMm), uz(textYMm), labelText, d.id);
  sprite.userData.dimensionTextLabel = true;

  const grp = new THREE.Group();
  grp.userData.bimPickId = d.id;
  grp.add(ls, sprite);

  return grp;
}

const REFERENCE_PLANE_PLAN_COLOR = 0x9ca3af;
const REFERENCE_PLANE_PLAN_DASH = 0.18;
const REFERENCE_PLANE_PLAN_GAP = 0.12;
const PROPERTY_LINE_PLAN_COLOR = 0x2a3f5a;
const PROPERTY_LINE_SETBACK_DASH = 0.14;
const PROPERTY_LINE_SETBACK_GAP = 0.1;

/**
 * KRN-05: project-scope reference plane in plan view — thin dashed grey line
 * with a small label sprite at the start endpoint.
 */
export function referencePlanePlanThree(
  rp: Extract<Element, { kind: 'reference_plane' }> & {
    levelId?: string;
    startMm?: { xMm: number; yMm: number };
    endMm?: { xMm: number; yMm: number };
    isWorkPlane?: boolean;
  },
  fallbackLabel?: string,
): THREE.Group {
  const grp = new THREE.Group();
  const start = rp.startMm;
  const end = rp.endMm;
  if (!start || !end) return grp;

  const a = new THREE.Vector3(ux(start.xMm), PLAN_Y + 0.0015, uz(start.yMm));
  const b = new THREE.Vector3(ux(end.xMm), PLAN_Y + 0.0015, uz(end.yMm));
  const mat = new THREE.LineDashedMaterial({
    color: rp.isWorkPlane ? 0x10b981 : REFERENCE_PLANE_PLAN_COLOR,
    dashSize: REFERENCE_PLANE_PLAN_DASH,
    gapSize: REFERENCE_PLANE_PLAN_GAP,
    depthTest: true,
  });
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat);
  ln.computeLineDistances();
  ln.userData.bimPickId = rp.id;
  ln.userData.referencePlaneId = rp.id;
  grp.add(ln);

  // Tiny label sprite at the start end (the "name" or fallback like "RP-1").
  const labelText = (rp.name && rp.name.trim()) || fallbackLabel || 'RP';
  const sprite = makeReferencePlaneLabelSprite(labelText, a.x, a.z, rp.id);
  if (sprite) grp.add(sprite);

  grp.userData.bimPickId = rp.id;
  grp.userData.referencePlaneLabel = labelText;
  return grp;
}

function makeReferencePlaneLabelSprite(
  text: string,
  cxM: number,
  czM: number,
  pickId: string,
): THREE.Sprite | null {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc || typeof doc.createElement !== 'function') return null;
  const viteMode =
    typeof process !== 'undefined' &&
    (process as { env?: Record<string, string> }).env?.NODE_ENV === 'test'
      ? 'test'
      : '';
  const canvas = doc.createElement('canvas');
  canvas.width = 96;
  canvas.height = 32;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx || viteMode === 'test') {
    const tex = new THREE.CanvasTexture(canvas);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(m);
    s.position.set(cxM, PLAN_Y + 0.004, czM);
    s.scale.set(0.18, 0.06, 1);
    s.userData.bimPickId = pickId;
    s.userData.referencePlaneLabelSprite = true;
    return s;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '500 18px Inter,system-ui,sans-serif';
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(cxM, PLAN_Y + 0.004, czM);
  sprite.scale.set(0.22, 0.075, 1);
  sprite.renderOrder = 12;
  sprite.userData.bimPickId = pickId;
  sprite.userData.referencePlaneLabelSprite = true;
  return sprite;
}

/**
 * KRN-01: property line in plan view — solid thick dark-slate line, plus an
 * optional parallel dashed setback line offset toward the property interior.
 *
 * Setback offset direction: by convention the +90° rotation of the line's
 * direction vector points to the "interior" side. Callers that need the
 * other side can negate `setbackMm`.
 */
export function propertyLinePlanThree(
  pl: Extract<Element, { kind: 'property_line' }>,
): THREE.Group {
  const grp = new THREE.Group();
  const ax = ux(pl.startMm.xMm);
  const az = uz(pl.startMm.yMm);
  const bx = ux(pl.endMm.xMm);
  const bz = uz(pl.endMm.yMm);
  const a = new THREE.Vector3(ax, PLAN_Y + 0.002, az);
  const b = new THREE.Vector3(bx, PLAN_Y + 0.002, bz);

  // Solid main line — thicker than walls (linewidth has no effect in WebGL but
  // the color/depth still matter for visual weight; renderOrder lifts it).
  const mainMat = new THREE.LineBasicMaterial({
    color: PROPERTY_LINE_PLAN_COLOR,
    depthTest: true,
  });
  const mainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mainMat);
  mainLine.userData.bimPickId = pl.id;
  mainLine.renderOrder = 6;
  grp.add(mainLine);

  // Setback parallel offset (dashed) when authored.
  if (typeof pl.setbackMm === 'number' && pl.setbackMm > 0) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const offsetM = pl.setbackMm / 1000;
    // +90° rotation of (dx,dz) → interior side per spec convention.
    const nx = -dz / len;
    const nz = dx / len;
    const oa = new THREE.Vector3(ax + nx * offsetM, PLAN_Y + 0.002, az + nz * offsetM);
    const ob = new THREE.Vector3(bx + nx * offsetM, PLAN_Y + 0.002, bz + nz * offsetM);
    const setMat = new THREE.LineDashedMaterial({
      color: PROPERTY_LINE_PLAN_COLOR,
      dashSize: PROPERTY_LINE_SETBACK_DASH,
      gapSize: PROPERTY_LINE_SETBACK_GAP,
      depthTest: true,
      opacity: 0.85,
      transparent: true,
    });
    const setLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([oa, ob]), setMat);
    setLine.computeLineDistances();
    setLine.userData.bimPickId = pl.id;
    setLine.userData.propertyLineSetback = true;
    grp.add(setLine);
  }

  grp.userData.bimPickId = pl.id;
  if (pl.classification) grp.userData.propertyLineClassification = pl.classification;
  return grp;
}

// ---------------------------------------------------------------------------
// Wall section-cut polygon helpers (MRK-V3-03)
// ---------------------------------------------------------------------------

function nearEq(a: number, b: number, eps = 1.5): boolean {
  return Math.abs(a - b) <= eps;
}

function wallJoinDisallowedAtVertex(
  wall: Extract<Element, { kind: 'wall' }>,
  vx: number,
  vy: number,
): boolean {
  if (nearEq(wall.start.xMm, vx) && nearEq(wall.start.yMm, vy)) {
    return wall.joinDisallowStart ?? false;
  }
  if (nearEq(wall.end.xMm, vx) && nearEq(wall.end.yMm, vy)) {
    return wall.joinDisallowEnd ?? false;
  }
  return false;
}

function lineIntersect2D(
  p1: { x: number; y: number },
  d1: { x: number; y: number },
  p2: { x: number; y: number },
  d2: { x: number; y: number },
): { x: number; y: number } | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-6) return null; // parallel
  const dx = p2.x - p1.x,
    dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / cross;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

export function computeWallSectionPolygon(
  wall: Extract<Element, { kind: 'wall' }>,
  joinsForWall: WallJoinRecord[],
  wallsById: Record<string, Element>,
): Array<{ xMm: number; yMm: number }> {
  const sx = wall.start.xMm,
    sy = wall.start.yMm;
  const ex = wall.end.xMm,
    ey = wall.end.yMm;
  const dx = ex - sx,
    dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const ux = dx / len,
    uy = dy / len; // unit along wall
  const px = -uy,
    py = ux; // left perpendicular
  const half = wall.thicknessMm / 2;

  let startOffset = 0;
  let endOffset = len;
  let startLeftPerp = 0,
    startRightPerp = 0;
  let endLeftPerp = 0,
    endRightPerp = 0;

  for (const join of joinsForWall) {
    if (join.joinKind !== 'butt' && join.joinKind !== 'miter_candidate') continue;
    if (join.skipReason) continue;

    const vx = join.vertexMm.xMm,
      vy = join.vertexMm.yMm;
    const atStart = nearEq(sx, vx) && nearEq(sy, vy);
    const atEnd = nearEq(ex, vx) && nearEq(ey, vy);
    if (!atStart && !atEnd) continue;

    const otherId = join.wallIds.find((id) => id !== wall.id);
    if (!otherId) continue;
    const other = wallsById[otherId];
    if (!other || other.kind !== 'wall') continue;
    if (wallJoinDisallowedAtVertex(wall, vx, vy) || wallJoinDisallowedAtVertex(other, vx, vy)) {
      continue;
    }

    if (join.joinKind === 'butt') {
      const otherAtStart = nearEq(other.start.xMm, vx) && nearEq(other.start.yMm, vy);
      const otherAtEnd = nearEq(other.end.xMm, vx) && nearEq(other.end.yMm, vy);
      const otherHasEndpoint = otherAtStart || otherAtEnd;

      if (!otherHasEndpoint) {
        // This wall is the BUTT wall; clip by half of other's thickness.
        const clip = other.thicknessMm / 2;
        if (atEnd) {
          endOffset = len - clip;
        } else {
          startOffset = clip;
        }
      }
    }

    if (join.joinKind === 'miter_candidate') {
      const odx = other.end.xMm - other.start.xMm;
      const ody = other.end.yMm - other.start.yMm;
      const olen = Math.sqrt(odx * odx + ody * ody);
      if (olen < 1) continue;
      const oUx = odx / olen,
        oUy = ody / olen;
      const oPx = -oUy,
        oPy = oUx;
      const oHalf = other.thicknessMm / 2;

      const sign = atEnd ? -1 : 1;
      const oSign = nearEq(other.end.xMm, vx) && nearEq(other.end.yMm, vy) ? -1 : 1;

      const miterLeft = lineIntersect2D(
        { x: vx + px * half, y: vy + py * half },
        { x: sign * ux, y: sign * uy },
        { x: vx - oPx * oHalf, y: vy - oPy * oHalf },
        { x: oSign * oUx, y: oSign * oUy },
      );
      const miterRight = lineIntersect2D(
        { x: vx - px * half, y: vy - py * half },
        { x: sign * ux, y: sign * uy },
        { x: vx + oPx * oHalf, y: vy + oPy * oHalf },
        { x: oSign * oUx, y: oSign * oUy },
      );

      if (!miterLeft || !miterRight) continue;

      const axEndX = atEnd ? ex : sx;
      const axEndY = atEnd ? ey : sy;

      const leftAxisOffset = (miterLeft.x - axEndX) * ux + (miterLeft.y - axEndY) * uy;
      const rightAxisOffset = (miterRight.x - axEndX) * ux + (miterRight.y - axEndY) * uy;

      if (atEnd) {
        endLeftPerp = (miterLeft.x - ex) * px + (miterLeft.y - ey) * py;
        endRightPerp = -((miterRight.x - ex) * px + (miterRight.y - ey) * py);
        endOffset = len + (leftAxisOffset + rightAxisOffset) / 2;
      } else {
        startLeftPerp = (miterLeft.x - sx) * px + (miterLeft.y - sy) * py;
        startRightPerp = -((miterRight.x - sx) * px + (miterRight.y - sy) * py);
        startOffset = (leftAxisOffset + rightAxisOffset) / 2;
      }
    }
  }

  const startPtX = sx + ux * startOffset;
  const startPtY = sy + uy * startOffset;
  const endPtX = sx + ux * endOffset;
  const endPtY = sy + uy * endOffset;

  return [
    { xMm: startPtX + px * (half + startLeftPerp), yMm: startPtY + py * (half + startLeftPerp) },
    { xMm: endPtX + px * (half + endLeftPerp), yMm: endPtY + py * (half + endLeftPerp) },
    { xMm: endPtX - px * (half + endRightPerp), yMm: endPtY - py * (half + endRightPerp) },
    {
      xMm: startPtX - px * (half + startRightPerp),
      yMm: startPtY - py * (half + startRightPerp),
    },
  ];
}

export function planWallSectionMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  outlineMm: Array<{ xMm: number; yMm: number }>,
  selectedId?: string,
): THREE.Group {
  const p = getPlanPalette();
  const fillColor = wall.id === selectedId ? p.wallSelected : p.wallFill;
  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;

  if (outlineMm.length < 3) return group;

  // --- Fill polygon ---
  const shape = new THREE.Shape();
  shape.moveTo(ux(outlineMm[0]!.xMm), -uz(outlineMm[0]!.yMm));
  for (let i = 1; i < outlineMm.length; i++) {
    shape.lineTo(ux(outlineMm[i]!.xMm), -uz(outlineMm[i]!.yMm));
  }
  shape.closePath();
  const fillGeo = new THREE.ShapeGeometry(shape);
  const fillMesh = new THREE.Mesh(
    fillGeo,
    new THREE.MeshBasicMaterial({ color: fillColor, depthWrite: false }),
  );
  fillMesh.rotation.x = -Math.PI / 2;
  fillMesh.position.y = PLAN_Y;
  fillMesh.userData.bimPickId = wall.id;
  group.add(fillMesh);

  // --- Outline ---
  const pts = outlineMm.map((pt) => new THREE.Vector3(ux(pt.xMm), PLAN_Y + 0.001, uz(pt.yMm)));
  pts.push(pts[0]!.clone());
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const outlineMat = new THREE.LineBasicMaterial({
    color: readToken('--draft-cut', '#1d2330'),
    linewidth: 1,
    depthTest: false,
  });
  const outlineLine = new THREE.Line(outlineGeo, outlineMat);
  outlineLine.renderOrder = 3;
  group.add(outlineLine);

  // --- Hatch (45° diagonal lines via proper polygon edge intersection) ---
  const hatchColor = readToken('--draft-paper', '#fdfcf9');
  const thick = wall.thicknessMm;
  const spacing = Math.max(20, thick / 3); // mm
  const n = outlineMm.length;
  let minC = Infinity,
    maxC = -Infinity;
  for (const pt of outlineMm) {
    const c = pt.xMm - pt.yMm;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const hatchPositions: number[] = [];
  for (let c = minC; c <= maxC; c += spacing) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = outlineMm[i]!;
      const p2 = outlineMm[(i + 1) % n]!;
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
      hatchPositions.push(
        ux(x0),
        PLAN_Y + 0.003,
        uz(x0 - c),
        ux(x1),
        PLAN_Y + 0.003,
        uz(x1 - c),
      );
    }
  }
  if (hatchPositions.length > 0) {
    const hatchGeo = new THREE.BufferGeometry();
    hatchGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(hatchPositions), 3),
    );
    const hatchMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(hatchColor),
      transparent: true,
      opacity: 0.35,
      depthTest: false,
    });
    const hatchLines = new THREE.LineSegments(hatchGeo, hatchMat);
    hatchLines.renderOrder = 5;
    group.add(hatchLines);
  }

  return group;
}
