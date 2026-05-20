import type { PlanTool } from '../state/store';
import { areaBoundaryRectangleFromDiagonal, reduceAreaBoundary } from '../tools/toolGrammar';
import type { Draft } from './planCanvasHelpers';

type MutableRef<T> = {
  current: T;
};

type MmPoint = {
  xMm: number;
  yMm: number;
};

type PendingPlanRegion = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  lvlId: string;
  cutPlaneDraft: string;
};

export function handleBoundaryToolClick({
  planTool,
  pointMm,
  areaClickMm,
  shiftKey,
  levelId,
  draftRef,
  hasActiveAreaPlanContext,
  areaSnapPoint,
  findAreaBoundaryForClick,
  commitAreaBoundary,
  redrawAreaBoundaryPreviewMm,
  setPendingPlanRegion,
  selectElement,
  onSemanticCommand,
  clearPreview,
  bumpGeom,
}: {
  planTool: PlanTool;
  pointMm: MmPoint;
  areaClickMm: MmPoint;
  shiftKey: boolean;
  levelId: string | null | undefined;
  draftRef: MutableRef<Draft | undefined>;
  hasActiveAreaPlanContext: () => boolean;
  areaSnapPoint: (pointMm: MmPoint) => MmPoint;
  findAreaBoundaryForClick: (pointMm: MmPoint) => { existingAreaId: string } | null;
  commitAreaBoundary: (boundaryMm: MmPoint[]) => void;
  redrawAreaBoundaryPreviewMm: (pointsMm: MmPoint[]) => void;
  setPendingPlanRegion: (region: PendingPlanRegion | null) => void;
  selectElement: (id: string | undefined) => void;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  clearPreview: () => void;
  bumpGeom: (updater: (value: number) => number) => void;
}): boolean {
  if (planTool === 'reference-plane') {
    const d = draftRef.current;
    if (!d || d.kind !== 'reference-plane') {
      draftRef.current = { kind: 'reference-plane', sx: pointMm.xMm, sy: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    if (!levelId || Math.hypot(pointMm.xMm - d.sx, pointMm.yMm - d.sy) < 1) {
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return true;
    }
    void onSemanticCommand({
      type: 'createReferencePlane',
      levelId,
      startMm: { xMm: d.sx, yMm: d.sy },
      endMm: { xMm: pointMm.xMm, yMm: pointMm.yMm },
    });
    draftRef.current = undefined;
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'property-line') {
    const d = draftRef.current;
    if (!d || d.kind !== 'property-line') {
      draftRef.current = { kind: 'property-line', sx: pointMm.xMm, sy: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    if (Math.hypot(pointMm.xMm - d.sx, pointMm.yMm - d.sy) < 1) {
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return true;
    }
    void onSemanticCommand({
      type: 'createPropertyLine',
      startMm: { xMm: d.sx, yMm: d.sy },
      endMm: { xMm: pointMm.xMm, yMm: pointMm.yMm },
    });
    draftRef.current = undefined;
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'area') {
    if (!hasActiveAreaPlanContext()) {
      draftRef.current = undefined;
      clearPreview();
      bumpGeom((x) => x + 1);
      return true;
    }
    const boundary = findAreaBoundaryForClick(areaClickMm);
    if (!boundary) {
      draftRef.current = undefined;
      clearPreview();
      bumpGeom((x) => x + 1);
      return true;
    }
    selectElement(boundary.existingAreaId);
    draftRef.current = undefined;
    clearPreview();
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'area-boundary') {
    if (!hasActiveAreaPlanContext()) {
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return true;
    }
    const areaPt = areaSnapPoint(pointMm);
    const d = draftRef.current;
    if (!d || d.kind !== 'area-boundary') {
      draftRef.current = { kind: 'area-boundary', verts: [areaPt] };
      redrawAreaBoundaryPreviewMm([areaPt]);
      bumpGeom((x) => x + 1);
      return true;
    }
    if (d.verts.length === 1 && shiftKey) {
      const rectBoundary = areaBoundaryRectangleFromDiagonal(d.verts[0]!, areaPt);
      if (rectBoundary) {
        commitAreaBoundary(rectBoundary);
      } else {
        draftRef.current = undefined;
        clearPreview();
        bumpGeom((x) => x + 1);
      }
      return true;
    }
    const reduced = reduceAreaBoundary(
      { verticesMm: d.verts },
      {
        kind: 'click',
        pointMm: areaPt,
      },
    );
    if (reduced.effect.commitBoundaryMm) {
      commitAreaBoundary(reduced.effect.commitBoundaryMm);
      return true;
    }
    draftRef.current = { kind: 'area-boundary', verts: reduced.state.verticesMm };
    redrawAreaBoundaryPreviewMm(reduced.state.verticesMm);
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'plan-region') {
    const d = draftRef.current;
    if (!d || d.kind !== 'plan-region') {
      draftRef.current = { kind: 'plan-region', sx: pointMm.xMm, sy: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    if (Math.hypot(pointMm.xMm - d.sx, pointMm.yMm - d.sy) < 1 || !levelId) {
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return true;
    }
    const x0 = Math.min(d.sx, pointMm.xMm);
    const x1 = Math.max(d.sx, pointMm.xMm);
    const y0 = Math.min(d.sy, pointMm.yMm);
    const y1 = Math.max(d.sy, pointMm.yMm);
    setPendingPlanRegion({ x0, x1, y0, y1, lvlId: levelId, cutPlaneDraft: '900' });
    draftRef.current = undefined;
    bumpGeom((x) => x + 1);
    return true;
  }

  return false;
}
