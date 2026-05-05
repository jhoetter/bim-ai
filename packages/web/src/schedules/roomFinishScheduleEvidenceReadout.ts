/** Readout lines for server `roomFinishScheduleEvidence_v1` (prompt-5 schedule / advisor alignment). */

export function roomFinishScheduleEvidenceReadoutParts(ev: unknown): string[] {
  if (!ev || typeof ev !== 'object') return [];
  const o = ev as Record<string, unknown>;
  if (o.format !== 'roomFinishScheduleEvidence_v1') return [];
  const dig = String(o.rowDigestSha256 ?? '').trim();
  const prefix = dig.length >= 16 ? `${dig.slice(0, 16)}…` : dig || '—';
  const s = o.summary;
  if (!s || typeof s !== 'object') {
    return [`digest ${prefix}`];
  }
  const sum = s as Record<string, unknown>;
  const c = Number(sum.complete ?? 0);
  const nr = Number(sum.not_required ?? 0);
  const m = Number(sum.missing ?? 0);
  const ps = peerSuggested(sum);
  return [
    `digest ${prefix}`,
    `complete ${c}`,
    `notRequired ${nr}`,
    `missing ${m}`,
    `peerSuggested ${ps}`,
  ];
}

function peerSuggested(sum: Record<string, unknown>): number {
  const raw = sum.peer_suggested ?? sum.peerSuggested;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}
