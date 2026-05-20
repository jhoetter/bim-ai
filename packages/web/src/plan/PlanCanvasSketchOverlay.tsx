import type { RefObject } from 'react';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';
import type { SketchElementKind } from './sketchApi';

type WallForSketchPicking = {
  id: string;
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  thicknessMm: number;
};

type Props = {
  planTool: PlanTool;
  modelId?: string | null;
  levelId?: string | null;
  activePlanViewId?: string | null;
  elementsById: Record<string, Element>;
  pointerToMmRef: RefObject<PointerToMm | null>;
  mmToScreenRef: RefObject<MmToScreen | null>;
  floorTypeId?: string | null;
  floorDrawOffsetMm: number;
  roofSlopeDeg: number;
  roofOverhangMm: number;
  onFinished: (createdId: string | null) => void;
  onCancelled: () => void;
};

function sketchElementKindForTool(planTool: PlanTool): SketchElementKind {
  if (planTool === 'roof-sketch') return 'roof';
  if (planTool === 'room-separation-sketch') return 'room_separation';
  if (planTool === 'masking-region') return 'masking_region';
  return 'floor';
}

function wallsForPicking(
  elementsById: Record<string, Element>,
  levelId: string | null | undefined,
): WallForSketchPicking[] {
  return Object.values(elementsById)
    .filter(
      (el): el is Extract<Element, { kind: 'wall' }> =>
        el.kind === 'wall' && (!levelId || el.levelId === levelId),
    )
    .map((w) => ({
      id: w.id,
      startMm: { xMm: w.start.xMm, yMm: w.start.yMm },
      endMm: { xMm: w.end.xMm, yMm: w.end.yMm },
      thicknessMm: w.thicknessMm,
    }));
}

function extraOptionsForSketch({
  planTool,
  activePlanViewId,
  floorDrawOffsetMm,
  roofSlopeDeg,
  roofOverhangMm,
}: Pick<
  Props,
  'planTool' | 'activePlanViewId' | 'floorDrawOffsetMm' | 'roofSlopeDeg' | 'roofOverhangMm'
>) {
  if (planTool === 'masking-region' && activePlanViewId) {
    return { hostViewId: activePlanViewId };
  }
  if (planTool === 'roof-sketch') {
    return {
      slopeDeg: roofSlopeDeg,
      overhangMm: roofOverhangMm,
    };
  }
  if (planTool === 'floor-sketch') {
    return { offsetMm: floorDrawOffsetMm || undefined };
  }
  return undefined;
}

export function PlanCanvasSketchOverlay({
  planTool,
  modelId,
  levelId,
  activePlanViewId,
  elementsById,
  pointerToMmRef,
  mmToScreenRef,
  floorTypeId,
  floorDrawOffsetMm,
  roofSlopeDeg,
  roofOverhangMm,
  onFinished,
  onCancelled,
}: Props) {
  if (
    !(
      planTool === 'floor-sketch' ||
      planTool === 'roof-sketch' ||
      planTool === 'room-separation-sketch' ||
      planTool === 'masking-region'
    ) ||
    !modelId ||
    !levelId
  ) {
    return null;
  }

  return (
    <SketchCanvas
      modelId={modelId}
      levelId={levelId}
      elementKind={sketchElementKindForTool(planTool)}
      pointerToMmRef={pointerToMmRef}
      mmToScreenRef={mmToScreenRef}
      wallsForPicking={wallsForPicking(elementsById, levelId)}
      floorTypeId={floorTypeId ?? undefined}
      extraOptions={extraOptionsForSketch({
        planTool,
        activePlanViewId,
        floorDrawOffsetMm,
        roofSlopeDeg,
        roofOverhangMm,
      })}
      onFinished={onFinished}
      onCancelled={onCancelled}
    />
  );
}
