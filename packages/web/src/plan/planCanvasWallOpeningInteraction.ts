import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import {
  initialWallOpeningState,
  reduceWallOpening,
  type WallOpeningState,
} from '../tools/toolGrammar';

type MutableRef<T> = {
  current: T;
};

type MmPoint = {
  xMm: number;
  yMm: number;
};

export function handleWallOpeningPointerUp({
  planTool,
  pointerMm,
  wallOpeningStateRef,
  wallOpeningAnchorRef,
  elementsById,
  onSemanticCommand,
}: {
  planTool: PlanTool;
  pointerMm: MmPoint | null | undefined;
  wallOpeningStateRef: MutableRef<WallOpeningState>;
  wallOpeningAnchorRef: MutableRef<MmPoint | null>;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): boolean {
  if (
    planTool !== 'wall-opening' ||
    wallOpeningStateRef.current.phase !== 'define-rect' ||
    !wallOpeningAnchorRef.current
  ) {
    return false;
  }

  if (!pointerMm) return true;

  const { effect } = reduceWallOpening(wallOpeningStateRef.current, {
    kind: 'drag-end',
    cornerMm: pointerMm,
  });
  wallOpeningStateRef.current = initialWallOpeningState();
  wallOpeningAnchorRef.current = null;

  if (!effect.commitWallOpening) return true;
  const host = elementsById[effect.commitWallOpening.hostWallId];
  if (!host || host.kind !== 'wall') return true;

  const ax = host.start.xMm;
  const ay = host.start.yMm;
  const bx = host.end.xMm;
  const by = host.end.yMm;
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = Math.max(abx * abx + aby * aby, 1e-9);
  const project = (p: MmPoint) =>
    Math.max(0.0001, Math.min(0.9999, ((p.xMm - ax) * abx + (p.yMm - ay) * aby) / len2));
  const t0 = project(effect.commitWallOpening.anchorMm);
  const t1 = project(effect.commitWallOpening.cornerMm);
  const tStart = Math.min(t0, t1);
  const tEnd = Math.max(t0, t1);

  if (tEnd - tStart >= 0.005) {
    void onSemanticCommand({
      type: 'createWallOpening',
      hostWallId: effect.commitWallOpening.hostWallId,
      alongTStart: tStart,
      alongTEnd: tEnd,
      sillHeightMm: 200,
      headHeightMm: Math.min(host.heightMm - 100, 2400),
    });
  }

  return true;
}
