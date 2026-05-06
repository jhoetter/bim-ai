import type { Element, Violation } from '@bim-ai/core';

import { sortViolationsDeterministic } from '../advisor/advisorViolationContext';

/** Aligns with `bim_ai.constraints` level_datum_parent_offset_mismatch tolerance (>= 1.0 mm delta). */
export const LEVEL_DATUM_ELEVATION_ALIGN_EPS_MM = 1;

export type DatumElevationToken = 'root' | 'derived' | 'authored' | 'unresolved_parent';

export type LevelDatumStackRow = {
  id: string;
  name: string;
  elevationMm: number;
  parentLevelId: string | null;
  parentName: string | null;
  offsetFromParentMm: number;
  elevationToken: DatumElevationToken;
  planViewCount: number;
};

const DATUM_RULE_IDS = new Set<string>([
  'level_datum_parent_cycle',
  'level_datum_parent_offset_mismatch',
  'wall_constraint_levels_inverted',
  'level_parent_unresolved',
  'datum_grid_reference_missing',
  'elevation_marker_view_unresolved',
  'section_level_reference_missing',
]);

export function formatElevationMmReadout(mm: number): string {
  const n = Math.round(mm * 1000) / 1000;
  return String(n);
}

export function countPlanViewsByLevelId(
  elementsById: Record<string, Element>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'plan_view') continue;
    const lid = el.levelId;
    m.set(lid, (m.get(lid) ?? 0) + 1);
  }
  return m;
}

export function resolveDatumElevationToken(
  elevationMm: number,
  offsetFromParentMm: number,
  parentLevel: Element | undefined,
): DatumElevationToken {
  if (!parentLevel) return 'unresolved_parent';
  if (parentLevel.kind !== 'level') return 'unresolved_parent';
  const expected = parentLevel.elevationMm + offsetFromParentMm;
  if (Math.abs(elevationMm - expected) < LEVEL_DATUM_ELEVATION_ALIGN_EPS_MM) return 'derived';
  return 'authored';
}

export function buildLevelDatumStackRows(
  elementsById: Record<string, Element>,
): LevelDatumStackRow[] {
  const planByLevel = countPlanViewsByLevelId(elementsById);
  const levels = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );

  const rows: LevelDatumStackRow[] = levels.map((lv) => {
    const pid = lv.parentLevelId?.trim() ? lv.parentLevelId : null;
    const parentEl = pid ? elementsById[pid] : undefined;
    const parentName = parentEl?.kind === 'level' ? parentEl.name : null;
    const off = Number(lv.offsetFromParentMm ?? 0);

    let elevationToken: DatumElevationToken;
    if (pid == null) {
      elevationToken = 'root';
    } else {
      elevationToken = resolveDatumElevationToken(lv.elevationMm, off, parentEl);
    }

    return {
      id: lv.id,
      name: lv.name,
      elevationMm: lv.elevationMm,
      parentLevelId: pid,
      parentName,
      offsetFromParentMm: pid == null ? 0 : off,
      elevationToken,
      planViewCount: planByLevel.get(lv.id) ?? 0,
    };
  });

  rows.sort((a, b) => {
    if (a.elevationMm !== b.elevationMm) return a.elevationMm - b.elevationMm;
    return a.id.localeCompare(b.id);
  });
  return rows;
}

export function levelIdsFromDatumRows(rows: LevelDatumStackRow[]): Set<string> {
  return new Set(rows.map((r) => r.id));
}

export function filterDatumWorkbenchViolations(
  violations: Violation[],
  levelIds: Set<string>,
): Violation[] {
  const filtered = violations.filter((v) => {
    if (!DATUM_RULE_IDS.has(v.ruleId)) return false;
    const ids = v.elementIds ?? [];
    return ids.some((id) => levelIds.has(id));
  });
  return sortViolationsDeterministic(filtered);
}

/** Monospace-friendly one-line summary for agents / evidence (stable column order). */
export function buildLevelDatumStackEvidenceToken(
  rows: LevelDatumStackRow[],
  selectedLevelId: string,
): string {
  const parts = rows.map((r) => {
    const par = r.parentLevelId ?? '-';
    const tok = r.elevationToken;
    const pv = r.planViewCount;
    return `${r.id}:${formatElevationMmReadout(r.elevationMm)}:${tok}:par=${par}:pv=${pv}`;
  });
  return `levelDatumStack[sel=${selectedLevelId}] ${parts.join('|')}`;
}
