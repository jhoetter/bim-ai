import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import { orthoExtents, SLICE_Y } from './interaction/planCameraMath';
import type { Draft } from './planCanvasHelpers';
import { SnapEngine, type SnapCandidate } from './planCanvasState';
import { applySnapSettings, type SnapSettings, type ToggleableSnapKind } from './snapSettings';
import type { SegmentLine, SnapHit, SnapKind } from './snapEngine';
import { snapPlanCandidates } from './snapEngine';
import { initialSnapTabCycle, syncSnapTabCycle, type SnapTabCycleState } from './snapTabCycle';

type MutableRef<T> = {
  current: T;
};

type SnapGlyphState = {
  candidates: Array<{
    kind: SnapKind;
    pxX: number;
    pxY: number;
    extensionFromPxX?: number;
    extensionFromPxY?: number;
    associative?: boolean;
  }>;
  activeIndex: number;
};

type Props = {
  planTool: PlanTool;
  cursorMm: { xMm: number; yMm: number };
  renderer: THREE.WebGLRenderer;
  group: THREE.Group;
  cameraHalf: number;
  /**
   * Walls on the snap-eligible level. Pass `modelIndices.wallsByLevel[displayLevelId]`
   * (or the flat `modelIndices.walls` for the all-levels case). PERF-G04: avoids
   * the prior `Object.values(elementsById).filter(wall)` scan that ran on
   * every pointermove.
   */
  levelWalls: readonly Extract<Element, { kind: 'wall' }>[];
  snapEngineRef: MutableRef<SnapEngine>;
  snapIndicatorRef: MutableRef<THREE.Mesh | null>;
  setSnapLabel: (value: string | null) => void;
  lastSnapLinesRef: MutableRef<SegmentLine[]>;
  anchors: Array<{ xMm: number; yMm: number }>;
  centerAnchors: Array<{ xMm: number; yMm: number }>;
  draftRef: MutableRef<Draft | undefined>;
  orthoSnapHold: boolean;
  snapOverrideRef: MutableRef<ToggleableSnapKind | null>;
  snapSettings: SnapSettings;
  snapTabCycleRef: MutableRef<SnapTabCycleState>;
  lastSnapHitsRef: MutableRef<SnapHit[]>;
  setSnapGlyphState: (value: SnapGlyphState) => void;
  worldToScreen: (point: { xMm: number; yMm: number }) => { pxX: number; pxY: number };
};

function snapSettingsForOverride(
  activeOverride: ToggleableSnapKind | null,
  snapSettings: SnapSettings,
): SnapSettings {
  if (!activeOverride) return snapSettings;
  return {
    endpoint: activeOverride === 'endpoint',
    midpoint: activeOverride === 'midpoint',
    nearest: activeOverride === 'nearest',
    center: activeOverride === 'center',
    intersection: activeOverride === 'intersection',
    perpendicular: activeOverride === 'perpendicular',
    extension: activeOverride === 'extension',
    parallel: activeOverride === 'parallel',
    tangent: activeOverride === 'tangent',
    workplane: activeOverride === 'workplane',
    grid: activeOverride === 'grid',
  };
}

