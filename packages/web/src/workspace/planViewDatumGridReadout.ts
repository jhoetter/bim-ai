import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

type GridLinePrim = {
  id: string;
  levelId?: string | null;
};

function readGridLines(primitives: PlanProjectionPrimitivesV1Wire | null): GridLinePrim[] {
  if (!primitives || typeof primitives !== 'object') return [];
  const raw = (primitives as Record<string, unknown>).gridLines;
  if (!Array.isArray(raw)) return [];
  const out: GridLinePrim[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    if (typeof o.id !== 'string') continue;
    const lid = o.levelId ?? o.level_id;
    out.push({
      id: o.id,
      levelId: lid == null || lid === '' ? null : String(lid),
    });
  }
  return out;
}

/** Compact inspector line: grid ids on wire + datum reference sanity vs snapshot levels. */
export function buildPlanGridDatumInspectorLine(
  elementsById: Record<string, Element>,
  planProjectionPrimitives: PlanProjectionPrimitivesV1Wire | null,
  planViewId: string,
): string {
  const pv = elementsById[planViewId];
  if (!pv || pv.kind !== 'plan_view') return '';
  const grids = readGridLines(planProjectionPrimitives);
  if (!grids.length) return '';
  const sorted = [...grids].sort((a, b) => a.id.localeCompare(b.id));
  let bad = 0;
  const tok = sorted
    .map((g) => {
      if (!g.levelId) return `${g.id}:noLevel`;
      const host = elementsById[g.levelId];
      if (!host || host.kind !== 'level') {
        bad += 1;
        return `${g.id}:datum_grid_reference_missing`;
      }
      return `${g.id}:ok`;
    })
    .join(';');
  return `planGridDatum grids=${sorted.length} badRef=${bad} ${tok}`;
}
