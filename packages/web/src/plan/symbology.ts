import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

/** Plan slice elevation in world units (walls still render with real height elsewhere). */

const PLAN_Y = 0.02;

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

export function rebuildPlanMeshes(
  holder: THREE.Object3D,

  elementsById: Record<string, Element>,

  opts: { activeLevelId?: string; selectedId?: string },
): void {
  while (holder.children.length) holder.remove(holder.children[0]!);

  const level = opts.activeLevelId;

  type WallElem = Extract<Element, { kind: 'wall' }>;

  const walls = Object.values(elementsById).filter(
    (e): e is WallElem => e.kind === 'wall' && (!level || e.levelId === level),
  );

  const wallsById: Record<string, WallElem> = Object.fromEntries(walls.map((w) => [w.id, w]));

  for (const g of Object.values(elementsById)) {
    if (g.kind !== 'grid_line') continue;

    if (g.levelId && level && g.levelId !== level) continue;

    holder.add(gridLineThree(g));
  }

  for (const r of Object.values(elementsById)) {
    if (r.kind !== 'room') continue;

    if (level && r.levelId !== level) continue;

    holder.add(roomMesh(r));
  }

  for (const f of Object.values(elementsById)) {
    if (f.kind !== 'floor') continue;

    if (level && f.levelId !== level) continue;

    holder.add(horizontalOutlineMesh(f.boundaryMm, PLAN_Y + 0.001, '#22c55e', 0.16, f.id));
  }

  for (const rf of Object.values(elementsById)) {
    if (rf.kind !== 'roof') continue;

    if (level && rf.referenceLevelId !== level) continue;

    holder.add(horizontalOutlineMesh(rf.footprintMm, PLAN_Y + 0.004, '#f97316', 0.2, rf.id));
  }

  for (const wall of walls) holder.add(planWallMesh(wall, opts.selectedId));

  for (const d of Object.values(elementsById)) {
    if (d.kind !== 'door') continue;

    const host = wallsById[d.wallId];

    if (!host) continue;

    holder.add(doorGroupThree(d, host, opts.selectedId));
  }

  for (const win of Object.values(elementsById)) {
    if (win.kind !== 'window') continue;

    const host = wallsById[win.wallId];

    if (!host) continue;

    holder.add(planWindowMesh(win, host, opts.selectedId));
  }

  for (const dm of Object.values(elementsById)) {
    if (dm.kind !== 'dimension') continue;

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

  const geom = new THREE.BoxGeometry(len, 0.05, thick);

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
      color: door.id === selectedId ? '#fde047' : '#67e8f9',
    }),
  );

  opening.position.set(px, PLAN_Y + 0.025, pz);

  opening.rotation.y = Math.atan2(seg.nz, seg.nx);

  opening.userData.bimPickId = door.id;

  g.add(opening);

  const curve = new THREE.EllipseCurve(
    0,
    0,
    width / 2.2,
    width / 2.2,
    Math.PI / 4,
    Math.PI / 4 + Math.PI / 2.2,
  );

  const arcPts = curve.getPoints(16).map((p) => new THREE.Vector3(p.x, PLAN_Y + 0.03, -p.y));

  const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);

  const arc = new THREE.Line(
    arcGeom,

    new THREE.LineBasicMaterial({ color: '#0ea5e9' }),
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
): THREE.Mesh {
  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const seg = segmentDir(wall);

  const px = sx + seg.nx * seg.lenM * win.alongT;

  const pz = sz + seg.nz * seg.lenM * win.alongT;

  const width = THREE.MathUtils.clamp(win.widthMm / 1000, 0.2, seg.lenM * 0.95);

  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.01, 0.05, 1);

  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.08, (wall.heightMm / 1000) * 0.85);

  const h = THREE.MathUtils.clamp(win.heightMm / 1000, 0.06, wall.heightMm / 1000 - sill - 0.05);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, h, depth),

    new THREE.MeshStandardMaterial({
      transparent: true,

      opacity: 0.55,

      color: win.id === selectedId ? '#c4b5fd' : '#a78bfa',
    }),
  );

  mesh.position.set(px, sill + h / 2, pz);

  mesh.rotation.y = Math.atan2(seg.nz, seg.nx);

  mesh.userData.bimPickId = win.id;

  return mesh;
}

function roomMesh(room: Extract<Element, { kind: 'room' }>): THREE.Mesh {
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

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color: '#3b82f6',

      transparent: true,

      opacity: 0.14,

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
