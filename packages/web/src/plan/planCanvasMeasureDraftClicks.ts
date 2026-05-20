import type { PlanTool } from '../state/store';
import {
  reduceMeasureAngle,
  reduceMeasureArc,
  type MeasureAngleState,
  type MeasureArcState,
} from '../tools/toolGrammar';
import { guessGridLabel, type Draft } from './planCanvasHelpers';

type MutableRef<T> = {
  current: T;
};

type MmPoint = {
  xMm: number;
  yMm: number;
};

export function handleMeasureDraftClick({
  planTool,
  pointMm,
  levelId,
  draftRef,
  measureAngleStateRef,
  measureArcStateRef,
  setMeasureReadout,
  setMeasureAngleReadout,
  setMeasureArcReadout,
  onSemanticCommand,
  clearPreview,
  bumpGeom,
}: {
  planTool: PlanTool;
  pointMm: MmPoint;
  levelId: string;
  draftRef: MutableRef<Draft | undefined>;
  measureAngleStateRef: MutableRef<MeasureAngleState>;
  measureArcStateRef: MutableRef<MeasureArcState>;
  setMeasureReadout: (value: { distMm: number } | null) => void;
  setMeasureAngleReadout: (value: { angleDeg: number } | null) => void;
  setMeasureArcReadout: (value: { arcLengthMm: number; radiusMm: number } | null) => void;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  clearPreview: () => void;
  bumpGeom: (updater: (value: number) => number) => void;
}): boolean {
  if (planTool === 'room_rectangle') {
    const dr = draftRef.current;
    if (!dr || dr.kind !== 'room_rect') {
      draftRef.current = { kind: 'room_rect', sx: pointMm.xMm, sy: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    const ox = Math.min(dr.sx, pointMm.xMm);
    const oy = Math.min(dr.sy, pointMm.yMm);
    const widthMm = Math.abs(pointMm.xMm - dr.sx);
    const depthMm = Math.abs(pointMm.yMm - dr.sy);
    if (widthMm < 200 || depthMm < 200) {
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return true;
    }
    void onSemanticCommand({
      type: 'createRoomRectangle',
      levelId,
      origin: { xMm: ox, yMm: oy },
      widthMm,
      depthMm,
    });
    draftRef.current = undefined;
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'grid') {
    const d = draftRef.current;
    if (!d || d.kind !== 'grid') {
      draftRef.current = { kind: 'grid', sx: pointMm.xMm, sy: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    void onSemanticCommand({
      type: 'createGridLine',
      label: guessGridLabel(d.sx, d.sy, pointMm.xMm, pointMm.yMm),
      levelId,
      start: { xMm: d.sx, yMm: d.sy },
      end: { xMm: pointMm.xMm, yMm: pointMm.yMm },
    });
    draftRef.current = undefined;
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'measure') {
    const d = draftRef.current;
    if (!d || d.kind !== 'measure') {
      draftRef.current = { kind: 'measure', ax: pointMm.xMm, ay: pointMm.yMm };
      bumpGeom((x) => x + 1);
      return true;
    }
    const distMm = Math.hypot(pointMm.xMm - d.ax, pointMm.yMm - d.ay);
    setMeasureReadout({ distMm });
    draftRef.current = undefined;
    clearPreview();
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'measure-angle') {
    measureAngleStateRef.current = reduceMeasureAngle(measureAngleStateRef.current, {
      type: 'click',
      positionMm: { xMm: pointMm.xMm, yMm: pointMm.yMm },
    });
    if (
      measureAngleStateRef.current.status === 'complete' &&
      measureAngleStateRef.current.angleDeg != null
    ) {
      setMeasureAngleReadout({ angleDeg: measureAngleStateRef.current.angleDeg });
    }
    bumpGeom((x) => x + 1);
    return true;
  }

  if (planTool === 'measure-arc') {
    measureArcStateRef.current = reduceMeasureArc(measureArcStateRef.current, {
      type: 'click',
      positionMm: { xMm: pointMm.xMm, yMm: pointMm.yMm },
    });
    const arcState = measureArcStateRef.current;
    if (
      arcState.status === 'complete' &&
      arcState.arcLengthMm != null &&
      arcState.radiusMm != null
    ) {
      setMeasureArcReadout({ arcLengthMm: arcState.arcLengthMm, radiusMm: arcState.radiusMm });
    }
    bumpGeom((x) => x + 1);
    return true;
  }

  return false;
}
