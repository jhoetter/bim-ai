import type { Element } from '@bim-ai/core';

export interface DoorScheduleRow {
  mark: string;
  typeId: string;
  widthMm: number;
  heightMm: number;
  levelName: string;
  count: number;
}

export function buildDoorSchedule(elementsById: Record<string, Element>): DoorScheduleRow[] {
  const wallLevel = new Map<string, string>();
  const levelNames = new Map<string, string>();

  for (const e of Object.values(elementsById)) {
    if (e.kind === 'wall') wallLevel.set(e.id, e.levelId);
    if (e.kind === 'level') levelNames.set(e.id, e.name ?? e.id);
  }

  type Group = { widthMm: number; levels: Set<string> };
  const groups = new Map<string, Group>();

  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'door') continue;
    const typeId = e.familyTypeId ?? 'Generic';
    const lid = wallLevel.get(e.wallId);
    const lvName = lid ? (levelNames.get(lid) ?? lid) : '—';
    if (!groups.has(typeId)) {
      groups.set(typeId, { widthMm: e.widthMm, levels: new Set([lvName]) });
    } else {
      const g = groups.get(typeId)!;
      g.levels.add(lvName);
    }
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([typeId, { widthMm, levels }], i) => {
    const doors = Object.values(elementsById).filter(
      (e) => e.kind === 'door' && (e.familyTypeId ?? 'Generic') === typeId,
    );
    return {
      mark: `D${i + 1}`,
      typeId,
      widthMm,
      heightMm: 0,
      levelName: [...levels].join(', '),
      count: doors.length,
    };
  });
}
