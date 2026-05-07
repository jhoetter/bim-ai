import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialAlignState,
  initialSplitState,
  initialTrimState,
  initialWallJoinState,
  initialWallOpeningState,
  initialShaftState,
  reduceAlign,
  reduceSplit,
  reduceTrim,
  reduceWallJoin,
  reduceWallOpening,
  reduceShaft,
  type AlignState,
  type SplitState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
  type ShaftState,
  initialColumnState,
  reduceColumn,
  type ColumnState,
  initialBeamState,
  reduceBeam,
  type BeamState,
  initialCeilingState,
  reduceCeiling,
  type CeilingState,
} from '../tools/toolGrammar';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { useTheme } from '../state/useTheme';
import { liveTokenReader } from '../viewport/materials';
import { collectWallAnchors, snapPlanPoint } from './snapEngine';
import {
  classifyPointerStart,
  draftingPaintFor,
  PlanCamera,
  SnapEngine,
  type SnapCandidate,
} from './planCanvasState';
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
import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';
import { WallContextMenu, type WallContextMenuCommand } from '../workspace/WallContextMenu';
import { PlanDetailLevelToolbar } from './PlanDetailLevelToolbar';
import type { PlanDetailLevel } from './planDetailLevelLines';

function readPlanToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

const SLICE_Y = 0.02;

