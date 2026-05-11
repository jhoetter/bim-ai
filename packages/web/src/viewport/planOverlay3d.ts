import * as THREE from 'three';
import type { Element, XY } from '@bim-ai/core';

export type PlanOverlay3dOptions = {
  sheetColor: string;
  lineColor: string;
  roomColor: string;
  openingColor: string;
  assetColor: string;
  stairColor: string;
  witnessColor: string;
};

type PlanView = Extract<Element, { kind: 'plan_view' }>;
type Viewpoint = Extract<Element, { kind: 'viewpoint' }>;
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const DEFAULT_OFFSET_MM = 3500;
const DEFAULT_SHEET_OPACITY = 0.46;
const DEFAULT_LINE_OPACITY = 0.96;
const DEFAULT_FILL_OPACITY = 0.14;
const OVERLAY_RENDER_ORDER = 1200;
const PLAN_STROKE_WIDTH_M = 0.055;
const PLAN_BORDER_WIDTH_M = 0.09;
const PLAN_BORDER_HALO_WIDTH_M = 0.18;
const SHEET_BACKDROP_PAD_MM = 180;

function clamp01(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function clampVisibleOpacity(v: unknown, fallback: number, min: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(1, Math.max(0, n));
  return clamped <= 0 ? 0 : Math.max(clamped, min);
}

function numericOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pointInBounds(p: XY, b: Bounds | null): boolean {
  if (!b) return true;
  return p.xMm >= b.minX && p.xMm <= b.maxX && p.yMm >= b.minY && p.yMm <= b.maxY;
}

function segmentTouchesBounds(a: XY, b: XY, bounds: Bounds | null): boolean {
  if (!bounds) return true;
  if (pointInBounds(a, bounds) || pointInBounds(b, bounds)) return true;
  const sx0 = Math.min(a.xMm, b.xMm);
  const sx1 = Math.max(a.xMm, b.xMm);
  const sy0 = Math.min(a.yMm, b.yMm);
  const sy1 = Math.max(a.yMm, b.yMm);
  return sx1 >= bounds.minX && sx0 <= bounds.maxX && sy1 >= bounds.minY && sy0 <= bounds.maxY;
}

function boundsFromPoints(points: XY[]): Bounds | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.xMm);
    minY = Math.min(minY, p.yMm);
    maxX = Math.max(maxX, p.xMm);
    maxY = Math.max(maxY, p.yMm);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return { minX, minY, maxX, maxY };
}

