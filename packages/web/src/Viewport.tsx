import { useEffect, useRef } from 'react';

import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { useBimStore } from './state/store';

type Props = { wsConnected: boolean };

type WallElem = Extract<Element, { kind: 'wall' }>;

/** Footprints use world XZ with z ← plan yMm */

function xzBoundsMm(poly: Array<{ xMm: number; yMm: number }>): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  spanX: number;
  spanZ: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    minX = Math.min(minX, p.xMm);

    maxX = Math.max(maxX, p.xMm);

    minZ = Math.min(minZ, p.yMm);

    maxZ = Math.max(maxZ, p.yMm);
  }

  const spanX = Math.max(maxX - minX, 1);

  const spanZ = Math.max(maxZ - minZ, 1);

  return {
    minX,

    maxX,

    minZ,

    maxZ,

    cx: (minX + maxX) / 2,

    cz: (minZ + maxZ) / 2,

    spanX,

    spanZ,
  };
}

function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lvl = elementsById[levelId];
  if (!lvl || lvl.kind !== 'level') return 0;
  return lvl.elevationMm / 1000;
}

function hostedXZ(
  hosted: Extract<Element, { kind: 'door' } | { kind: 'window' }>,
  wall: WallElem,
): { px: number; pz: number } {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const dx = wall.end.xMm / 1000 - sx;
  const dz = wall.end.yMm / 1000 - sz;
  const len = Math.max(1e-6, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  return {
    px: sx + ux * hosted.alongT * len,
    pz: sz + uz * hosted.alongT * len,
  };
}

function wallYaw(wall: WallElem) {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  return Math.atan2(ez - sz, ex - sx);
}

function makeFloorSlabMesh(
  floor: Extract<Element, { kind: 'floor' }>,
  elementsById: Record<string, Element>,
): THREE.Mesh {
  const b = xzBoundsMm(floor.boundaryMm ?? []);

  const elev = elevationMForLevel(floor.levelId, elementsById);

  const th = THREE.MathUtils.clamp(floor.thicknessMm / 1000, 0.05, 1.8);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(b.spanX / 1000, th, b.spanZ / 1000),

    new THREE.MeshStandardMaterial({
      color: '#22c55e',
      roughness: 0.9,
      transparent: true,
      opacity: 0.92,
    }),
  );

  mesh.position.set(b.cx / 1000, elev + th / 2, b.cz / 1000);

  mesh.userData.bimPickId = floor.id;

  return mesh;
}

function makeRoofMassMesh(
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
): THREE.Mesh {
  const b = xzBoundsMm(roof.footprintMm ?? []);

  const ov = THREE.MathUtils.clamp((roof.overhangMm ?? 0) / 1000, 0, 5);

  const elev = elevationMForLevel(roof.referenceLevelId, elementsById);

  const rise = THREE.MathUtils.clamp(Number(roof.slopeDeg ?? 25) / 70, 0.25, 2.8);

  const spanX = THREE.MathUtils.clamp(b.spanX / 1000 + ov * 0.08, 3, 200);

  const spanZ = THREE.MathUtils.clamp(b.spanZ / 1000 + ov * 0.08, 3, 200);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(spanX, rise, spanZ),

    new THREE.MeshStandardMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.94,
      roughness: 0.74,
      metalness: 0.04,
    }),
  );

  mesh.position.set(b.cx / 1000, elev + ov * 0.12 + rise / 2, b.cz / 1000);

  mesh.userData.bimPickId = roof.id;

  return mesh;
}

function makeStairVolumeMesh(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById: Record<string, Element>,
  selectedId?: string,
): THREE.Mesh {
  const sx = stair.runStartMm.xMm / 1000;

  const sz = stair.runStartMm.yMm / 1000;

  const ex = stair.runEndMm.xMm / 1000;

  const ez = stair.runEndMm.yMm / 1000;

  const dx = ex - sx;

  const dz = ez - sz;

  const len = Math.max(1e-3, Math.hypot(dx, dz));

  const width = THREE.MathUtils.clamp(stair.widthMm / 1000, 0.3, 4);

  const bl = elementsById[stair.baseLevelId];

  const tl = elementsById[stair.topLevelId];

  const riseMm =
    bl?.kind === 'level' && tl?.kind === 'level'
      ? Math.abs(tl.elevationMm - bl.elevationMm)
      : stair.riserMm * 16;

  const rise = THREE.MathUtils.clamp(riseMm / 1000, 0.5, 12);

  const elevBase = elevationMForLevel(stair.baseLevelId, elementsById);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, rise, width),

    new THREE.MeshStandardMaterial({ color: stair.id === selectedId ? '#fcd34d' : '#ca8a04' }),
  );

  mesh.position.set(sx + dx / 2, elevBase + rise / 2, sz + dz / 2);

  mesh.rotation.y = Math.atan2(dx, dz);

  mesh.userData.bimPickId = stair.id;

  return mesh;
}

