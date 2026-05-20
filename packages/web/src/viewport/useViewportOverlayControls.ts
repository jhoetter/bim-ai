import { useCallback, useMemo } from 'react';
import type { Element, Saved3dViewElement } from '@bim-ai/core';

import { resolve3dDraftLevel } from './authoring3d';

export function useViewportOverlayControls({
  elementsById,
  activeLevelId,
  setActiveLevelId,
  selectElement,
}: {
  elementsById: Record<string, Element>;
  activeLevelId: string | undefined;
  setActiveLevelId: (id: string | undefined) => void;
  selectElement: (id?: string) => void;
}) {
  const saved3dViewsList = useMemo(
    () =>
      Object.values(elementsById).filter(
        (el): el is Saved3dViewElement => el.kind === 'saved_3d_view',
      ),
    [elementsById],
  );

  const direct3dLevelOptions = useMemo(
    () =>
      Object.values(elementsById)
        .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
        .map((level) => ({ id: level.id, name: level.name, elevationMm: level.elevationMm }))
        .sort((a, b) => a.elevationMm - b.elevationMm),
    [elementsById],
  );

  const activeWorkPlaneLevel = useMemo(
    () => resolve3dDraftLevel(direct3dLevelOptions, activeLevelId),
    [activeLevelId, direct3dLevelOptions],
  );

  const setAuthoringWorkPlaneLevel = useCallback(
    (levelId: string): void => {
      if (!levelId) return;
      setActiveLevelId(levelId);
      selectElement(levelId);
    },
    [selectElement, setActiveLevelId],
  );

  const stepAuthoringWorkPlaneLevel = useCallback(
    (direction: -1 | 1): void => {
      if (direct3dLevelOptions.length === 0) return;
      const activeIndex = activeWorkPlaneLevel
        ? direct3dLevelOptions.findIndex((level) => level.id === activeWorkPlaneLevel.id)
        : -1;
      const fallbackIndex = direction > 0 ? 0 : direct3dLevelOptions.length - 1;
      const nextIndex =
        activeIndex < 0
          ? fallbackIndex
          : Math.max(0, Math.min(direct3dLevelOptions.length - 1, activeIndex + direction));
      setAuthoringWorkPlaneLevel(direct3dLevelOptions[nextIndex]!.id);
    },
    [activeWorkPlaneLevel, direct3dLevelOptions, setAuthoringWorkPlaneLevel],
  );

  return {
    saved3dViewsList,
    direct3dLevelOptions,
    activeWorkPlaneLevel,
    setAuthoringWorkPlaneLevel,
    stepAuthoringWorkPlaneLevel,
  };
}