function planViewBounds(planView: PlanView, elements: Element[], levelId: string): Bounds | null {
  if (planView.cropMinMm && planView.cropMaxMm) {
    return {
      minX: Math.min(planView.cropMinMm.xMm, planView.cropMaxMm.xMm),
      minY: Math.min(planView.cropMinMm.yMm, planView.cropMaxMm.yMm),
      maxX: Math.max(planView.cropMinMm.xMm, planView.cropMaxMm.xMm),
      maxY: Math.max(planView.cropMinMm.yMm, planView.cropMaxMm.yMm),
    };
  }
  const pts: XY[] = [];
  for (const e of elements) {
    if ('levelId' in e && e.levelId === levelId) {
      if (e.kind === 'wall') pts.push(e.start, e.end);
      if (e.kind === 'floor') pts.push(...e.boundaryMm);
      if (e.kind === 'room') pts.push(...e.outlineMm);
      if (e.kind === 'placed_asset' || e.kind === 'family_instance') pts.push(e.positionMm);
    }
    if (e.kind === 'stair' && e.baseLevelId === levelId) {
      pts.push(e.runStartMm, e.runEndMm);
      if (e.boundaryMm) pts.push(...e.boundaryMm);
    }
  }
  let b = boundsFromPoints(pts);
  if (!b) {
    const fallbackPts: XY[] = [];
    for (const e of elements) {
      if (e.kind === 'wall') fallbackPts.push(e.start, e.end);
      if (e.kind === 'floor') fallbackPts.push(...e.boundaryMm);
      if (e.kind === 'room') fallbackPts.push(...e.outlineMm);
      if (e.kind === 'placed_asset' || e.kind === 'family_instance') fallbackPts.push(e.positionMm);
      if (e.kind === 'stair') {
        fallbackPts.push(e.runStartMm, e.runEndMm);
        if (e.boundaryMm) fallbackPts.push(...e.boundaryMm);
      }
    }
    b = boundsFromPoints(fallbackPts);
  }
  if (!b) return null;
  const pad = 900;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

function raiseOverlayObject(obj: THREE.Object3D): void {
  obj.renderOrder = OVERLAY_RENDER_ORDER;
  obj.traverse((child) => {
    child.renderOrder = OVERLAY_RENDER_ORDER;
  });
}

function addSegment(points: number[], a: XY, b: XY, yM: number): void {
  points.push(a.xMm / 1000, yM, a.yMm / 1000, b.xMm / 1000, yM, b.yMm / 1000);
}

function addPolyline(points: number[], pts: XY[], yM: number, closed: boolean): void {
  for (let i = 1; i < pts.length; i++) addSegment(points, pts[i - 1]!, pts[i]!, yM);
  if (closed && pts.length > 2) addSegment(points, pts[pts.length - 1]!, pts[0]!, yM);
}

function makeLineSegments(
  points: number[],
  color: string,
  opacity: number,
  widthM = PLAN_STROKE_WIDTH_M,
): THREE.Mesh | null {
  if (points.length < 6) return null;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i + 5 < points.length; i += 6) {
    const ax = points[i]!;
    const ay = points[i + 1]!;
    const az = points[i + 2]!;
    const bx = points[i + 3]!;
    const by = points[i + 4]!;
    const bz = points[i + 5]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.0001) continue;
    const px = (-dz / len) * (widthM / 2);
    const pz = (dx / len) * (widthM / 2);
    const base = positions.length / 3;
    positions.push(
      ax + px,
      ay,
      az + pz,
      ax - px,
      ay,
      az - pz,
      bx - px,
      by,
      bz - pz,
      bx + px,
      by,
      bz + pz,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  if (positions.length < 12) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.userData.planOverlayStroke = true;
  raiseOverlayObject(mesh);
  return mesh;
}

function makeDashedLineSegments(
  points: number[],
  color: string,
  opacity: number,
): THREE.LineSegments | null {
  if (points.length < 6) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineDashedMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      dashSize: 0.22,
      gapSize: 0.16,
    }),
  );
  lines.computeLineDistances();
  raiseOverlayObject(lines);
  return lines;
}

function makeShapeMesh(pts: XY[], yM: number, color: string, opacity: number): THREE.Mesh | null {
  if (pts.length < 3 || opacity <= 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0]!.xMm / 1000, -pts[0]!.yMm / 1000);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]!.xMm / 1000, -pts[i]!.yMm / 1000);
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yM - 0.002;
  raiseOverlayObject(mesh);
  return mesh;
}

