export type LevelDatumPropagationRowV0 = {
  levelId: string;
  elevationBeforeMm: number;
  elevationAfterMm: number;
  deltaMm: number;
  parentLevelId: string | null;
  role: 'direct_move' | 'datum_propagated' | 'unchanged';
};

export type LevelElevationPropagationEvidenceV0 = {
  format: 'levelElevationPropagationEvidence_v0';
  datumPropagationBlocked: boolean;
  directMoveLevelIds?: string[];
  rows: LevelDatumPropagationRowV0[];
};

function isRow(x: unknown): x is LevelDatumPropagationRowV0 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.levelId !== 'string') return false;
  if (typeof o.role !== 'string') return false;
  if (!['direct_move', 'datum_propagated', 'unchanged'].includes(o.role)) return false;
  return (
    typeof o.elevationBeforeMm === 'number' &&
    typeof o.elevationAfterMm === 'number' &&
    typeof o.deltaMm === 'number'
  );
}

export function parseLevelElevationPropagationEvidence(
  raw: unknown,
): LevelElevationPropagationEvidenceV0 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== 'levelElevationPropagationEvidence_v0') return null;
  if (typeof o.datumPropagationBlocked !== 'boolean') return null;
  const rowsRaw = o.rows;
  if (!Array.isArray(rowsRaw) || !rowsRaw.every(isRow)) return null;
  return {
    format: 'levelElevationPropagationEvidence_v0',
    datumPropagationBlocked: o.datumPropagationBlocked,
    directMoveLevelIds: Array.isArray(o.directMoveLevelIds)
      ? o.directMoveLevelIds.filter((x): x is string => typeof x === 'string')
      : undefined,
    rows: rowsRaw,
  };
}

/** Single monospace line for workbench / agents (stable sort by levelId). */
export function formatLevelDatumPropagationEvidenceLine(
  ev: LevelElevationPropagationEvidenceV0,
): string {
  const rows = [...ev.rows].sort((a, b) => a.levelId.localeCompare(b.levelId));
  const parts = rows.map((r) => `${r.levelId}:${r.role}:Δ${r.deltaMm.toFixed(3)}`);
  return `blocked=${ev.datumPropagationBlocked} ${parts.join('|')}`;
}
