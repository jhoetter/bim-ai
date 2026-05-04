import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { collectWallAnchors, snapPlanPoint } from './snapEngine';
import {
  buildPlanProjectionQuery,
  extractPlanPrimitives,
  extractRoomColorLegend,
  fetchPlanProjectionWire,
} from './planProjectionWire';
import { resolvePlanViewDisplay } from './planProjection';
import { rebuildPlanMeshes } from './symbology';

const SLICE_Y = 0.02;

function orthoExtents(halfWorldM: number) {
  const stepMm = halfWorldM < 5 ? 250 : halfWorldM < 12 ? 500 : halfWorldM < 24 ? 1000 : 2000;
  const snapMm = Math.max(stepMm * 3, 300);
  return { stepMm, snapMm };
}

function rayToPlanMm(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLICE_Y);
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, pt)) return null;
  return { xMm: pt.x * 1000, yMm: pt.z * 1000 };
}

type Draft =
  | { kind: 'wall'; sx: number; sy: number }
  | { kind: 'room'; verts: Array<{ xMm: number; yMm: number }> }
  | { kind: 'grid'; sx: number; sy: number }
  | { kind: 'dim'; ax: number; ay: number }
  | { kind: 'room_rect'; sx: number; sy: number };

function nearestWallAt(
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
  xMm: number,
  yMm: number,
): { wall: Extract<Element, { kind: 'wall' }>; alongT: number; distMm: number } | undefined {
  const px = xMm / 1000;
  const pz = yMm / 1000;
  let best:
    | { wall: Extract<Element, { kind: 'wall' }>; alongT: number; distMm: number }
    | undefined;
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall') continue;
    if (activeLevelId && el.levelId !== activeLevelId) continue;
    const ax = el.start.xMm / 1000;
    const az = el.start.yMm / 1000;
    const bx = el.end.xMm / 1000;
    const bz = el.end.yMm / 1000;
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const rawT = Math.max(
      0,
      Math.min(1, ((px - ax) * abx + (pz - az) * abz) / Math.max(len2, 1e-9)),
    );
    const fx = ax + abx * rawT;
    const fz = az + abz * rawT;
    const distMm = Math.hypot((px - fx) * 1000, (pz - fz) * 1000);
    if (!best || distMm < best.distMm) best = { wall: el, alongT: rawT, distMm };
  }
  return best;
}

function guessGridLabel(sxMm: number, syMm: number, exMm: number, eyMm: number) {
  const horizontal = Math.abs(eyMm - syMm) < Math.abs(exMm - sxMm);
  return horizontal
    ? `Axis ${Math.floor(Math.abs((syMm + 5000) / 3800)) + 1}`
    : String.fromCharCode(66 + Math.min(10, Math.floor(Math.abs(exMm - sxMm + 8200) / 4200)));
}

type Props = {
  wsConnected: boolean;
  activeLevelResolvedId: string;
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
};

