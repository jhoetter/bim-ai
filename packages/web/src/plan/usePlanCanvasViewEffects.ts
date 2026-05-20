import { useEffect } from 'react';
import type * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import type { ColumnAtGridsState } from '../tools/toolGrammar';
import { clearColumnAtGridsOverlay, renderColumnAtGridsOverlay } from './planCanvasRenderPasses';

type MutableRef<T> = {
  current: T;
};

type Props = {
  rootRef: MutableRef<THREE.Group | null>;
  activePlanViewId: string | undefined;
  activeLevelResolvedId: string;
  elementsById: Record<string, Element>;
  planTool: PlanTool;
  columnAtGridsStateRef: MutableRef<ColumnAtGridsState>;
  columnAtGridsHoverRef: MutableRef<string | null>;
  geomEpoch: number;
  lastAutoFitLevelRef: MutableRef<string | null>;
  onFitToView: () => void;
};

export function usePlanCanvasViewEffects({
  rootRef,
  activePlanViewId,
  activeLevelResolvedId,
  elementsById,
  planTool,
  columnAtGridsStateRef,
  columnAtGridsHoverRef,
  geomEpoch,
  lastAutoFitLevelRef,
  onFitToView,
}: Props) {
  // §5.4.2 — apply planViewAngleDeg rotation to the root group when the active
  // plan view has a stored true-north rotation.
  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const angleDeg = pv?.kind === 'plan_view' ? (pv.planViewAngleDeg ?? 0) : 0;
    grp.rotation.y = (angleDeg * Math.PI) / 180;
  }, [activePlanViewId, elementsById, rootRef]);

  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;

    clearColumnAtGridsOverlay(grp);

    if (planTool !== 'column-at-grids') return;

    const state = columnAtGridsStateRef.current;
    if (state.phase !== 'selecting') return;

    renderColumnAtGridsOverlay(
      grp,
      elementsById,
      state.selectedGridIds,
      columnAtGridsHoverRef.current,
    );
  }, [columnAtGridsHoverRef, columnAtGridsStateRef, elementsById, geomEpoch, planTool, rootRef]);

  // Auto-fit camera when a level's elements first become available, and on
  // every level switch — so the model always fills the canvas on open.
  useEffect(() => {
    const lvl = activeLevelResolvedId;
    if (lastAutoFitLevelRef.current === lvl) return;
    const hasGeo = Object.values(elementsById).some(
      (el) =>
        (el.kind === 'wall' || el.kind === 'floor' || el.kind === 'room') &&
        'levelId' in el &&
        (el as { levelId?: string }).levelId === lvl,
    );
    if (!hasGeo) return;
    lastAutoFitLevelRef.current = lvl;
    onFitToView();
  }, [activeLevelResolvedId, elementsById, lastAutoFitLevelRef, onFitToView]);
}
