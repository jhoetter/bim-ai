import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import {
  coerceVec2Mm,
  isPlanProjectionPrimitivesV1,
  type PlanProjectionPrimitivesV1Wire,
} from './planProjectionWire';

/** Plan slice elevation in world units (walls still render with real height elsewhere). */

const PLAN_Y = 0.02;

/** Documentation-style plan projection knobs (WP-C01/C02/C03). */

export const PLAN_SLICE_ELEVATION_M = PLAN_Y;

/** Thin wall prism at the active cut — reads lighter than volumetric extrusions elsewhere. */

export const PLAN_WALL_CENTER_SLICE_HEIGHT_M = 0.048;

export const PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT = 2.2;

export const PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS = 1.95;

export const PLAN_WINDOW_SILL_LINE_WIDTH = 1.2;

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

/** Server `room_overlap_plan` heuristic threshold (mm²); keep aligned with Python constraints. */
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
  return {
    kind: 'wall',
    id: String(row.id ?? ''),
    name: 'Wall',
    levelId: String(row.levelId ?? ''),
    start: coerceVec2Mm(row.startMm),
    end: coerceVec2Mm(row.endMm),
    thicknessMm: Number(row.thicknessMm ?? 200),
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

function rebuildPlanMeshesFromWire(
  holder: THREE.Object3D,
  elementsById: Record<string, Element>,
  opts: {
    selectedId?: string;
    presentation?: PlanPresentationPreset;
    wirePrimitives: PlanProjectionPrimitivesV1Wire;
  },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  const prim = opts.wirePrimitives;
  const presentation = opts.presentation ?? 'default';
  const selectedId = opts.selectedId;

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
    holder.add(gridLineThree(gl));
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
    holder.add(roomMesh(roomEl, presentation));
  }

  const floors = Array.isArray(prim.floors) ? (prim.floors as Record<string, unknown>[]) : [];
  for (const f of floors) {
    const outline = outlineMmFromWire(f.outlineMm);
    if (outline.length < 2) continue;
    holder.add(horizontalOutlineMesh(outline, PLAN_Y + 0.001, '#22c55e', 0.16, String(f.id ?? '')));
  }

  const roofs = Array.isArray(prim.roofs) ? (prim.roofs as Record<string, unknown>[]) : [];
  for (const rf of roofs) {
    const outline = outlineMmFromWire(rf.footprintMm);
    if (outline.length < 2) continue;
    holder.add(horizontalOutlineMesh(outline, PLAN_Y + 0.004, '#f97316', 0.2, String(rf.id ?? '')));
  }

  for (const w of wallsByWireId.values()) holder.add(planWallMesh(w, selectedId));

  const doors = Array.isArray(prim.doors) ? (prim.doors as Record<string, unknown>[]) : [];
  for (const d of doors) {
    const id = String(d.id ?? '');
    const wallId = String(d.wallId ?? '');
    const host = resolveWallForWire(wallId, elementsById, wallsByWireId);
    const doorEl = elementsById[id];
    if (!host || doorEl?.kind !== 'door') continue;
    holder.add(doorGroupThree(doorEl, host, selectedId, presentation === 'opening_focus'));
  }

  const wins = Array.isArray(prim.windows) ? (prim.windows as Record<string, unknown>[]) : [];
  for (const w of wins) {
    const id = String(w.id ?? '');
    const wallId = String(w.wallId ?? '');
    const host = resolveWallForWire(wallId, elementsById, wallsByWireId);
    const winEl = elementsById[id];
    if (!host || winEl?.kind !== 'window') continue;
    holder.add(planWindowMesh(winEl, host, selectedId, presentation === 'opening_focus'));
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
            riserMm: 175,
            treadMm: 275,
          } as Extract<Element, { kind: 'stair' }>);
    const g = stairPlanThree(stairEl);
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
  },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  if (opts.wirePrimitives && isPlanProjectionPrimitivesV1(opts.wirePrimitives)) {
    rebuildPlanMeshesFromWire(holder, elementsById, {
      selectedId: opts.selectedId,
      presentation: opts.presentation,
      wirePrimitives: opts.wirePrimitives,
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

    holder.add(roomMesh(r, presentation));
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

  for (const wall of walls) holder.add(planWallMesh(wall, opts.selectedId));

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
    const g = stairPlanThree(st);

    if (g) holder.add(g);
  }

  for (const dm of Object.values(elementsById)) {
    if (dm.kind !== 'dimension') continue;
    if (kindHidden('dimension')) continue;

    if (level && dm.levelId !== level) continue;

    holder.add(dimensionsThree(dm));
  }
}

function planWallMesh(wall: Extract<Element, { kind: 'wall' }>, selectedId?: string): THREE.Mesh {
  const { lenM: len, nx, nz } = segmentDir(wall);

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const angle = Math.atan2(nz, nx);

  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.02, 1.8);

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

function hueFromName(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Footprint tread preview on the stair base level (OG plan hides it). */

function stairPlanThree(stair: Extract<Element, { kind: 'stair' }>): THREE.Group | null {
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

  const nSteps = Math.max(2, Math.min(36, Math.round(len / Math.max(stair.treadMm / 1000, 0.05))));
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

  g.userData.bimPickId = stair.id;

  return g;
}

function roomMesh(
  room: Extract<Element, { kind: 'room' }>,
  presentation?: PlanPresentationPreset,
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

  const fill =
    scheme === 'room_scheme'
      ? {
          opacity: 0.34,

          color: `hsl(${hueFromName(room.name)} 62% 46%)`,
        }
      : scheme === 'opening_focus'
        ? { opacity: 0.045, color: '#1d4ed8' }
        : {
            opacity: 0.14,

            color: '#3b82f6',
          };

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color: fill.color,

      transparent: true,

      opacity: fill.opacity,

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