function addRect(
  points: number[],
  center: XY,
  widthMm: number,
  depthMm: number,
  rotDeg: number,
  yM: number,
): void {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  const r = THREE.MathUtils.degToRad(rotDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const local = [
    { xMm: -hw, yMm: -hd },
    { xMm: hw, yMm: -hd },
    { xMm: hw, yMm: hd },
    { xMm: -hw, yMm: hd },
  ];
  const pts = local.map((p) => ({
    xMm: center.xMm + p.xMm * c - p.yMm * s,
    yMm: center.yMm + p.xMm * s + p.yMm * c,
  }));
  addPolyline(points, pts, yM, true);
}

function dimFromParams(
  params: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  return THREE.MathUtils.clamp(numericOr(params?.[key], fallback), 100, 20000);
}

function labelSprite(text: string, xMm: number, yMm: number, yM: number): THREE.Sprite | null {
  if (typeof document === 'undefined' || !text.trim()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillRect(0, 18, canvas.width, 60);
  ctx.fillStyle = 'rgba(20,24,31,0.9)';
  ctx.fillText(text.slice(0, 32), canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.position.set(xMm / 1000, yM + 0.025, yMm / 1000);
  sprite.scale.set(1.9, 0.48, 1);
  raiseOverlayObject(sprite);
  return sprite;
}

function centroid(pts: XY[]): XY {
  if (!pts.length) return { xMm: 0, yMm: 0 };
  const sum = pts.reduce((acc, p) => ({ xMm: acc.xMm + p.xMm, yMm: acc.yMm + p.yMm }), {
    xMm: 0,
    yMm: 0,
  });
  return { xMm: sum.xMm / pts.length, yMm: sum.yMm / pts.length };
}

function elementOnLevel(
  e: Element,
  levelId: string,
  elementsById: Record<string, Element>,
): boolean {
  if ('levelId' in e && e.levelId === levelId) return true;
  if (e.kind === 'stair') return e.baseLevelId === levelId;
  if (e.kind === 'door') {
    const wall = elementsById[e.wallId];
    return wall?.kind === 'wall' && wall.levelId === levelId;
  }
  if (e.kind === 'window') {
    const wall = elementsById[e.wallId];
    return wall?.kind === 'wall' && wall.levelId === levelId;
  }
  return false;
}

export function resolvePlanOverlaySource(
  elementsById: Record<string, Element>,
  viewpoint: Viewpoint | null,
): PlanView | null {
  const plans = Object.values(elementsById)
    .filter((e): e is PlanView => e.kind === 'plan_view')
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const requested = viewpoint?.planOverlaySourcePlanViewId;
  if (requested) {
    const el = elementsById[requested];
    if (el?.kind === 'plan_view') return el;
  }
  return plans[0] ?? null;
}

export function buildPlanOverlay3dGroup(
  elementsById: Record<string, Element>,
  viewpoint: Viewpoint,
  opts: PlanOverlay3dOptions,
): THREE.Group | null {
  if (!viewpoint.planOverlayEnabled) return null;
  const planView = resolvePlanOverlaySource(elementsById, viewpoint);
  if (!planView) return null;
  const level = elementsById[planView.levelId];
  if (!level || level.kind !== 'level') return null;

  const all = Object.values(elementsById);
  const bounds = planViewBounds(planView, all, planView.levelId);
  const yM =
    level.elevationMm / 1000 + numericOr(viewpoint.planOverlayOffsetMm, DEFAULT_OFFSET_MM) / 1000;
  const sourceYM = level.elevationMm / 1000;
  const sheetOpacity = clampVisibleOpacity(
    viewpoint.planOverlayOpacity,
    DEFAULT_SHEET_OPACITY,
    0.38,
  );
  const lineOpacity = clampVisibleOpacity(
    viewpoint.planOverlayLineOpacity,
    DEFAULT_LINE_OPACITY,
    0.9,
  );
  const fillOpacity = clamp01(viewpoint.planOverlayFillOpacity, DEFAULT_FILL_OPACITY);
  const annotationsVisible = viewpoint.planOverlayAnnotationsVisible !== false;
  const witnessVisible = viewpoint.planOverlayWitnessLinesVisible !== false;
  const hidden = new Set(planView.categoriesHidden ?? []);
  const group = new THREE.Group();
  group.name = `plan-overlay:${planView.id}`;
  group.renderOrder = OVERLAY_RENDER_ORDER;
  group.userData.planOverlay3d = true;
  group.userData.sourcePlanViewId = planView.id;

  if (bounds) {
    const cropPts = [
      { xMm: bounds.minX, yMm: bounds.minY },
      { xMm: bounds.maxX, yMm: bounds.minY },
      { xMm: bounds.maxX, yMm: bounds.maxY },
      { xMm: bounds.minX, yMm: bounds.maxY },
    ];
    const backdropPts = [
      { xMm: bounds.minX - SHEET_BACKDROP_PAD_MM, yMm: bounds.minY - SHEET_BACKDROP_PAD_MM },
      { xMm: bounds.maxX + SHEET_BACKDROP_PAD_MM, yMm: bounds.minY - SHEET_BACKDROP_PAD_MM },
      { xMm: bounds.maxX + SHEET_BACKDROP_PAD_MM, yMm: bounds.maxY + SHEET_BACKDROP_PAD_MM },
      { xMm: bounds.minX - SHEET_BACKDROP_PAD_MM, yMm: bounds.maxY + SHEET_BACKDROP_PAD_MM },
    ];
    const backdrop = makeShapeMesh(backdropPts, yM - 0.01, '#0f172a', 0.16);
    if (backdrop) group.add(backdrop);
    const sheet = makeShapeMesh(cropPts, yM, opts.sheetColor, sheetOpacity);
    if (sheet) group.add(sheet);
    const borderPts: number[] = [];
    addPolyline(borderPts, cropPts, yM + 0.035, true);
    const borderHalo = makeLineSegments(borderPts, '#ffffff', 0.78, PLAN_BORDER_HALO_WIDTH_M);
    if (borderHalo) group.add(borderHalo);
    const border = makeLineSegments(
      borderPts,
      opts.lineColor,
      Math.max(lineOpacity, 0.9),
      PLAN_BORDER_WIDTH_M,
    );
    if (border) group.add(border);
  }

  const wallPts: number[] = [];
  const roomPts: number[] = [];
  const openingPts: number[] = [];
  const stairPts: number[] = [];
  const assetPts: number[] = [];

  for (const e of all) {
    if (!elementOnLevel(e, planView.levelId, elementsById)) continue;
    if (e.kind === 'wall' && !hidden.has('wall') && segmentTouchesBounds(e.start, e.end, bounds)) {
      addSegment(wallPts, e.start, e.end, yM);
    } else if (e.kind === 'room' && !hidden.has('room')) {
      const pts = e.outlineMm.filter((p) => pointInBounds(p, bounds));
      if (pts.length >= 2) addPolyline(roomPts, e.outlineMm, yM + 0.006, true);
      const fill = makeShapeMesh(e.outlineMm, yM, opts.roomColor, fillOpacity);
      if (fill) group.add(fill);
      if (annotationsVisible) {
        const c = centroid(e.outlineMm);
        if (pointInBounds(c, bounds)) {
          const sprite = labelSprite(e.name, c.xMm, c.yMm, yM);
          if (sprite) group.add(sprite);
        }
      }
    } else if ((e.kind === 'door' || e.kind === 'window') && !hidden.has(e.kind)) {
      const wallId = e.kind === 'door' ? e.wallId : e.wallId;
      const wall = elementsById[wallId];
      if (!wall || wall.kind !== 'wall') continue;
      const t =
        e.kind === 'door'
          ? THREE.MathUtils.clamp(e.alongT, 0, 1)
          : THREE.MathUtils.clamp(e.alongT, 0, 1);
      const cx = wall.start.xMm + (wall.end.xMm - wall.start.xMm) * t;
      const cy = wall.start.yMm + (wall.end.yMm - wall.start.yMm) * t;
      if (!pointInBounds({ xMm: cx, yMm: cy }, bounds)) continue;
      const dx = wall.end.xMm - wall.start.xMm;
      const dy = wall.end.yMm - wall.start.yMm;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const half = (e.widthMm ?? 700) / 2;
      addSegment(
        openingPts,
        { xMm: cx - ux * half, yMm: cy - uy * half },
        { xMm: cx + ux * half, yMm: cy + uy * half },
        yM + 0.012,
      );
    } else if (e.kind === 'stair' && !hidden.has('stair')) {
      if (e.boundaryMm && e.boundaryMm.length > 2)
        addPolyline(stairPts, e.boundaryMm, yM + 0.015, true);
      addSegment(stairPts, e.runStartMm, e.runEndMm, yM + 0.015);
    } else if (e.kind === 'placed_asset' && !hidden.has('placed_asset')) {
      if (!pointInBounds(e.positionMm, bounds)) continue;
      const width = dimFromParams(e.paramValues, 'widthMm', 900);
      const depth = dimFromParams(e.paramValues, 'depthMm', 900);
      addRect(assetPts, e.positionMm, width, depth, e.rotationDeg ?? 0, yM + 0.018);
    } else if (e.kind === 'family_instance' && !hidden.has('family_instance')) {
      if (!pointInBounds(e.positionMm, bounds)) continue;
      const width = dimFromParams(e.paramValues, 'Width', 900);
      const depth = dimFromParams(e.paramValues, 'Depth', 900);
      addRect(assetPts, e.positionMm, width, depth, e.rotationDeg ?? 0, yM + 0.018);
    }
  }

  for (const obj of [
    makeLineSegments(roomPts, opts.roomColor, Math.max(lineOpacity * 0.65, 0.25)),
    makeLineSegments(wallPts, opts.lineColor, lineOpacity),
    makeLineSegments(openingPts, opts.openingColor, lineOpacity),
    makeLineSegments(stairPts, opts.stairColor, lineOpacity),
    makeLineSegments(assetPts, opts.assetColor, lineOpacity),
  ]) {
    if (obj) group.add(obj);
  }

  if (bounds && witnessVisible) {
    const witnessPts: number[] = [];
    for (const p of [
      { xMm: bounds.minX, yMm: bounds.minY },
      { xMm: bounds.maxX, yMm: bounds.minY },
      { xMm: bounds.maxX, yMm: bounds.maxY },
      { xMm: bounds.minX, yMm: bounds.maxY },
    ]) {
      witnessPts.push(p.xMm / 1000, sourceYM, p.yMm / 1000, p.xMm / 1000, yM, p.yMm / 1000);
    }
    const witness = makeDashedLineSegments(witnessPts, opts.witnessColor, 0.46);
    if (witness) group.add(witness);
  }

  return group.children.length > 0 ? group : null;
}