export function PlanCanvas({ wsConnected, activeLevelResolvedId, onSemanticCommand }: Props) {
  void wsConnected;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const previewRef = useRef<THREE.Line | null>(null);
  const dragRef = useRef({ dragging: false, lastXmm: 0, lastZmm: 0, camX: 0, camZ: 0 });
  const skipClickRef = useRef(false);
  const camRef = useRef({ camX: 0, camZ: -2.8, half: 22 });
  const draftRef = useRef<Draft | undefined>(undefined);
  const [hudMm, setHudMm] = useState<{ xMm: number; yMm: number }>();
  const [halfUi, setHalfUi] = useState(22);
  const [geomEpoch, bumpGeom] = useState(0);
  const [roomColorLegend, setRoomColorLegend] = useState<
    Array<{ label: string; schemeColorHex: string; programmeCode?: string; department?: string }>
  >([]);

  const elementsById = useBimStore((s) => s.elementsById);
  const selectedId = useBimStore((s) => s.selectedId);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const setPlanProjectionPrimitives = useBimStore((s) => s.setPlanProjectionPrimitives);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const planPresentation = useBimStore((s) => s.planPresentationPreset);
  const planTool = useBimStore((s) => s.planTool);
  const orthoSnapHold = useBimStore((s) => s.orthoSnapHold);
  const selectEl = useBimStore((s) => s.select);

  const display = useMemo(
    () =>
      resolvePlanViewDisplay(
        elementsById,
        activePlanViewId,
        activeLevelResolvedId || undefined,
        planPresentation,
      ),
    [elementsById, activePlanViewId, activeLevelResolvedId, planPresentation],
  );

  const hiddenKey = useMemo(
    () => [...display.hiddenSemanticKinds].sort().join('|'),
    [display.hiddenSemanticKinds],
  );

  const displayLevelId = display.activeLevelId;
  const anchors = useMemo(
    () => collectWallAnchors(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
  const lvlId = displayLevelId || activeLevelResolvedId;

  useEffect(() => {
    let cancel = false;
    if (!modelId) {
      queueMicrotask(() => {
        if (cancel) return;
        setPlanProjectionPrimitives(null);
        setRoomColorLegend([]);
      });
      return () => {
        cancel = true;
      };
    }
    void (async () => {
      try {
        const qs = buildPlanProjectionQuery({
          planViewId: display.planViewElementId,
          fallbackLevelId: display.planViewElementId ? undefined : lvlId || undefined,
          globalPresentation: planPresentation,
        });
        const payload = await fetchPlanProjectionWire(modelId, qs);
        if (cancel) return;
        setPlanProjectionPrimitives(extractPlanPrimitives(payload));
        setRoomColorLegend(extractRoomColorLegend(payload));
      } catch {
        if (!cancel) setPlanProjectionPrimitives(null);
        if (!cancel) setRoomColorLegend([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [
    modelId,
    revision,
    display.planViewElementId,
    lvlId,
    planPresentation,
    setPlanProjectionPrimitives,
  ]);

  const resizeCam = useCallback(() => {
    const host = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!host || !renderer || !camera) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    const asp = w / h;
    const hh = camRef.current.half;
    camera.left = -hh * asp;
    camera.right = hh * asp;
    camera.top = hh;
    camera.bottom = -hh;
    camera.position.set(camRef.current.camX, 320, camRef.current.camZ);
    camera.lookAt(camRef.current.camX, 0, camRef.current.camZ);
    camera.updateProjectionMatrix();
    setHalfUi(camRef.current.half);
  }, []);

  useEffect(() => {
    draftRef.current = undefined;
  }, [planTool]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setClearColor('#0b1220', 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.76));
    const grp = new THREE.Group();
    rootRef.current = grp;
    scene.add(grp);
    const oc = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.03, 5000);
    oc.up.set(0, 1, 0);
    cameraRef.current = oc;
    const ro = new ResizeObserver(() => resizeCam());
    ro.observe(mount);
    resizeCam();
    let raf = 0;
    const tick = () => {
      renderer.render(scene, oc);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [resizeCam]);

  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;
    const wirePrimitives = modelId ? planProjectionPrimitives : null;
    rebuildPlanMeshes(grp, elementsById, {
      activeLevelId: displayLevelId || undefined,
      selectedId,
      presentation: display.presentation,
      hiddenSemanticKinds: display.hiddenSemanticKinds,
      wirePrimitives,
    });
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { draftingGrid?: unknown }).draftingGrid) grp.remove(ch);
    }
    const span = camRef.current.half * 3.8;
    const step = orthoExtents(camRef.current.half).stepMm / 1000;
    const gv: THREE.Vector3[] = [];
    for (let x = -span; x <= span; x += step) {
      gv.push(new THREE.Vector3(x, SLICE_Y, -span), new THREE.Vector3(x, SLICE_Y, span));
    }
    for (let z = -span; z <= span; z += step) {
      gv.push(new THREE.Vector3(-span, SLICE_Y, z), new THREE.Vector3(span, SLICE_Y, z));
    }
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(gv),
      new THREE.LineBasicMaterial({ color: '#223042', transparent: true, opacity: 0.35 }),
    );
    grid.userData.draftingGrid = true;
    grp.add(grid);
  }, [
    display.presentation,
    display.hiddenSemanticKinds,
    displayLevelId,
    elementsById,
    geomEpoch,
    hiddenKey,
    planProjectionPrimitives,
    modelId,
    planTool,
    selectedId,
  ]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    const rnd = rendererRef.current;
    const camNow = cameraRef.current;
    const grp = rootRef.current;
    if (!canvas || !rnd || !camNow || !grp) return;

    const snapped = (clientX: number, clientY: number) => {
      const rw = rayToPlanMm(rnd, camNow, clientX, clientY);
      if (!rw) return;
      const anchor =
        draftRef.current?.kind === 'wall'
          ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
          : draftRef.current?.kind === 'grid'
            ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
            : draftRef.current?.kind === 'dim'
              ? { xMm: draftRef.current.ax, yMm: draftRef.current.ay }
              : draftRef.current?.kind === 'room_rect'
                ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
                : draftRef.current?.kind === 'room' && draftRef.current.verts.length
                  ? draftRef.current.verts.at(-1)
                  : undefined;
      const hs = orthoExtents(camRef.current.half);
      return snapPlanPoint({
        cursor: rw,
        anchors,
        gridStepMm: hs.stepMm,
        chainAnchor: anchor,
        snapMm: hs.snapMm,
        orthoHold: orthoSnapHold,
      }).point;
    };

    const redrawSeg = (a: THREE.Vector3, b: THREE.Vector3) => {
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
      }
      previewRef.current = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: '#fcd34d' }),
      );
      grp.add(previewRef.current);
    };

    const redrawPreviewRectMm = (x0Mm: number, y0Mm: number, x1Mm: number, y1Mm: number) => {
      const xMn = Math.min(x0Mm, x1Mm) / 1000;
      const xMx = Math.max(x0Mm, x1Mm) / 1000;
      const zMn = Math.min(y0Mm, y1Mm) / 1000;
      const zMx = Math.max(y0Mm, y1Mm) / 1000;
      const pts = [
        new THREE.Vector3(xMn, SLICE_Y, zMn),
        new THREE.Vector3(xMx, SLICE_Y, zMn),
        new THREE.Vector3(xMx, SLICE_Y, zMx),
        new THREE.Vector3(xMn, SLICE_Y, zMx),
        new THREE.Vector3(xMn, SLICE_Y, zMn),
      ];
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
      }
      previewRef.current = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: '#a7f3d0' }),
      );
      grp.add(previewRef.current);
    };

    const onMove = (ev: PointerEvent) => {
      const xy = snapped(ev.clientX, ev.clientY);
      setHudMm(xy);
      useBimStore.getState().setPlanHud(xy);
      if (dragRef.current.dragging) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        camRef.current.camX = dragRef.current.camX - (rr.xMm - dragRef.current.lastXmm) / 1000;
        camRef.current.camZ = dragRef.current.camZ - (rr.yMm - dragRef.current.lastZmm) / 1000;
        resizeCam();
        skipClickRef.current = true;
        return;
      }
      const v = snapped(ev.clientX, ev.clientY);
      if (!v) return;
      const p = new THREE.Vector3(v.xMm / 1000, SLICE_Y, v.yMm / 1000);
      const d = draftRef.current;
      if (planTool === 'room_rectangle' && d?.kind === 'room_rect') {
        redrawPreviewRectMm(d.sx, d.sy, v.xMm, v.yMm);
        return;
      }
      if (
        (planTool === 'wall' && d?.kind === 'wall') ||
        (planTool === 'grid' && d?.kind === 'grid') ||
        (planTool === 'dimension' && d?.kind === 'dim') ||
        (planTool === 'room' && d?.kind === 'room' && d.verts.length)
      ) {
        const pv =
          planTool === 'room' && d?.kind === 'room'
            ? new THREE.Vector3(d.verts.at(-1)!.xMm / 1000, SLICE_Y, d.verts.at(-1)!.yMm / 1000)
            : planTool === 'wall' && d?.kind === 'wall'
              ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
              : planTool === 'grid' && d?.kind === 'grid'
                ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
                : planTool === 'dimension' && d?.kind === 'dim'
                  ? new THREE.Vector3(d.ax / 1000, SLICE_Y, d.ay / 1000)
                  : p;
        redrawSeg(pv, p);
      }
    };

    const onDown = (ev: PointerEvent) => {
      if ((ev.buttons & 2) === 2 || ev.buttons === 4 || ev.shiftKey) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        dragRef.current = {
          dragging: true,
          lastXmm: rr.xMm,
          lastZmm: rr.yMm,
          camX: camRef.current.camX,
          camZ: camRef.current.camZ,
        };
      }
      skipClickRef.current = false;
    };

    const onUpWindow = () => {
      dragRef.current.dragging = false;
    };

    const onClick = (ev: MouseEvent) => {
      if (skipClickRef.current) {
        skipClickRef.current = false;
        return;
      }
      const sp = snapped(ev.clientX, ev.clientY);
      if (!sp || !lvlId) return;
      if (planTool === 'select') {
        const rectBox = rnd.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
            -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
          ),
          camNow,
        );
        const hits = ray.intersectObjects(grp.children, true);
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const id =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        selectEl(id);
        return;
      }
      if (planTool === 'door') {
        const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
        if (!n || n.distMm > 900) return;
        onSemanticCommand({
          type: 'insertDoorOnWall',
          wallId: n.wall.id,
          alongT: n.alongT,
          widthMm: 900,
        });
        return;
      }
      if (planTool === 'window') {
        const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
        if (!n || n.distMm > 900) return;
        onSemanticCommand({
          type: 'insertWindowOnWall',
          wallId: n.wall.id,
          alongT: n.alongT,
          widthMm: 1200,
          sillHeightMm: 900,
          heightMm: 1500,
        });
        return;
      }
      if (planTool === 'wall') {
        const d = draftRef.current;
        if (!d || d.kind !== 'wall') {
          draftRef.current = { kind: 'wall', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createWall',
          levelId: lvlId,
          start: { xMm: d.sx, yMm: d.sy },
          end: { xMm: sp.xMm, yMm: sp.yMm },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room_rectangle') {
        const dr = draftRef.current;
        if (!dr || dr.kind !== 'room_rect') {
          draftRef.current = { kind: 'room_rect', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        const ox = Math.min(dr.sx, sp.xMm);
        const oy = Math.min(dr.sy, sp.yMm);
        const widthMm = Math.abs(sp.xMm - dr.sx);
        const depthMm = Math.abs(sp.yMm - dr.sy);
        if (widthMm < 200 || depthMm < 200) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createRoomRectangle',
          levelId: lvlId,
          origin: { xMm: ox, yMm: oy },
          widthMm,
          depthMm,
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'grid') {
        const d = draftRef.current;
        if (!d || d.kind !== 'grid') {
          draftRef.current = { kind: 'grid', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createGridLine',
          label: guessGridLabel(d.sx, d.sy, sp.xMm, sp.yMm),
          levelId: lvlId,
          start: { xMm: d.sx, yMm: d.sy },
          end: { xMm: sp.xMm, yMm: sp.yMm },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'dimension') {
        const d = draftRef.current;
        if (!d || d.kind !== 'dim') {
          draftRef.current = { kind: 'dim', ax: sp.xMm, ay: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        const dx = sp.xMm - d.ax;
        const dy = sp.yMm - d.ay;
        const m = Math.hypot(dx, dy) || 1;
        onSemanticCommand({
          type: 'createDimension',
          levelId: lvlId,
          aMm: { xMm: d.ax, yMm: d.ay },
          bMm: { xMm: sp.xMm, yMm: sp.yMm },
          offsetMm: { xMm: (-dy / m) * 450, yMm: (dx / m) * 450 },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
        let rm = draftRef.current;
        if (!rm || rm.kind !== 'room') {
          rm = { kind: 'room', verts: [{ xMm: sp.xMm, yMm: sp.yMm }] };
          draftRef.current = rm;
          bumpGeom((x) => x + 1);
          return;
        }
        const fst = rm.verts[0];
        if (fst && rm.verts.length >= 3 && Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) < 520) {
          onSemanticCommand({
            type: 'createRoomOutline',
            levelId: lvlId,
            outlineMm: rm.verts.map((vv) => ({ xMm: vv.xMm, yMm: vv.yMm })),
          });
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          if (previewRef.current) {
            grp.remove(previewRef.current);
            previewRef.current.geometry.dispose();
            previewRef.current = null;
          }
          return;
        }
        rm.verts.push({ xMm: sp.xMm, yMm: sp.yMm });
        bumpGeom((x) => x + 1);
      }
    };

    const onWheel = (ev: WheelEvent) => {
      camRef.current.half = THREE.MathUtils.clamp(camRef.current.half + ev.deltaY * 0.011, 4, 420);
      resizeCam();
      ev.preventDefault();
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
      }
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUpWindow);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUpWindow);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [
    anchors,
    bumpGeom,
    displayLevelId,
    elementsById,
    lvlId,
    onSemanticCommand,
    orthoSnapHold,
    planTool,
    resizeCam,
    selectEl,
  ]);

  const sb = THREE.MathUtils.clamp(halfUi * 0.25, 0.2, 6);
  return (
    <div
      data-testid="plan-canvas"
      className="relative h-[min(740px,calc(100vh-260px))] w-full overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-border bg-surface/80 px-3 py-1 text-[11px] text-muted backdrop-blur">
        Plan · pan Shift+LMB / MMB · zoom wheel · Esc cancels · tool {planTool}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-14 z-10 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
        {hudMm
          ? `X ${(hudMm.xMm / 1000).toFixed(2)} m · Y ${(hudMm.yMm / 1000).toFixed(2)} m`
          : '—'}
      </div>
      <div className="pointer-events-none absolute right-3 top-14 z-10 max-w-[min(260px,calc(100%-24px))] rounded border border-border bg-surface/90 px-2 py-2 text-[10px] text-muted backdrop-blur">
        {planPresentation === 'room_scheme' && roomColorLegend.length ? (
          <div data-testid="plan-room-color-legend">
            <div className="mb-1 font-semibold text-foreground">Room colour legend</div>
            <ul className="space-y-1">
              {roomColorLegend.map((row) => (
                <li key={`${row.label}-${row.schemeColorHex}`} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 inline-block size-3 shrink-0 rounded-sm border border-border"
                    style={{ backgroundColor: row.schemeColorHex }}
                    title={row.programmeCode ?? row.label}
                  />
                  <span className="leading-tight text-foreground">{row.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute left-3 bottom-3 z-10 rounded border border-border bg-surface/80 px-2 py-1 text-[10px] text-muted backdrop-blur">
        ━━━ {`${(sb * 100).toFixed(0)} cm`}
      </div>
      <div ref={mountRef} className="size-full cursor-crosshair" />
    </div>
  );
}
