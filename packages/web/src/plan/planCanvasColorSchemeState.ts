import { useMemo } from 'react';
import type { Element } from '@bim-ai/core';

import { buildRoomColorSchemeLegend } from '../schedules/roomColorSchemeLegendReadout';
import type { ColorSchemeRoomEntry } from './ColorSchemeDialog';

type Input = {
  elementsById: Record<string, Element>;
  activePlanViewId?: string | null;
  levelId: string;
};

export function usePlanCanvasColorSchemeState({ elementsById, activePlanViewId, levelId }: Input) {
  const roomsOnLevel = useMemo((): ColorSchemeRoomEntry[] => {
    const out: ColorSchemeRoomEntry[] = [];
    for (const el of Object.values(elementsById)) {
      if (el.kind !== 'room') continue;
      if (levelId && (el as { levelId?: string }).levelId !== levelId) continue;
      out.push({
        id: el.id,
        name: (el as { name?: string }).name ?? '',
        department: (el as { department?: string | null }).department ?? undefined,
        area: undefined,
        occupancy: undefined,
      });
    }
    return out;
  }, [elementsById, levelId]);

  const activePlanViewColorScheme = useMemo(() => {
    if (!activePlanViewId) return null;
    const el = elementsById[activePlanViewId];
    if (!el || el.kind !== 'plan_view') return null;
    return el.colorScheme ?? null;
  }, [activePlanViewId, elementsById]);

  const colorSchemeLegendRows = useMemo(
    () => buildRoomColorSchemeLegend(elementsById, activePlanViewColorScheme),
    [elementsById, activePlanViewColorScheme],
  );

  const colorSchemeLegendTitle = useMemo(() => {
    switch (activePlanViewColorScheme?.category) {
      case 'name':
        return 'By Name';
      case 'department':
        return 'By Department';
      case 'area':
        return 'By Area';
      case 'occupancy':
        return 'By Occupancy';
      default:
        return 'Color Scheme';
    }
  }, [activePlanViewColorScheme]);

  return {
    roomsOnLevel,
    activePlanViewColorScheme,
    colorSchemeLegendRows,
    colorSchemeLegendTitle,
  };
}
