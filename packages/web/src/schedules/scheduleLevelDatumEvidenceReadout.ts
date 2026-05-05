import type { Element } from '@bim-ai/core';

import { buildLevelDatumStackRows, levelIdsFromDatumRows } from '../workspace/datumLevelStackReadout';

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
