export type AgentBriefSourceBrief = {
  briefKind: string | null;
  briefId: string | null;
  briefTitle: string | null;
};

export type AgentBriefCommandProtocolV1 = {
  format: 'agentBriefCommandProtocol_v1';
  schemaVersion: number;
  sourceBrief: AgentBriefSourceBrief;
  assumptionIds: string[];
  deviationIds: string[];
  missingAssumptionReferences: { deviationId: string; relatedAssumptionId: string }[];
  proposedCommandCount: number;
  commandTypeHistogram: Record<string, number>;
  validationRuleIds: string[];
  validationTargetElementIds: string[];
  unresolvedBlockers: string[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Parse server payload field into a typed protocol, or null if missing/invalid. */
export function parseAgentBriefCommandProtocolV1(raw: unknown): AgentBriefCommandProtocolV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.format !== 'agentBriefCommandProtocol_v1') return null;
  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number') return null;

  const sb = raw.sourceBrief;
  if (!isRecord(sb)) return null;
  const briefKind = typeof sb.briefKind === 'string' ? sb.briefKind : null;
  const briefId = typeof sb.briefId === 'string' ? sb.briefId : null;
  const briefTitle = typeof sb.briefTitle === 'string' ? sb.briefTitle : null;

  if (!Array.isArray(raw.assumptionIds) || !raw.assumptionIds.every((x) => typeof x === 'string'))
    return null;
  if (!Array.isArray(raw.deviationIds) || !raw.deviationIds.every((x) => typeof x === 'string'))
    return null;
  const missing = raw.missingAssumptionReferences;
  if (!Array.isArray(missing)) return null;
  for (const row of missing) {
    if (
      !isRecord(row) ||
      typeof row.deviationId !== 'string' ||
      typeof row.relatedAssumptionId !== 'string'
    )
      return null;
  }
  if (typeof raw.proposedCommandCount !== 'number') return null;
  const hist = raw.commandTypeHistogram;
  if (!isRecord(hist)) return null;
  for (const v of Object.values(hist)) {
    if (typeof v !== 'number') return null;
  }
  if (
    !Array.isArray(raw.validationRuleIds) ||
    !raw.validationRuleIds.every((x) => typeof x === 'string')
  )
    return null;
  if (
    !Array.isArray(raw.validationTargetElementIds) ||
    !raw.validationTargetElementIds.every((x) => typeof x === 'string')
  )
    return null;
  if (
    !Array.isArray(raw.unresolvedBlockers) ||
    !raw.unresolvedBlockers.every((x) => typeof x === 'string')
  )
    return null;

  return {
    format: 'agentBriefCommandProtocol_v1',
    schemaVersion,
    sourceBrief: { briefKind, briefId, briefTitle },
    assumptionIds: [...raw.assumptionIds],
    deviationIds: [...raw.deviationIds],
    missingAssumptionReferences: missing.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        deviationId: r.deviationId as string,
        relatedAssumptionId: r.relatedAssumptionId as string,
      };
    }),
    proposedCommandCount: raw.proposedCommandCount,
    commandTypeHistogram: { ...hist } as Record<string, number>,
    validationRuleIds: [...raw.validationRuleIds],
    validationTargetElementIds: [...raw.validationTargetElementIds],
    unresolvedBlockers: [...raw.unresolvedBlockers],
  };
}

/** Deterministic monospace lines for UI + Vitest snapshots. */
export function formatAgentBriefCommandProtocolReadout(
  protocol: AgentBriefCommandProtocolV1 | null,
): string[] {
  if (protocol === null) return ['(no protocol)'];

  const histLines = Object.keys(protocol.commandTypeHistogram)
    .sort()
    .map((k) => `  hist ${k}: ${protocol.commandTypeHistogram[k]}`);

  const miss = protocol.missingAssumptionReferences
    .slice()
    .sort(
      (a, b) =>
        a.deviationId.localeCompare(b.deviationId) ||
        a.relatedAssumptionId.localeCompare(b.relatedAssumptionId),
    )
    .map((m) => `  missingRef ${m.deviationId} -> ${m.relatedAssumptionId}`);

  return [
    `format: ${protocol.format}`,
    `schemaVersion: ${protocol.schemaVersion}`,
    `brief: ${protocol.sourceBrief.briefKind ?? '—'} / ${protocol.sourceBrief.briefId ?? '—'} / ${protocol.sourceBrief.briefTitle ?? '—'}`,
    `assumptionIds: ${protocol.assumptionIds.join(', ') || '—'}`,
    `deviationIds: ${protocol.deviationIds.join(', ') || '—'}`,
    ...(miss.length
      ? ['missingAssumptionReferences:', ...miss]
      : ['missingAssumptionReferences: —']),
    `proposedCommandCount: ${protocol.proposedCommandCount}`,
    ...(histLines.length ? ['commandTypeHistogram:', ...histLines] : ['commandTypeHistogram: —']),
    `validationRuleIds: ${protocol.validationRuleIds.join(', ') || '—'}`,
    `validationTargetElementIds: ${protocol.validationTargetElementIds.join(', ') || '—'}`,
    `unresolvedBlockers: ${protocol.unresolvedBlockers.join(', ') || '—'}`,
  ];
}
