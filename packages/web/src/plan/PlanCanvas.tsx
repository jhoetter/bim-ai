import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { useTheme } from '../state/useTheme';
import { liveTokenReader } from '../viewport/materials';
import { collectWallAnchors, snapPlanPoint } from './snapEngine';
import {
  buildPlanProjectionQuery,
  extractPlanAnnotationHints,
  extractPlanCategoryGraphicHintsV0,
  extractPlanGraphicHints,
  extractPlanPrimitives,
  extractPlanTagStyleHints,
  extractRoomColorLegend,
  extractRoomProgrammeLegendEvidenceV0,
  fetchPlanProjectionWire,
} from './planProjectionWire';
import {
  resolvePlanAnnotationHints,
  resolvePlanGraphicHints,
  resolvePlanTagStyleLane,
  resolvePlanViewDisplay,
} from './planProjection';
import { rebuildPlanMeshes } from './symbology';

function readPlanToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

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

/** Imperative handle so the tab host can snapshot / restore the 2D camera
 * without continuous callbacks. Fill via cameraHandleRef prop. */
export interface PlanCameraHandle {
  getSnapshot(): { centerMm: { xMm: number; yMm: number }; halfMm: number };
  applySnapshot(snap: { centerMm?: { xMm?: number; yMm?: number }; halfMm?: number }): void;
}

type Props = {
  wsConnected: boolean;
  activeLevelResolvedId: string;
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
  /** Ref filled with the imperative camera handle once the canvas mounts. */
  cameraHandleRef?: RefObject<PlanCameraHandle | null>;
  /** Camera to restore on mount (ignored after first render). */
  initialCamera?: { centerMm?: { xMm: number; yMm: number }; halfMm?: number };
};