function makeWallMesh(wall: WallElem, elevM: number, selectedId?: string): THREE.Mesh {
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const height = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  const thick = THREE.MathUtils.clamp(wall.thicknessMm / 1000, 0.05, 2);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, height, thick),
    new THREE.MeshStandardMaterial({ color: wall.id === selectedId ? '#fb923c' : '#cbd5e1' }),
  );
  mesh.position.set(sx + dx / 2, elevM + height / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dz, dx);
  mesh.userData.bimPickId = wall.id;
  return mesh;
}

function makeDoorMesh(
  door: Extract<Element, { kind: 'door' }>,
  wall: WallElem,
  elevM: number,
  sid?: string,
) {
  const { px, pz } = hostedXZ(door, wall);
  const height = THREE.MathUtils.clamp((wall.heightMm / 1000) * 0.86, 0.6, 2.2);
  const width = THREE.MathUtils.clamp(door.widthMm / 1000, 0.35, 4);
  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.08, 0.08, 2);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: door.id === sid ? '#fde047' : '#67e8f9' }),
  );
  mesh.position.set(px, elevM + height / 2, pz);
  mesh.rotation.y = wallYaw(wall);
  mesh.userData.bimPickId = door.id;
  return mesh;
}

function makeWindowMesh(
  win: Extract<Element, { kind: 'window' }>,
  wall: WallElem,
  elevM: number,
  sid?: string,
) {
  const { px, pz } = hostedXZ(win, wall);
  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.06, wall.heightMm / 1000 - 0.08);
  const h = THREE.MathUtils.clamp(win.heightMm / 1000, 0.05, wall.heightMm / 1000 - sill - 0.06);
  const width = THREE.MathUtils.clamp(win.widthMm / 1000, 0.14, 4);
  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.02, 0.06, 1.5);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, h, depth),
    new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.84,
      color: win.id === sid ? '#ddd6fe' : '#e9d5ff',
    }),
  );
  mesh.position.set(px, elevM + sill + h / 2, pz);
  mesh.rotation.y = wallYaw(wall);
  mesh.userData.bimPickId = win.id;
  return mesh;
}

function makeRoomRibbon(room: Extract<Element, { kind: 'room' }>, elevM: number) {
  const pts = room.outlineMm.map(
    (p) => new THREE.Vector3(p.xMm / 1000, elevM + 0.035, p.yMm / 1000),
  );
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const loop = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: '#60a5fa' }));
  loop.userData.bimPickId = room.id;
  return loop;
}

type ViewerCatKey = 'wall' | 'floor' | 'roof' | 'stair' | 'door' | 'window' | 'room';

function elemViewerCategory(e: Element): ViewerCatKey | null {
  switch (e.kind) {
    case 'wall':
      return 'wall';
    case 'floor':
      return 'floor';
    case 'roof':
      return 'roof';
    case 'stair':
      return 'stair';
    case 'door':
      return 'door';
    case 'window':
      return 'window';
    case 'room':
      return 'room';
    default:
      return null;
  }
}

function applyClippingPlanesToMeshes(root: THREE.Object3D, planes: THREE.Plane[]) {
  if (!planes.length) return;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      const m = mesh.material.clone();
      m.clippingPlanes = planes.slice();
      mesh.material = m;
    }
  });
}

