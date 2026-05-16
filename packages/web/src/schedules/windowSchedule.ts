import type { Element } from '@bim-ai/core';

export interface WindowScheduleRow {
  mark: string;
  typeId: string;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  levelName: string;
  count: number;
}

export function buildWindowSchedule(elementsById: Record<string, Element>): WindowScheduleRow[] {
  const wallLevel = new Map<string, string>();
  const levelNames = new Map<string, string>();

  for (const e of Object.values(elementsById)) {
    if (e.kind === 'wall') wallLevel.set(e.id, e.levelId);
    if (e.kind === 'level') levelNames.set(e.id, e.name ?? e.id);
  }

  type Group = { widthMm: number; heightMm: number; sillHeightMm: number; levels: Set<string> };
  const groups = new Map<string, Group>();

  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'window') continue;
    const typeId = e.familyTypeId ?? 'Generic';
    const lid = wallLevel.get(e.wallId);
    const lvName = lid ? (levelNames.get(lid) ?? lid) : '—';
    if (!groups.has(typeId)) {
      groups.set(typeId, {
        widthMm: e.widthMm,
        heightMm: e.heightMm,
        sillHeightMm: e.sillHeightMm,
        levels: new Set([lvName]),
      });
    } else {
      groups.get(typeId)!.levels.add(lvName);
    }
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([typeId, { widthMm, heightMm, sillHeightMm, levels }], i) => {
    const windows = Object.values(elementsById).filter(
      (e) => e.kind === 'window' && (e.familyTypeId ?? 'Generic') === typeId,
    );
    return {
      mark: `W${i + 1}`,
      typeId,
      widthMm,
      heightMm,
      sillHeightMm,
      levelName: [...levels].join(', '),
      count: windows.length,
    };
  });
}
