export function formatSectionDatumElevationEvidenceLine(payload: Record<string, unknown>): string {
  const ev = payload.sectionDatumElevationEvidence_v0;
  if (!ev || typeof ev !== 'object') return '';
  const o = ev as Record<string, unknown>;
  if (o.format !== 'sectionDatumElevationEvidence_v0') return '';
  const lc = coerceNum(o.levelMarkerCount);
  const gc = o.gridCrossingCount;
  const rc = o.reasonCode;
  const parts = [`markers=${lc}`];
  if (typeof rc === 'string' && rc) parts.push(`reason=${rc}`);
  if (gc === null || gc === undefined) parts.push('gridCrossings=?');
  else if (typeof gc === 'number') parts.push(`gridCrossings=${gc}`);
  return `sectionDatumElevation ${parts.join(' ')}`;
}

function coerceNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
