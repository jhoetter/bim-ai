import type { Element } from '@bim-ai/core';

export interface ColumnScheduleRow {
  mark: string;
  typeId: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  levelName: string;
  count: number;
}

export function buildColumnSchedule(elementsById: Record<string, Element>): ColumnScheduleRow[] {
  const levelNames = new Map<string, string>();
  for (const e of Object.values(elementsById)) {
    if (e.kind === 'level') levelNames.set(e.id, e.name ?? e.id);
  }

  type Group = { widthMm: number; depthMm: number; heightMm: number; levelId: string };
  const groups = new Map<string, Group>();

  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'column') continue;
    const typeId = e.materialKey ?? `${e.bMm}x${e.hMm}`;
    if (!groups.has(typeId)) {
      groups.set(typeId, {
        widthMm: e.bMm,
        depthMm: e.hMm,
        heightMm: e.heightMm,
        levelId: e.levelId,
      });
    }
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([typeId, { widthMm, depthMm, heightMm, levelId }], i) => {
    const cols = Object.values(elementsById).filter(
      (e) => e.kind === 'column' && (e.materialKey ?? `${e.bMm}x${e.hMm}`) === typeId,
    );
    const lvName = levelNames.get(levelId) ?? levelId;
    return {
      mark: `C${i + 1}`,
      typeId,
      widthMm,
      depthMm,
      heightMm,
      levelName: lvName,
      count: cols.length,
    };
  });
}