export function PlanCanvas({
  wsConnected,
  activeLevelResolvedId,
  onSemanticCommand,
  cameraHandleRef,
  initialCamera,
}: Props) {
  void wsConnected;
  const theme = useTheme();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const previewRef = useRef<THREE.Line | null>(null);
  const dragRef = useRef({ dragging: false, lastXmm: 0, lastZmm: 0, camX: 0, camZ: 0 });
  const skipClickRef = useRef(false);
  const camRef = useRef({
    camX: initialCamera?.centerMm ? initialCamera.centerMm.xMm / 1000 : 0,
    camZ: initialCamera?.centerMm ? initialCamera.centerMm.yMm / 1000 : -2.8,
    half: initialCamera?.halfMm !== undefined ? initialCamera.halfMm / 1000 : 22,
  });
  const draftRef = useRef<Draft | undefined>(undefined);
  const spaceDownRef = useRef(false);
  const minZoomRef = useRef(2);
  const [hudMm, setHudMm] = useState<{ xMm: number; yMm: number }>();
  const [halfUi, setHalfUi] = useState(22);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [geomEpoch, bumpGeom] = useState(0);
  const [roomColorLegend, setRoomColorLegend] = useState<
    Array<{
      label: string;
      schemeColorHex: string;
      programmeCode?: string;
      department?: string;
      functionLabel?: string;
    }>
  >([]);
  const [wireGraphicHints, setWireGraphicHints] = useState<ReturnType<
    typeof extractPlanGraphicHints
  > | null>(null);
  const [wireAnnotationHints, setWireAnnotationHints] = useState<ReturnType<
    typeof extractPlanAnnotationHints
  > | null>(null);
  const [wireTagStyleHints, setWireTagStyleHints] = useState<ReturnType<
    typeof extractPlanTagStyleHints
  > | null>(null);

  const elementsById = useBimStore((s) => s.elementsById);
  const selectedId = useBimStore((s) => s.selectedId);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const setPlanProjectionPrimitives = useBimStore((s) => s.setPlanProjectionPrimitives);
  const setPlanRoomSchemeWireReadout = useBimStore((s) => s.setPlanRoomSchemeWireReadout);
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

  const mergedGraphicHints = useMemo(() => {
    if (wireGraphicHints) return wireGraphicHints;
    return resolvePlanGraphicHints(elementsById, activePlanViewId);
  }, [wireGraphicHints, elementsById, activePlanViewId]);

  const mergedAnnotationHints = useMemo(() => {
    if (wireAnnotationHints !== null) return wireAnnotationHints;
    return resolvePlanAnnotationHints(elementsById, activePlanViewId);
  }, [wireAnnotationHints, elementsById, activePlanViewId]);

  const planTagFontScales = useMemo(() => {
    const pvId = display.planViewElementId;
    const ro = resolvePlanTagStyleLane(elementsById, pvId, 'opening');
    const rr = resolvePlanTagStyleLane(elementsById, pvId, 'room');
    const bo = wireTagStyleHints?.opening?.textSizePt;
    const br = wireTagStyleHints?.room?.textSizePt;
    const openingPt = typeof bo === 'number' && Number.isFinite(bo) ? bo : ro.textSizePt;
    const roomPt = typeof br === 'number' && Number.isFinite(br) ? br : rr.textSizePt;
    return { opening: openingPt / 10, room: roomPt / 10 };
  }, [wireTagStyleHints, elementsById, display.planViewElementId]);

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
        setPlanRoomSchemeWireReadout(null);
        setRoomColorLegend([]);
        setWireGraphicHints(null);
        setWireAnnotationHints(null);
        setWireTagStyleHints(null);
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
        const legendRows = extractRoomColorLegend(payload);
        setPlanProjectionPrimitives(extractPlanPrimitives(payload));
        setPlanRoomSchemeWireReadout({
          roomColorLegendRows: legendRows,
          programmeLegendEvidence: extractRoomProgrammeLegendEvidenceV0(payload),
          planCategoryGraphicHintsV0: extractPlanCategoryGraphicHintsV0(payload),
        });
        setRoomColorLegend(legendRows);
        setWireGraphicHints(extractPlanGraphicHints(payload));
        setWireAnnotationHints(extractPlanAnnotationHints(payload));
        setWireTagStyleHints(extractPlanTagStyleHints(payload));
      } catch {
        if (!cancel) setPlanProjectionPrimitives(null);
        if (!cancel) setPlanRoomSchemeWireReadout(null);
        if (!cancel) setRoomColorLegend([]);
        if (!cancel) setWireGraphicHints(null);
        if (!cancel) setWireAnnotationHints(null);
        if (!cancel) setWireTagStyleHints(null);
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
    setPlanRoomSchemeWireReadout,
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
    if (!cameraHandleRef) return;
    cameraHandleRef.current = {
      getSnapshot: () => ({
        centerMm: { xMm: camRef.current.camX * 1000, yMm: camRef.current.camZ * 1000 },
        halfMm: camRef.current.half * 1000,
      }),
      applySnapshot: (snap) => {
        if (snap.centerMm) {
          camRef.current.camX = (snap.centerMm.xMm ?? camRef.current.camX * 1000) / 1000;
          camRef.current.camZ = (snap.centerMm.yMm ?? camRef.current.camZ * 1000) / 1000;
        }
        if (snap.halfMm !== undefined) {
          camRef.current.half = snap.halfMm / 1000;
        }
        resizeCam();
      },
    };
    return () => {
      if (cameraHandleRef) cameraHandleRef.current = null;
    };
  }, [cameraHandleRef, resizeCam]);

  const handleFitToView = useCallback(() => {
    const grp = rootRef.current;
    const rnd = rendererRef.current;
    if (!grp || !rnd) return;
    const box = new THREE.Box3().setFromObject(grp);
    if (!Number.isFinite(box.min.x)) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const halfX = (box.max.x - box.min.x) / 2;
    const halfZ = (box.max.z - box.min.z) / 2;
    const asp = rnd.domElement.clientWidth / Math.max(1, rnd.domElement.clientHeight);
    const half = Math.max(halfX / asp, halfZ) * 1.15;
    camRef.current.camX = cx;
    camRef.current.camZ = cz;
    camRef.current.half = THREE.MathUtils.clamp(half, minZoomRef.current, 420);
    resizeCam();
    setShowZoomMenu(false);
  }, [resizeCam]);

  useEffect(() => {
    draftRef.current = undefined;
  }, [planTool]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setClearColor(readPlanToken('--draft-paper', '#0b1220'), 1);
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
    // `theme` triggers a renderer rebuild on light/dark toggle so paper/grid
    // tokens are re-read. Spec §32 V11.
  }, [resizeCam, theme]);

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
      planGraphicHints: mergedGraphicHints,
      planAnnotationHints: mergedAnnotationHints,
      planTagFontScales,
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
      new THREE.LineBasicMaterial({
        color: readPlanToken('--draft-grid-major', '#223042'),
        transparent: true,
        opacity: 0.35,
      }),
    );
    grid.userData.draftingGrid = true;
    grp.add(grid);
  }, [
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
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
        new THREE.LineBasicMaterial({
          color: readPlanToken('--draft-construction-blue', '#fcd34d'),
        }),
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
        new THREE.LineBasicMaterial({ color: readPlanToken('--cat-room', '#a7f3d0') }),
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
      const forcePan =
        (ev.buttons & 2) === 2 || (ev.buttons & 4) === 4 || ev.shiftKey || spaceDownRef.current;
      if (forcePan) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        dragRef.current = {
          dragging: true,
          lastXmm: rr.xMm,
          lastZmm: rr.yMm,
          camX: camRef.current.camX,
          camZ: camRef.current.camZ,
        };
      } else if (ev.button === 0 && planTool === 'select') {
        // LMB + select tool: pan when clicking empty space, let onClick handle element hits.
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
        const hasHit = hits.some(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        if (!hasHit) {
          const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
          if (rr) {
            dragRef.current = {
              dragging: true,
              lastXmm: rr.xMm,
              lastZmm: rr.yMm,
              camX: camRef.current.camX,
              camZ: camRef.current.camZ,
            };
          }
        }
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
      ev.preventDefault();
      const rect = rnd.domElement.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      const asp = rect.width / Math.max(1, rect.height);
      const norm = (d: number) =>
        ev.deltaMode === 1 ? d * 20 : ev.deltaMode === 2 ? d * 600 : d;
      const rawY = norm(ev.deltaY);
      const rawX = norm(ev.deltaX);

      if (ev.ctrlKey || ev.metaKey) {
        // Trackpad pinch — macOS sends ctrlKey+wheel. Use higher sensitivity
        // so the gesture feels 1-to-1 with finger spread/pinch.
        const oldHalf = camRef.current.half;
        const newHalf = THREE.MathUtils.clamp(
          oldHalf * Math.exp(rawY * 0.008),
          minZoomRef.current,
          420,
        );
        const dH = oldHalf - newHalf;
        camRef.current.half = newHalf;
        camRef.current.camX += ndcX * asp * dH;
        camRef.current.camZ -= ndcY * dH;
      } else {
        // Mouse wheel or two-finger trackpad scroll.
        // Y → zoom at ~30 % per mouse notch; X → pan so a sideways swipe
        // scrolls the canvas rather than accidentally zooming.
        const oldHalf = camRef.current.half;
        const newHalf = THREE.MathUtils.clamp(
          oldHalf * Math.exp(rawY * 0.003),
          minZoomRef.current,
          420,
        );
        const dH = oldHalf - newHalf;
        camRef.current.half = newHalf;
        camRef.current.camX += ndcX * asp * dH;
        camRef.current.camZ -= ndcY * dH;
        if (Math.abs(rawX) > 1) {
          // Horizontal two-finger swipe → pan X.
          const worldPerPx = (2 * oldHalf * asp) / Math.max(1, rect.width);
          camRef.current.camX += rawX * worldPerPx;
        }
      }
      resizeCam();
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
      }
      if (ev.code === 'Space') {
        ev.preventDefault();
        spaceDownRef.current = true;
      }
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        spaceDownRef.current = false;
        dragRef.current.dragging = false;
      }
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUpWindow);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUpWindow);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
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
  const zoomPresets = [
    { label: 'Close-up  2 m', half: 2 },
    { label: 'Room      5 m', half: 5 },
    { label: 'Floor    12 m', half: 12 },
    { label: 'Building 25 m', half: 25 },
    { label: 'Site     80 m', half: 80 },
  ] as const;
  return (
    <div
      data-testid="plan-canvas"
      className="relative h-full w-full overflow-hidden bg-background"
    >
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
              {roomColorLegend.map((row) => {
                const subtitle = [row.programmeCode, row.department, row.functionLabel]
                  .filter((x): x is string => Boolean(x && x.trim()))
                  .filter((x, i, a) => a.indexOf(x) === i)
                  .filter((x) => x !== row.label)
                  .join(' · ');
                return (
                  <li key={`${row.label}-${row.schemeColorHex}`} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-block size-3 shrink-0 rounded-sm border border-border"
                      style={{ backgroundColor: row.schemeColorHex }}
                      title={row.programmeCode ?? row.label}
                    />
                    <span className="leading-tight">
                      <span className="text-foreground">{row.label}</span>
                      {subtitle ? (
                        <span className="mt-0.5 block text-[9px] text-muted">{subtitle}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      {/* Zoom control — scale bar + preset menu */}
      <div className="pointer-events-auto absolute left-3 bottom-3 z-10">
        {showZoomMenu && (
          <div className="mb-1 flex flex-col overflow-hidden rounded border border-border bg-surface/95 shadow-md backdrop-blur">
            {zoomPresets.map(({ label, half }) => (
              <button
                key={label}
                type="button"
                className="px-3 py-1 text-left font-mono text-[10px] text-muted hover:bg-accent/20 hover:text-foreground"
                onClick={() => {
                  camRef.current.half = half;
                  resizeCam();
                  setShowZoomMenu(false);
                }}
              >
                {label}
              </button>
            ))}
            <div className="mx-2 border-t border-border" />
            <button
              type="button"
              className="px-3 py-1 text-left font-mono text-[10px] text-muted hover:bg-accent/20 hover:text-foreground"
              onClick={handleFitToView}
            >
              Fit to view
            </button>
          </div>
        )}
        <button
          type="button"
          title="Click for zoom presets · scroll to zoom · Space+drag to pan"
          className="flex items-center gap-1 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur hover:bg-surface hover:text-foreground"
          onClick={() => setShowZoomMenu((v) => !v)}
        >
          ━━━ {`${(sb * 100).toFixed(0)} cm`}
        </button>
      </div>
      <div ref={mountRef} className="size-full cursor-crosshair" />
    </div>
  );
}
