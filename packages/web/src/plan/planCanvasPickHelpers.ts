import type * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import type { CategoryOverride } from '../state/storeTypes';
import { snapPointToNearestWallFaceMm } from './SketchCanvasPickWalls';
import { areaPlanPlacementContext } from './areaPlacement';
import {
  dxfViewOverrideKey,
  queryDxfPrimitiveAtPoint,
  selectDxfUnderlaysForLevel,
} from './dxfUnderlay';
import type { Draft } from './planCanvasHelpers';
import type { PickedWallLine } from './wallPickLines';
import { pickDxfLineForWall, pickFloorBoundaryEdgeForWall } from './wallPickLines';

type MutableRef<T> = {
  current: T;
};

type Props = {
  renderer: THREE.WebGLRenderer;
  camRef: MutableRef<{ half: number }>;
  displayLevelId: string | undefined;
  activeLevelResolvedId: string;
  activePlanViewId: string | undefined;
  lvlId: string;
  elementsById: Record<string, Element>;
  draftRef: MutableRef<Draft | undefined>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  clearPreview: () => void;
  bumpGeom: (updater: (value: number) => number) => void;
};

export function createPlanCanvasPickHelpers({
  renderer,
  camRef,
  displayLevelId,
  activeLevelResolvedId,
  activePlanViewId,
  lvlId,
  elementsById,
  draftRef,
  onSemanticCommand,
  clearPreview,
  bumpGeom,
}: Props) {
  const activeAreaPlanContext = () =>
    areaPlanPlacementContext(elementsById, activePlanViewId, lvlId);

  const areaSnapPoint = (pointMm: { xMm: number; yMm: number }) => {
    const ctx = activeAreaPlanContext();
    if (!ctx) return pointMm;
    const wallsForAreaSnap = Object.values(elementsById)
      .filter(
        (el): el is Extract<Element, { kind: 'wall' }> =>
          el.kind === 'wall' && el.levelId === ctx.levelId,
      )
      .map((w) => ({
        id: w.id,
        startMm: { xMm: w.start.xMm, yMm: w.start.yMm },
        endMm: { xMm: w.end.xMm, yMm: w.end.yMm },
        thicknessMm: w.thicknessMm,
      }));
    return snapPointToNearestWallFaceMm(wallsForAreaSnap, pointMm) ?? pointMm;
  };

  const wallPickToleranceMm = () => {
    const rect = renderer.domElement.getBoundingClientRect();
    return Math.min(
      350,
      Math.max(120, (10 / Math.max(1, rect.height)) * 2 * camRef.current.half * 1000),
    );
  };

  const dxfHitAt = (pointMm: { xMm: number; yMm: number }, toleranceMm: number) => {
    const liveElementsById = useBimStore.getState().elementsById;
    const dxfLevelId = displayLevelId || activeLevelResolvedId;
    const dxfUnderlays = selectDxfUnderlaysForLevel(liveElementsById, dxfLevelId || undefined);
    if (dxfUnderlays.length === 0) return null;
    const activePlanView = activePlanViewId ? liveElementsById[activePlanViewId] : undefined;
    const viewOverrides =
      activePlanView?.kind === 'plan_view'
        ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
        : {};
    return queryDxfPrimitiveAtPoint(dxfUnderlays, pointMm, {
      toleranceMm,
      elementsById: liveElementsById,
      viewOverridesByLinkId: Object.fromEntries(
        dxfUnderlays.map((link) => [link.id, viewOverrides[dxfViewOverrideKey(link.id)]]),
      ),
    });
  };

  const pickedWallLineAt = (
    pointMm: { xMm: number; yMm: number },
    toleranceMm: number,
  ): PickedWallLine | null => {
    const liveElementsById = useBimStore.getState().elementsById;
    const pickLevelId = displayLevelId || activeLevelResolvedId || lvlId;
    return (
      pickFloorBoundaryEdgeForWall(liveElementsById, pickLevelId, pointMm, toleranceMm) ??
      pickDxfLineForWall(dxfHitAt(pointMm, toleranceMm), pointMm, liveElementsById)
    );
  };

  const commitAreaBoundary = (boundaryMm: Array<{ xMm: number; yMm: number }>) => {
    const ctx = activeAreaPlanContext();
    if (!ctx || !ctx.levelId || boundaryMm.length < 3) return false;
    onSemanticCommand({
      type: 'createArea',
      name: 'Area',
      levelId: ctx.levelId,
      boundaryMm,
      ruleSet: ctx.ruleSet,
      areaScheme: ctx.areaScheme,
      applyAreaRules: useBimStore.getState().applyAreaRules,
    });
    draftRef.current = undefined;
    clearPreview();
    bumpGeom((x) => x + 1);
    return true;
  };

  return {
    activeAreaPlanContext,
    areaSnapPoint,
    commitAreaBoundary,
    dxfHitAt,
    pickedWallLineAt,
    wallPickToleranceMm,
  };
}