// B03 — spec 1:5–1:5000 plan scale bounds  half = plotScale * 500mm / 1000
const HALF_MIN = 2.5; // 1:5 (very close)
const HALF_MAX = 2500; // 1:5000 (very far)

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
  const marqueeLineRef = useRef<THREE.Line | null>(null);
  const dragRef = useRef({ dragging: false, lastXmm: 0, lastZmm: 0, camX: 0, camZ: 0 });
  const skipClickRef = useRef(false);
  const camRef = useRef({
    camX: initialCamera?.centerMm ? initialCamera.centerMm.xMm / 1000 : 0,
    camZ: initialCamera?.centerMm ? initialCamera.centerMm.yMm / 1000 : -2.8,
    half: initialCamera?.halfMm !== undefined ? initialCamera.halfMm / 1000 : 22,
  });
  const draftRef = useRef<Draft | undefined>(undefined);
  const alignStateRef = useRef<AlignState>(initialAlignState());
  const splitStateRef = useRef<SplitState>(initialSplitState());
  const trimStateRef = useRef<TrimState>(initialTrimState());
  const wallJoinStateRef = useRef<WallJoinState>(initialWallJoinState());
  const wallOpeningStateRef = useRef<WallOpeningState>(initialWallOpeningState());
  const wallOpeningAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const shaftStateRef = useRef<ShaftState>(initialShaftState());
  const columnStateRef = useRef<ColumnState>(initialColumnState());
  const beamStateRef = useRef<BeamState>(initialBeamState());
  const ceilingStateRef = useRef<CeilingState>(initialCeilingState());
  const marqueeRef = useRef<{
    active: boolean;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    direction: 'left-to-right' | 'right-to-left' | null;
  }>({ active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null });
  const spaceDownRef = useRef(false);
  const draftingRef = useRef<ReturnType<typeof draftingPaintFor> | null>(null);
  const lastPlotScaleRef = useRef<number>(0);
  const snapEngineRef = useRef(new SnapEngine());
  const snapIndicatorRef = useRef<THREE.Mesh | null>(null);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  const [hudMm, setHudMm] = useState<{ xMm: number; yMm: number }>();
  const [halfUi, setHalfUi] = useState(22);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  // ANN-02: state for the right-click "Generate Section / Elevation" menu.
  const [wallContextMenu, setWallContextMenu] = useState<{
    wall: Extract<Element, { kind: 'wall' }>;
    position: { x: number; y: number };
  } | null>(null);
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

  const elementsByIdRaw = useBimStore((s) => s.elementsById);
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  // VIE-04: drop elements that the active temporary-visibility override hides
  // before any downstream projection or hit-test sees them. View definitions
  // (plan_view, view_template, viewpoint, …) are never gated.
  const elementsById = useMemo(() => {
    if (temporaryVisibility === null) return elementsByIdRaw;
    const VIEW_DEF_KINDS = new Set<string>([
      'plan_view',
      'view_template',
      'viewpoint',
      'sheet',
      'schedule',
      'level',
      'project_settings',
      'callout',
    ]);
    const next: Record<string, Element> = {};
    for (const [id, el] of Object.entries(elementsByIdRaw)) {
      if (VIEW_DEF_KINDS.has(el.kind)) {
        next[id] = el;
        continue;
      }
      const inSet = temporaryVisibility.categories.includes(el.kind);
      const visible = temporaryVisibility.mode === 'isolate' ? inSet : !inSet;
      if (visible) next[id] = el;
    }
    return next;
  }, [elementsByIdRaw, temporaryVisibility]);
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
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const activateElevationView = useBimStore((s) => s.activateElevationView);
  const activatePlanView = useBimStore((s) => s.activatePlanView);

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

  // VIE-01: derive the active plan view's detail level + a setter that commits
  // updateElementProperty so the toolbar drives the same field the renderer
  // reads via mergedGraphicHints.
  const activeDetailLevel: PlanDetailLevel = (() => {
    const raw = mergedGraphicHints?.detailLevel;
    return raw === 'coarse' || raw === 'fine' ? raw : 'medium';
  })();

  const handleDetailLevelChange = useCallback(
    (next: PlanDetailLevel) => {
      if (!activePlanViewId) return;
      onSemanticCommand({
        type: 'updateElementProperty',
        elementId: activePlanViewId,
        key: 'planDetailLevel',
        value: next,
      });
    },
    [activePlanViewId, onSemanticCommand],
  );

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

  // B03 — empty-state detection: true when the active level has no elements on it
  const levelIsEmpty = useMemo(() => {
    const chkId = displayLevelId || activeLevelResolvedId;
    if (!chkId) return false;
    return !Object.values(elementsById).some(
      (e) => 'levelId' in e && (e as { levelId: string }).levelId === chkId,
    );
  }, [elementsById, displayLevelId, activeLevelResolvedId]);

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
    camRef.current.half = THREE.MathUtils.clamp(half, HALF_MIN, HALF_MAX);
    resizeCam();
    setShowZoomMenu(false);
  }, [resizeCam]);

  useEffect(() => {
    draftRef.current = undefined;
    alignStateRef.current = initialAlignState();
    splitStateRef.current = initialSplitState();
    trimStateRef.current = initialTrimState();
    wallJoinStateRef.current = initialWallJoinState();
    if (planTool === 'align') {
      const { state } = reduceAlign(alignStateRef.current, { kind: 'activate' });
      alignStateRef.current = state;
    } else if (planTool === 'split') {
      const { state } = reduceSplit(splitStateRef.current, { kind: 'activate' });
      splitStateRef.current = state;
    } else if (planTool === 'trim') {
      const { state } = reduceTrim(trimStateRef.current, { kind: 'activate' });
      trimStateRef.current = state;
    } else if (planTool === 'wall-join') {
      const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'activate' });
      wallJoinStateRef.current = state;
    } else if (planTool === 'wall-opening') {
      wallOpeningStateRef.current = initialWallOpeningState();
    } else if (planTool === 'shaft') {
      shaftStateRef.current = initialShaftState();
    } else if (planTool === 'column') {
      columnStateRef.current = initialColumnState();
    } else if (planTool === 'beam') {
      beamStateRef.current = initialBeamState();
    } else if (planTool === 'ceiling') {
      ceilingStateRef.current = initialCeilingState();
    }
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

    // B01 — compute plot scale and resolve drafting paint for this zoom level
    const worldHalfMm = camRef.current.half * 1000;
    const plotScale = worldHalfMm / 500;
    draftingRef.current = draftingPaintFor(plotScale);
    lastPlotScaleRef.current = plotScale;

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
      plotScale,
    });

    // B01 — apply hatch visibility per scale (no-op until hatch meshes are added)
    for (const ch of grp.children) {
      if (typeof (ch.userData as { hatchKind?: string }).hatchKind === 'string') {
        ch.visible = draftingRef.current.visibleHatches.some(
          (h) => h.kind === (ch.userData as { hatchKind: string }).hatchKind,
        );
      }
    }

    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { draftingGrid?: unknown }).draftingGrid) grp.remove(ch);
    }
    // B01 — major/minor grid driven by draftingPaintFor visibility flags (spec §14.5).
    const { showMajor, showMinor } = draftingRef.current?.grid ?? {
      showMajor: true,
      showMinor: false,
    };
    const span = camRef.current.half * 3.8;
    const minorStep = orthoExtents(camRef.current.half).stepMm / 1000;
    const majorStep = minorStep * 5;
    const addDraftGrid = (step: number, color: string, opacity: number) => {
      const gv: THREE.Vector3[] = [];
      for (let x = -span; x <= span; x += step) {
        gv.push(new THREE.Vector3(x, SLICE_Y, -span), new THREE.Vector3(x, SLICE_Y, span));
      }
      for (let z = -span; z <= span; z += step) {
        gv.push(new THREE.Vector3(-span, SLICE_Y, z), new THREE.Vector3(span, SLICE_Y, z));
      }
      if (!gv.length) return;
      const g = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(gv),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
      g.userData.draftingGrid = true;
      grp.add(g);
    };
    if (showMajor) addDraftGrid(majorStep, readPlanToken('--draft-grid-major', '#223042'), 0.45);
    if (showMinor) addDraftGrid(minorStep, readPlanToken('--draft-grid-minor', '#1a2738'), 0.25);
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

    const clearMarqueeLine = () => {
      if (marqueeLineRef.current) {
        grp.remove(marqueeLineRef.current);
        marqueeLineRef.current.geometry.dispose();
        marqueeLineRef.current = null;
      }
    };

    const redrawMarqueeRect = (
      x0Mm: number,
      y0Mm: number,
      x1Mm: number,
      y1Mm: number,
      crossing: boolean,
    ) => {
      clearMarqueeLine();
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
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = crossing
        ? new THREE.LineDashedMaterial({
            color: readPlanToken('--draft-construction-blue', '#fcd34d'),
            dashSize: 0.3,
            gapSize: 0.15,
          })
        : new THREE.LineBasicMaterial({
            color: readPlanToken('--draft-construction-blue', '#fcd34d'),
          });
      const line = new THREE.Line(geo, mat);
      if (crossing) line.computeLineDistances();
      marqueeLineRef.current = line;
      grp.add(line);
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
      if (marqueeRef.current.active) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (rr) {
          const dir = rr.xMm > marqueeRef.current.sx ? 'left-to-right' : 'right-to-left';
          marqueeRef.current.direction = dir;
          marqueeRef.current.ex = rr.xMm;
          marqueeRef.current.ey = rr.yMm;
          redrawMarqueeRect(
            marqueeRef.current.sx,
            marqueeRef.current.sy,
            rr.xMm,
            rr.yMm,
            dir === 'right-to-left',
          );
          skipClickRef.current = true;
        }
        return;
      }
      const v = snapped(ev.clientX, ev.clientY);
      if (!v) return;

      // B02 — snap candidates: endpoint, midpoint, and wall-wall intersection
      const isDrawing = planTool != null && planTool !== 'select';
      if (isDrawing) {
        const pixH = rnd.domElement.clientHeight || 1;
        const toleranceMm = (12 / pixH) * 2 * camRef.current.half * 1000;
        const candidates: SnapCandidate[] = [];
        const levelWalls = Object.values(elementsById).filter(
          (el): el is Extract<typeof el, { kind: 'wall' }> =>
            el.kind === 'wall' && (!displayLevelId || el.levelId === displayLevelId),
        );
        for (const el of levelWalls) {
          if (Math.hypot(el.start.xMm - v.xMm, el.start.yMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'endpoint', xMm: el.start.xMm, yMm: el.start.yMm });
          if (Math.hypot(el.end.xMm - v.xMm, el.end.yMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'endpoint', xMm: el.end.xMm, yMm: el.end.yMm });
          const midXMm = (el.start.xMm + el.end.xMm) / 2;
          const midYMm = (el.start.yMm + el.end.yMm) / 2;
          if (Math.hypot(midXMm - v.xMm, midYMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'midpoint', xMm: midXMm, yMm: midYMm });
        }
        // B02 — wall-wall intersection snaps (spec §14.3)
        for (let i = 0; i < levelWalls.length; i++) {
          for (let j = i + 1; j < levelWalls.length; j++) {
            const a = levelWalls[i]!;
            const b = levelWalls[j]!;
            const ax = a.start.xMm,
              az = a.start.yMm;
            const adx = a.end.xMm - ax,
              adz = a.end.yMm - az;
            const bx = b.start.xMm,
              bz = b.start.yMm;
            const bdx = b.end.xMm - bx,
              bdz = b.end.yMm - bz;
            const denom = adx * bdz - adz * bdx;
            if (Math.abs(denom) < 1e-9) continue;
            const t = ((bx - ax) * bdz - (bz - az) * bdx) / denom;
            const u = ((bx - ax) * adz - (bz - az) * adx) / denom;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const ixMm = ax + adx * t;
            const iyMm = az + adz * t;
            if (Math.hypot(ixMm - v.xMm, iyMm - v.yMm) < toleranceMm)
              candidates.push({ mode: 'intersection', xMm: ixMm, yMm: iyMm });
          }
        }
        const snap = snapEngineRef.current.resolve(candidates);
        if (snap) {
          if (!snapIndicatorRef.current) {
            const indicator = new THREE.Mesh(
              new THREE.TorusGeometry(0.05, 0.01, 8, 16),
              new THREE.MeshBasicMaterial({ color: 0xfcd34d }),
            );
            indicator.userData.snapIndicator = true;
            indicator.rotation.x = Math.PI / 2;
            snapIndicatorRef.current = indicator;
            grp.add(indicator);
          }
          snapIndicatorRef.current.position.set(snap.xMm / 1000, SLICE_Y + 0.01, snap.yMm / 1000);
          snapIndicatorRef.current.visible = true;
          setSnapLabel(snapEngineRef.current.pillLabel(snap));
        } else {
          if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
          setSnapLabel(null);
        }
      } else {
        if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
        setSnapLabel(null);
      }

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
      const intent = classifyPointerStart({
        button: ev.button,
        spacePressed: spaceDownRef.current,
        shiftKey: ev.shiftKey,
        altKey: ev.altKey,
        activeTool: planTool === 'select' ? 'select' : planTool ? 'wall' : undefined,
        dragDirection: null,
      });

      const startPan = () => {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        dragRef.current = {
          dragging: true,
          lastXmm: rr.xMm,
          lastZmm: rr.yMm,
          camX: camRef.current.camX,
          camZ: camRef.current.camZ,
        };
      };

      if (intent === 'pan' || ev.button === 2) {
        startPan();
      } else if (intent === 'drag-move' && planTool === 'select') {
        // LMB + select tool: pan on element hit, start marquee on empty space.
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
        if (hasHit) {
          startPan();
        } else {
          const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
          if (rr) {
            marqueeRef.current = {
              active: true,
              sx: rr.xMm,
              sy: rr.yMm,
              ex: rr.xMm,
              ey: rr.yMm,
              direction: null,
            };
          }
        }
      }
      skipClickRef.current = false;
    };

    const onUpWindow = (ev: PointerEvent) => {
      dragRef.current.dragging = false;
      if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
      setSnapLabel(null);

      if (marqueeRef.current.active && marqueeRef.current.direction) {
        const { sx, sy, ex, ey, direction } = marqueeRef.current;
        clearMarqueeLine();
        marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };

        const xMin = Math.min(sx, ex);
        const xMax = Math.max(sx, ex);
        const yMin = Math.min(sy, ey);
        const yMax = Math.max(sy, ey);
        const ids: string[] = [];
        for (const el of Object.values(elementsById)) {
          if (el.kind !== 'wall') continue;
          if (displayLevelId && el.levelId !== displayLevelId) continue;
          if (direction === 'left-to-right') {
            // Window: fully enclosed
            if (
              Math.min(el.start.xMm, el.end.xMm) >= xMin &&
              Math.max(el.start.xMm, el.end.xMm) <= xMax &&
              Math.min(el.start.yMm, el.end.yMm) >= yMin &&
              Math.max(el.start.yMm, el.end.yMm) <= yMax
            ) {
              ids.push(el.id);
            }
          } else {
            // Crossing: bbox intersects marquee
            const elXMin = Math.min(el.start.xMm, el.end.xMm);
            const elXMax = Math.max(el.start.xMm, el.end.xMm);
            const elYMin = Math.min(el.start.yMm, el.end.yMm);
            const elYMax = Math.max(el.start.yMm, el.end.yMm);
            if (elXMax >= xMin && elXMin <= xMax && elYMax >= yMin && elYMin <= yMax) {
              ids.push(el.id);
            }
          }
        }
        if (ids.length > 0) selectEl(ids[0]);
        return;
      }
      clearMarqueeLine();
      marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };
      if (
        planTool === 'wall-opening' &&
        wallOpeningStateRef.current.phase === 'define-rect' &&
        wallOpeningAnchorRef.current
      ) {
        const sp = snapped(ev.clientX, ev.clientY);
        if (sp) {
          const { effect } = reduceWallOpening(wallOpeningStateRef.current, {
            kind: 'drag-end',
            cornerMm: sp,
          });
          wallOpeningStateRef.current = initialWallOpeningState();
          wallOpeningAnchorRef.current = null;
          if (effect.commitWallOpening) {
            console.warn('stub: wall-opening command not implemented', effect.commitWallOpening);
          }
        }
      }
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
        // B02 — classifyPointerStart add-to-selection intent: Shift+Click toggles
        const clickIntent = classifyPointerStart({
          button: ev.button,
          shiftKey: ev.shiftKey,
          altKey: ev.altKey,
          activeTool: 'select',
          dragDirection: null,
        });
        if (clickIntent === 'add-to-selection') {
          const currentSel = useBimStore.getState().selectedId;
          selectEl(id === currentSel ? undefined : id);
        } else {
          selectEl(id);
        }
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
      if (planTool === 'elevation') {
        // VIE-03: drop an elevation marker. Auto-orient toward the nearest
        // exterior wall when one is reasonably close; otherwise default to
        // 'north'.
        const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
        const params =
          n && n.distMm < 5000
            ? elevationFromWall(n.wall)
            : {
                direction: 'north' as const,
                customAngleDeg: null as number | null,
                cropMinMm: { xMm: sp.xMm - 4000, yMm: sp.yMm - 4000 },
                cropMaxMm: { xMm: sp.xMm + 4000, yMm: sp.yMm + 4000 },
                name: 'North Elevation',
              };
        const cmd: Record<string, unknown> = {
          type: 'createElevationView',
          name: params.name,
          direction: params.direction,
          cropMinMm: params.cropMinMm,
          cropMaxMm: params.cropMaxMm,
        };
        if (params.direction === 'custom' && params.customAngleDeg !== null) {
          cmd.customAngleDeg = params.customAngleDeg;
        }
        onSemanticCommand(cmd);
        return;
      }
      if (planTool === 'align') {
        const { state: nextState, effect } = reduceAlign(alignStateRef.current, {
          kind: 'click',
          pointMm: sp,
        });
        alignStateRef.current = nextState;
        if (effect.commitAlign) {
          console.warn('stub: alignElement not implemented', effect.commitAlign);
        }
        return;
      }
      if (planTool === 'split') {
        const { state: nextState, effect } = reduceSplit(splitStateRef.current, {
          kind: 'click',
          pointMm: sp,
        });
        splitStateRef.current = nextState;
        if (effect.commitSplit) {
          const nearest = nearestWallAt(
            elementsById,
            displayLevelId || undefined,
            effect.commitSplit.pointMm.xMm,
            effect.commitSplit.pointMm.yMm,
          );
          if (nearest && nearest.distMm < 900) {
            console.warn('stub: splitWall not implemented', {
              wallId: nearest.wall.id,
              alongT: nearest.alongT,
            });
          }
        }
        return;
      }
      if (planTool === 'trim') {
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
        const hitEl = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const elementId =
          typeof (hitEl?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (hitEl!.object.userData as { bimPickId: string }).bimPickId
            : undefined;

        if (trimStateRef.current.phase === 'pick-reference') {
          if (elementId) {
            const { state: nextState } = reduceTrim(trimStateRef.current, {
              kind: 'click-reference',
              elementId,
            });
            trimStateRef.current = nextState;
          }
        } else {
          if (elementId) {
            const refEl = elementId
              ? elementsById[trimStateRef.current.referenceId ?? '']
              : undefined;
            const endHint: 'start' | 'end' = (() => {
              const target = elementsById[elementId];
              if (!target || target.kind !== 'wall') return 'start';
              const dStart = Math.hypot(sp.xMm - target.start.xMm, sp.yMm - target.start.yMm);
              const dEnd = Math.hypot(sp.xMm - target.end.xMm, sp.yMm - target.end.yMm);
              return dStart < dEnd ? 'start' : 'end';
            })();
            void refEl;
            const { state: nextState, effect } = reduceTrim(trimStateRef.current, {
              kind: 'click-target',
              elementId,
              endHint,
            });
            trimStateRef.current = nextState;
            if (effect.commitTrim) {
              console.warn('stub: trimElement not implemented', effect.commitTrim);
            }
          }
        }
        return;
      }
      if (planTool === 'wall-join') {
        const rect = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
        const threshMm = 12 * worldPerPxMm;
        let bestCorner: { xMm: number; yMm: number } | null = null;
        let bestDist = Infinity;
        for (const el of Object.values(elementsById)) {
          if (el.kind !== 'wall') continue;
          for (const pt of [el.start, el.end]) {
            const d = Math.hypot(sp.xMm - pt.xMm, sp.yMm - pt.yMm);
            if (d < bestDist) {
              bestDist = d;
              bestCorner = pt;
            }
          }
        }
        if (bestCorner && bestDist <= threshMm) {
          const cornerWallIds: string[] = [];
          for (const el of Object.values(elementsById)) {
            if (el.kind !== 'wall') continue;
            if (
              Math.hypot(bestCorner.xMm - el.start.xMm, bestCorner.yMm - el.start.yMm) < 1 ||
              Math.hypot(bestCorner.xMm - el.end.xMm, bestCorner.yMm - el.end.yMm) < 1
            ) {
              cornerWallIds.push(el.id);
            }
          }
          const { state } = reduceWallJoin(wallJoinStateRef.current, {
            kind: 'click-corner',
            cornerMm: bestCorner,
            wallIds: cornerWallIds,
          });
          wallJoinStateRef.current = state;
        }
        return;
      }
      if (planTool === 'wall-opening') {
        if (wallOpeningStateRef.current.phase === 'pick-wall') {
          // Find nearest wall
          const rect = rnd.domElement.getBoundingClientRect();
          const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
          const threshMm = 12 * worldPerPxMm;
          let bestWall: string | null = null;
          let bestDist = Infinity;
          for (const el of Object.values(elementsById)) {
            if (el.kind !== 'wall') continue;
            const mx = (el.start.xMm + el.end.xMm) / 2;
            const mz = (el.start.yMm + el.end.yMm) / 2;
            const d = Math.hypot(sp.xMm - mx, sp.yMm - mz);
            if (d < bestDist) {
              bestDist = d;
              bestWall = el.id;
            }
          }
          if (bestWall && bestDist <= threshMm * 8) {
            const { state } = reduceWallOpening(wallOpeningStateRef.current, {
              kind: 'click-wall',
              wallId: bestWall,
              pointMm: sp,
            });
            wallOpeningStateRef.current = state;
            wallOpeningAnchorRef.current = sp;
          }
        }
        return;
      }
      if (planTool === 'shaft') {
        const fst = shaftStateRef.current.verticesMm[0];
        const rect2 = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm2 = (2 * camRef.current.half * 1000) / Math.max(1, rect2.width);
        const threshMm2 = 12 * worldPerPxMm2;
        if (
          fst &&
          shaftStateRef.current.verticesMm.length >= 3 &&
          Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm2
        ) {
          const { effect } = reduceShaft(shaftStateRef.current, { kind: 'close-loop' });
          shaftStateRef.current = initialShaftState();
          if (effect.commitShaft) {
            console.warn('stub: shaft command not implemented', effect.commitShaft);
          }
        } else {
          const { state } = reduceShaft(shaftStateRef.current, { kind: 'click', pointMm: sp });
          shaftStateRef.current = state;
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'column') {
        const { effect } = reduceColumn(columnStateRef.current, { kind: 'click', pointMm: sp });
        columnStateRef.current = initialColumnState();
        if (effect.commitColumn) {
          console.warn('stub: column placement not implemented', effect.commitColumn);
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'beam') {
        const { state, effect } = reduceBeam(beamStateRef.current, { kind: 'click', pointMm: sp });
        beamStateRef.current = state;
        if (effect.commitBeam) {
          console.warn('stub: beam placement not implemented', effect.commitBeam);
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'ceiling') {
        const rect = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
        const threshMm = 12 * worldPerPxMm;
        const fst =
          ceilingStateRef.current.phase === 'sketch'
            ? ceilingStateRef.current.verticesMm[0]
            : undefined;
        if (
          fst &&
          (ceilingStateRef.current as { verticesMm: unknown[] }).verticesMm.length >= 3 &&
          Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm
        ) {
          const { effect } = reduceCeiling(ceilingStateRef.current, { kind: 'close-loop' });
          ceilingStateRef.current = initialCeilingState();
          if (effect.commitCeiling) {
            console.warn('stub: ceiling command not implemented', effect.commitCeiling);
          }
        } else {
          const { state } = reduceCeiling(ceilingStateRef.current, { kind: 'click', pointMm: sp });
          ceilingStateRef.current = state;
        }
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
      const norm = (d: number) => (ev.deltaMode === 1 ? d * 20 : ev.deltaMode === 2 ? d * 600 : d);
      const rawY = norm(ev.deltaY);
      const rawX = norm(ev.deltaX);

      if (ev.ctrlKey || ev.metaKey) {
        // Trackpad pinch — macOS sends ctrlKey+wheel. Use higher sensitivity
        // so the gesture feels 1-to-1 with finger spread/pinch.
        const oldHalf = camRef.current.half;
        const newHalf = THREE.MathUtils.clamp(oldHalf * Math.exp(rawY * 0.008), HALF_MIN, HALF_MAX);
        const dH = oldHalf - newHalf;
        camRef.current.half = newHalf;
        camRef.current.camX += ndcX * asp * dH;
        camRef.current.camZ -= ndcY * dH;
      } else {
        // Mouse wheel or two-finger trackpad scroll.
        // Y → zoom at ~30 % per mouse notch; X → pan so a sideways swipe
        // scrolls the canvas rather than accidentally zooming.
        const oldHalf = camRef.current.half;
        const newHalf = THREE.MathUtils.clamp(oldHalf * Math.exp(rawY * 0.003), HALF_MIN, HALF_MAX);
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
      // B01 — rebuild meshes when zoom crosses a 20% threshold so line weights update
      const newPlotScale = (camRef.current.half * 1000) / 500;
      if (
        lastPlotScaleRef.current > 0 &&
        Math.abs(newPlotScale - lastPlotScaleRef.current) / lastPlotScaleRef.current > 0.2
      ) {
        bumpGeom((x) => x + 1);
      }
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        draftRef.current = undefined;
        if (planTool === 'align') {
          const { state } = reduceAlign(alignStateRef.current, { kind: 'cancel' });
          alignStateRef.current = state;
        } else if (planTool === 'split') {
          const { state } = reduceSplit(splitStateRef.current, { kind: 'cancel' });
          splitStateRef.current = state;
        } else if (planTool === 'trim') {
          const { state } = reduceTrim(trimStateRef.current, { kind: 'cancel' });
          trimStateRef.current = state;
        } else if (planTool === 'wall-join') {
          const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cancel' });
          wallJoinStateRef.current = state;
        } else if (planTool === 'wall-opening') {
          wallOpeningStateRef.current = initialWallOpeningState();
          wallOpeningAnchorRef.current = null;
        } else if (planTool === 'shaft') {
          shaftStateRef.current = initialShaftState();
        } else if (planTool === 'column') {
          columnStateRef.current = initialColumnState();
        } else if (planTool === 'beam') {
          beamStateRef.current = initialBeamState();
        } else if (planTool === 'ceiling') {
          ceilingStateRef.current = initialCeilingState();
        }
        clearMarqueeLine();
        marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };
        bumpGeom((x) => x + 1);
      }
      if (planTool === 'wall-join' && wallJoinStateRef.current.phase === 'selected') {
        if (ev.key === 'n' || ev.key === 'N') {
          const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cycle' });
          wallJoinStateRef.current = state;
        } else if (ev.key === 'Enter') {
          const { state, effect } = reduceWallJoin(wallJoinStateRef.current, { kind: 'accept' });
          wallJoinStateRef.current = state;
          if (effect.commitJoin) {
            console.warn('stub: wall-join command not implemented', effect.commitJoin);
          }
        }
      }
      // B03 — PageUp/PageDown level cycling via PlanCamera.cycleLevel (spec §14.6)
      if (ev.key === 'PageUp' || ev.key === 'PageDown') {
        ev.preventDefault();
        const st = useBimStore.getState();
        const lvls = Object.values(st.elementsById)
          .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
          .sort((a, b) => a.elevationMm - b.elevationMm);
        const order = lvls.map((l) => l.id);
        if (!order.length) return;
        const curId = displayLevelId || activeLevelResolvedId || order[0]!;
        const cam = new PlanCamera(
          { plotScale: 1, centerMm: { xMm: 0, yMm: 0 }, activeLevelId: curId },
          order,
        );
        const nextId = cam.cycleLevel(ev.key === 'PageUp' ? 'up' : 'down');
        st.setActiveLevelId(nextId);
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

    // ANN-02: right-click on a wall opens a context menu with
    // "Generate Section Cut" / "Generate Elevation".
    const onContextMenu = (ev: MouseEvent) => {
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
      if (!h) {
        setWallContextMenu(null);
        return;
      }
      const id = (h.object.userData as { bimPickId: string }).bimPickId;
      const el = elementsById[id];
      if (!el || el.kind !== 'wall') {
        setWallContextMenu(null);
        return;
      }
      ev.preventDefault();
      setWallContextMenu({ wall: el, position: { x: ev.clientX, y: ev.clientY } });
    };

    // VIE-03: double-click an elevation marker (or plan_view marker) to open
    // the corresponding view. Looks up bimPickId via raycast, then routes to
    // the right activation action based on element kind.
    const onDblClick = (ev: MouseEvent) => {
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
      if (!h) return;
      const id = (h.object.userData as { bimPickId: string }).bimPickId;
      const el = elementsById[id];
      if (!el) return;
      if (el.kind === 'elevation_view') {
        activateElevationView(id);
      } else if (el.kind === 'plan_view') {
        activatePlanView(id);
      }
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUpWindow);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUpWindow);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      if (snapIndicatorRef.current) {
        grp.remove(snapIndicatorRef.current);
        snapIndicatorRef.current.geometry.dispose();
        snapIndicatorRef.current = null;
      }
    };
  }, [
    anchors,
    bumpGeom,
    displayLevelId,
    elementsById,
    lvlId,
    activeLevelResolvedId,
    onSemanticCommand,
    orthoSnapHold,
    planTool,
    resizeCam,
    selectEl,
    setActiveLevelId,
    activateElevationView,
    activatePlanView,
  ]);

  const sb = THREE.MathUtils.clamp(halfUi * 0.25, 0.2, 6);
  const zoomPresets = [
    { label: 'Close-up  2 m', half: 2 },
    { label: 'Room      5 m', half: 5 },
    { label: 'Floor    12 m', half: 12 },
    { label: 'Building 25 m', half: 25 },
    { label: 'Site     80 m', half: 80 },
  ] as const;
  const handleWallContextMenuCommand = useCallback(
    (next: WallContextMenuCommand) => {
      onSemanticCommand(next.cmd);
      if (next.kind === 'elevation_view') {
        // Activate the new elevation marker so the user lands on its view.
        activateElevationView(next.elevationViewId);
      } else {
        // Section cuts surface in the project browser; selecting puts focus on
        // the new element so the user can immediately tweak it.
        selectEl(next.sectionCutId);
      }
    },
    [activateElevationView, onSemanticCommand, selectEl],
  );

  return (
    <div data-testid="plan-canvas" className="relative h-full w-full overflow-hidden bg-background">
      {wallContextMenu && (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={handleWallContextMenuCommand}
          onClose={() => setWallContextMenu(null)}
        />
      )}
      <div className="pointer-events-none absolute right-3 bottom-14 z-10 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
        {hudMm
          ? `X ${(hudMm.xMm / 1000).toFixed(2)} m · Y ${(hudMm.yMm / 1000).toFixed(2)} m`
          : '—'}
      </div>
      {snapLabel && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-surface/90 px-2 py-0.5 font-mono text-[10px] text-foreground backdrop-blur">
          {snapLabel}
        </div>
      )}
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
      {/* B03 — empty-state overlay (spec §14.7): shown when the active level has no elements */}
      {levelIsEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
          <p className="font-medium text-foreground text-sm">This level is empty.</p>
          <p className="text-muted text-xs">
            Press W to draw a wall, or insert the seed house from the Project menu.
          </p>
          <p className="text-muted text-[10px] mt-1">Use PageUp / PageDown to switch levels.</p>
        </div>
      )}
      {/* VIE-01 — Coarse / Medium / Fine selector (matches Revit's View
          Control Bar position at the bottom of the plan canvas). Hidden when
          no plan_view is active so the toolbar doesn't dispatch dead commands. */}
      {activePlanViewId ? (
        <div className="pointer-events-auto absolute left-1/2 bottom-3 z-10 -translate-x-1/2">
          <PlanDetailLevelToolbar value={activeDetailLevel} onChange={handleDetailLevelChange} />
        </div>
      ) : null}
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