export function updatePlanCanvasSnapHover({
  planTool,
  cursorMm,
  renderer,
  group,
  cameraHalf,
  levelWalls,
  snapEngineRef,
  snapIndicatorRef,
  setSnapLabel,
  lastSnapLinesRef,
  anchors,
  centerAnchors,
  draftRef,
  orthoSnapHold,
  snapOverrideRef,
  snapSettings,
  snapTabCycleRef,
  lastSnapHitsRef,
  setSnapGlyphState,
  worldToScreen,
}: Props) {
  const isDrawing = planTool != null && planTool !== 'select' && planTool !== 'query';
  if (!isDrawing) {
    if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
    setSnapLabel(null);
    if (lastSnapHitsRef.current.length > 0) {
      lastSnapHitsRef.current = [];
      snapTabCycleRef.current = initialSnapTabCycle();
      setSnapGlyphState({ candidates: [], activeIndex: 0 });
    }
    return;
  }

  const pixH = renderer.domElement.clientHeight || 1;
  const toleranceMm = (12 / pixH) * 2 * cameraHalf * 1000;
  const candidates: SnapCandidate[] = [];
  for (const el of levelWalls) {
    if (Math.hypot(el.start.xMm - cursorMm.xMm, el.start.yMm - cursorMm.yMm) < toleranceMm) {
      candidates.push({ mode: 'endpoint', xMm: el.start.xMm, yMm: el.start.yMm });
    }
    if (Math.hypot(el.end.xMm - cursorMm.xMm, el.end.yMm - cursorMm.yMm) < toleranceMm) {
      candidates.push({ mode: 'endpoint', xMm: el.end.xMm, yMm: el.end.yMm });
    }
    const midXMm = (el.start.xMm + el.end.xMm) / 2;
    const midYMm = (el.start.yMm + el.end.yMm) / 2;
    if (Math.hypot(midXMm - cursorMm.xMm, midYMm - cursorMm.yMm) < toleranceMm) {
      candidates.push({ mode: 'midpoint', xMm: midXMm, yMm: midYMm });
    }
  }
  for (let i = 0; i < levelWalls.length; i++) {
    for (let j = i + 1; j < levelWalls.length; j++) {
      const a = levelWalls[i]!;
      const b = levelWalls[j]!;
      const ax = a.start.xMm;
      const az = a.start.yMm;
      const adx = a.end.xMm - ax;
      const adz = a.end.yMm - az;
      const bx = b.start.xMm;
      const bz = b.start.yMm;
      const bdx = b.end.xMm - bx;
      const bdz = b.end.yMm - bz;
      const denom = adx * bdz - adz * bdx;
      if (Math.abs(denom) < 1e-9) continue;
      const t = ((bx - ax) * bdz - (bz - az) * bdx) / denom;
      const u = ((bx - ax) * adz - (bz - az) * adx) / denom;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const ixMm = ax + adx * t;
      const iyMm = az + adz * t;
      if (Math.hypot(ixMm - cursorMm.xMm, iyMm - cursorMm.yMm) < toleranceMm) {
        candidates.push({ mode: 'intersection', xMm: ixMm, yMm: iyMm });
      }
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
      group.add(indicator);
    }
    snapIndicatorRef.current.position.set(snap.xMm / 1000, SLICE_Y + 0.01, snap.yMm / 1000);
    snapIndicatorRef.current.visible = true;
    setSnapLabel(snapEngineRef.current.pillLabel(snap));
  } else {
    if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
    setSnapLabel(null);
  }

  const linesScoped = lastSnapLinesRef.current;
  const extents = orthoExtents(cameraHalf);
  const allHits = snapPlanCandidates({
    cursor: cursorMm,
    anchors,
    gridStepMm: extents.stepMm,
    chainAnchor:
      draftRef.current?.kind === 'wall'
        ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
        : undefined,
    snapMm: extents.snapMm,
    orthoHold: orthoSnapHold,
    lines: linesScoped,
    centers: centerAnchors,
  });
  const filtered = applySnapSettings(
    allHits.filter((h) => h.kind !== 'raw'),
    snapSettingsForOverride(snapOverrideRef.current, snapSettings),
  );
  snapTabCycleRef.current = syncSnapTabCycle(snapTabCycleRef.current, filtered);
  lastSnapHitsRef.current = filtered;
  const glyphCandidates = filtered.map((h) => {
    const screen = worldToScreen(h.point);
    const out: {
      kind: SnapKind;
      pxX: number;
      pxY: number;
      extensionFromPxX?: number;
      extensionFromPxY?: number;
      associative?: boolean;
    } = {
      kind: h.kind,
      pxX: screen.pxX,
      pxY: screen.pxY,
      associative: h.kind !== 'raw' && h.kind !== 'grid',
    };
    if (h.kind === 'extension' && linesScoped.length > 0) {
      let best: { endpoint: { xMm: number; yMm: number } } | undefined;
      let bestD = Infinity;
      for (const line of linesScoped) {
        for (const endpt of [line.start, line.end]) {
          const d = (endpt.xMm - h.point.xMm) ** 2 + (endpt.yMm - h.point.yMm) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { endpoint: endpt };
          }
        }
      }
      if (best) {
        const fromPx = worldToScreen(best.endpoint);
        out.extensionFromPxX = fromPx.pxX;
        out.extensionFromPxY = fromPx.pxY;
      }
    }
    return out;
  });
  setSnapGlyphState({
    candidates: glyphCandidates,
    activeIndex: snapTabCycleRef.current.activeIndex,
  });
}
