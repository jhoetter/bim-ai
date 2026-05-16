import type { Element } from '@bim-ai/core';

import { buildLevelDatumStackRows, levelIdsFromDatumRows } from '../workspace/readouts';

export type LevelAreaRow = {
  levelId: string;
  levelName: string;
  grossAreaM2: number;
  netAreaM2: number;
};

function polygonAreaMm2(pts: { xMm: number; yMm: number }[]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j]!.xMm + pts[i]!.xMm) * (pts[j]!.yMm - pts[i]!.yMm);
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(px: number, py: number, pts: { xMm: number; yMm: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.xMm,
      yi = pts[i]!.yMm;
    const xj = pts[j]!.xMm,
      yj = pts[j]!.yMm;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function buildLevelAreaReport(elementsById: Record<string, Element>): LevelAreaRow[] {
  const all = Object.values(elementsById);
  const levels = all.filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level');
  const floors = all.filter((e): e is Extract<Element, { kind: 'floor' }> => e.kind === 'floor');
  const columns = all.filter((e): e is Extract<Element, { kind: 'column' }> => e.kind === 'column');

  const rows: LevelAreaRow[] = [];
  for (const level of levels) {
    const levelFloors = floors.filter((f) => f.levelId === level.id);
    if (levelFloors.length === 0) continue;

    const grossAreaMm2 = levelFloors.reduce((sum, f) => {
      const boundary = f.boundaryMm ?? [];
      return sum + (boundary.length >= 3 ? polygonAreaMm2(boundary) : 0);
    }, 0);
    const grossAreaM2 = grossAreaMm2 / 1e6;

    const levelColumns = columns.filter((c) => c.levelId === level.id);
    let columnAreaMm2 = 0;
    for (const col of levelColumns) {
      const cx = col.positionMm.xMm;
      const cy = col.positionMm.yMm;
      const inAnyFloor = levelFloors.some((f) => {
        const boundary = f.boundaryMm ?? [];
        return boundary.length >= 3 && pointInPolygon(cx, cy, boundary);
      });
      if (inAnyFloor) {
        columnAreaMm2 += (col.bMm ?? 0) * (col.hMm ?? 0);
      }
    }
    const netAreaM2 = grossAreaM2 - columnAreaMm2 / 1e6;

    rows.push({
      levelId: level.id,
      levelName: level.name,
      grossAreaM2,
      netAreaM2,
    });
  }

  rows.sort((a, b) => {
    const la = elementsById[a.levelId] as Extract<Element, { kind: 'level' }> | undefined;
    const lb = elementsById[b.levelId] as Extract<Element, { kind: 'level' }> | undefined;
    const elevDiff = (la?.elevationMm ?? 0) - (lb?.elevationMm ?? 0);
    if (elevDiff !== 0) return elevDiff;
    return a.levelName.localeCompare(b.levelName);
  });

  return rows;
}

export function formatScheduleLevelDatumEvidenceLine(
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
): string {
  if (!activeLevelId?.trim()) return '';
  const rows = buildLevelDatumStackRows(elementsById);
  const ids = levelIdsFromDatumRows(rows);
  if (!ids.has(activeLevelId)) return '';
  const hit = rows.find((r) => r.id === activeLevelId);
  if (!hit) return '';
  return `scheduleLevelDatum[level=${activeLevelId} z=${hit.elevationMm.toFixed(3)}mm token=${hit.elevationToken}]`;
}
