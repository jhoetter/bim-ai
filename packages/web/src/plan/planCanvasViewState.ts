import { useMemo } from 'react';
import type { Element } from '@bim-ai/core';

type PlanCanvasViewStateInput = {
  activePlanViewId?: string | null;
  elementsById: Record<string, Element>;
  levelId: string;
  displayLevelId?: string | null;
  activeLevelResolvedId: string;
};

export function usePlanCanvasViewState({
  activePlanViewId,
  elementsById,
  levelId,
  displayLevelId,
  activeLevelResolvedId,
}: PlanCanvasViewStateInput) {
  const showConstraints = useMemo(() => {
    if (!activePlanViewId) return false;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return false;
    return (pv as { showConstraints?: boolean }).showConstraints ?? false;
  }, [activePlanViewId, elementsById]);

  const showUnderlay = useMemo(() => {
    if (!activePlanViewId) return false;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return false;
    return (pv as { showUnderlay?: boolean }).showUnderlay ?? false;
  }, [activePlanViewId, elementsById]);

  const underlayLevelId = useMemo(() => {
    if (!activePlanViewId) return null;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return null;
    return (pv as { underlayLevelId?: string | null }).underlayLevelId ?? null;
  }, [activePlanViewId, elementsById]);

  const underlayLevels = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .map((e) => ({ id: e.id, name: e.name ?? e.id })),
    [elementsById],
  );

  const activeWorkPlaneName = useMemo(() => {
    if (!activePlanViewId) return null;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return null;
    const wpId = (pv as { activeWorkPlaneId?: string | null }).activeWorkPlaneId;
    if (!wpId) return null;
    const wp = elementsById[wpId];
    if (!wp || wp.kind !== 'reference_plane') return null;
    return (wp as { name?: string }).name ?? null;
  }, [activePlanViewId, elementsById]);

  const activeLevelElem = useMemo(() => {
    if (!levelId) return undefined;
    const el = elementsById[levelId];
    if (el && el.kind === 'level') return el;
    return undefined;
  }, [levelId, elementsById]);

  const levelIsEmpty = useMemo(() => {
    const chkId = displayLevelId || activeLevelResolvedId;
    if (!chkId) return false;
    return !Object.values(elementsById).some(
      (e) => 'levelId' in e && (e as { levelId: string }).levelId === chkId,
    );
  }, [elementsById, displayLevelId, activeLevelResolvedId]);

  return {
    showConstraints,
    showUnderlay,
    underlayLevelId,
    underlayLevels,
    activeWorkPlaneName,
    activeLevelElem,
    levelIsEmpty,
  };
}