export function Viewport({ wsConnected }: Props) {
  void wsConnected;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);

  const elementsById = useBimStore((s) => s.elementsById);

  const selectedId = useBimStore((s) => s.selectedId);

  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);

  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const host = el;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#0b1220', 1);
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(8, 12, 6);
    scene.add(dir);
    scene.add(new THREE.GridHelper(160, 32, '#223042', '#1a2738'));

    const root = new THREE.Group();

    rootGroupRef.current = root;
    scene.add(root);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    camera.up.set(0, 1, 0);

    cameraRef.current = camera;

    let az = Math.PI / 4;
    let elv = 0.45;
    let radius = 16;
    const target = new THREE.Vector3(0, 1.35, 0);
    let dragging = false;

    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function placeCamera() {
      camera.position.set(
        target.x + radius * Math.cos(elv) * Math.sin(az),
        target.y + radius * Math.sin(elv),
        target.z + radius * Math.cos(elv) * Math.cos(az),
      );
      camera.lookAt(target);
      camera.up.set(0, 1, 0);
    }

    placeCamera();

    function pick(cx: number, cy: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);

      const first = hits.find((h) => typeof h.object.userData.bimPickId === 'string');
      useBimStore.getState().select(first?.object.userData.bimPickId as string | undefined);
    }

    function onResize() {
      const w = host.clientWidth || 1;

      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    onResize();

    function onDown(ev: PointerEvent) {
      dragging = true;
      dragMoved = false;

      lastX = ev.clientX;
      lastY = ev.clientY;
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    }

    function onUp(ev: PointerEvent) {
      dragging = false;

      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }

      if (!dragMoved) pick(ev.clientX, ev.clientY);
    }

    function onMove(ev: PointerEvent) {
      if (!dragging) return;

      const dx = ev.clientX - lastX;

      const dy = ev.clientY - lastY;
      if (Math.hypot(dx, dy) > 2) dragMoved = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      az += dx * 0.006;

      elv = THREE.MathUtils.clamp(elv - dy * 0.006, 0.12, Math.PI / 2 - 0.08);
      placeCamera();
    }

    function onWheel(ev: WheelEvent) {
      radius = THREE.MathUtils.clamp(radius + ev.deltaY * 0.012, 4, 80);

      placeCamera();
    }

    renderer.domElement.addEventListener('pointerdown', onDown);

    renderer.domElement.addEventListener('pointerup', onUp);

    renderer.domElement.addEventListener('pointermove', onMove);

    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    function tick() {
      renderer.render(scene, camera);

      rafRef.current = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      ro.disconnect();

      renderer.domElement.removeEventListener('pointerdown', onDown);

      renderer.domElement.removeEventListener('pointerup', onUp);

      renderer.domElement.removeEventListener('pointermove', onMove);

      renderer.domElement.removeEventListener('wheel', onWheel);

      renderer.dispose();

      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const root = rootGroupRef.current;

    const camera = cameraRef.current;

    if (!root || !camera) return;

    while (root.children.length) root.remove(root.children[0]!);

    const clipElevMRaw = viewerClipElevMm;
    const clipElevM =
      clipElevMRaw != null && Number.isFinite(clipElevMRaw) && clipElevMRaw > 0
        ? clipElevMRaw / 1000
        : null;

    const rnd = rendererRef.current;
    if (rnd) rnd.localClippingEnabled = clipElevM != null;

    const clippingPlanes: THREE.Plane[] = [];
    if (clipElevM != null) {
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, clipElevM, 0),
      );
      clippingPlanes.push(plane);
    }
    const catHidden = viewerCategoryHidden;

    const skipCat = (e: Element): boolean => {
      const ck = elemViewerCategory(e);
      return ck != null && Boolean(catHidden[ck]);
    };

    const walls = Object.values(elementsById).filter((e): e is WallElem => e.kind === 'wall');

    const wallById = Object.fromEntries(walls.map((w) => [w.id, w]));

    for (const f of Object.values(elementsById)) {
      if (f.kind !== 'floor') continue;
      if (skipCat(f)) continue;

      root.add(makeFloorSlabMesh(f, elementsById));
    }

    for (const w of walls) {
      if (skipCat(w)) continue;
      const elev = elevationMForLevel(w.levelId, elementsById);

      root.add(makeWallMesh(w, elev, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'door') continue;
      if (skipCat(e)) continue;

      const hw = wallById[e.wallId];

      if (!hw || skipCat(hw)) continue;

      const elev = elevationMForLevel(hw.levelId, elementsById);

      root.add(makeDoorMesh(e, hw, elev, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'window') continue;
      if (skipCat(e)) continue;

      const hw = wallById[e.wallId];

      if (!hw || skipCat(hw)) continue;

      const elev = elevationMForLevel(hw.levelId, elementsById);

      root.add(makeWindowMesh(e, hw, elev, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'stair') continue;
      if (skipCat(e)) continue;

      root.add(makeStairVolumeMesh(e, elementsById, selectedId));
    }

    for (const e of Object.values(elementsById)) {
      if (e.kind !== 'room') continue;
      if (skipCat(e)) continue;

      root.add(makeRoomRibbon(e, elevationMForLevel(e.levelId, elementsById)));
    }

    for (const rf of Object.values(elementsById)) {
      if (rf.kind !== 'roof') continue;
      if (skipCat(rf)) continue;

      root.add(makeRoofMassMesh(rf, elementsById));
    }

    applyClippingPlanesToMeshes(root, clippingPlanes);

    camera.lookAt(new THREE.Vector3(0, 1.35, 0));
  }, [elementsById, selectedId, viewerCategoryHidden, viewerClipElevMm]);

  return (
    <div
      data-testid="orbit-3d-viewport"
      className="relative h-[min(740px,calc(100vh-260px))] w-full overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-border bg-surface/80 px-3 py-1 text-[11px] text-muted backdrop-blur">
        3D orbit · LMB pick · drag · zoom
      </div>

      <div ref={mountRef} className="size-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
