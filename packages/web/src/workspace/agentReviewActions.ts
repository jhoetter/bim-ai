/** Evidence-package `agentReviewActions_v1` helpers (WP-F01). */

export type AgentReviewActionRow = {
  actionId: string;
  kind: string;
  guidance: string;
  target: Record<string, unknown>;
};

export function parseAgentReviewActionsV1(raw: unknown): AgentReviewActionRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  if (o.format !== 'agentReviewActions_v1' || !Array.isArray(o.actions)) return [];
  const out: AgentReviewActionRow[] = [];
  for (const item of o.actions) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const actionId = typeof a.actionId === 'string' ? a.actionId : '';
    const kind = typeof a.kind === 'string' ? a.kind : '';
    if (!actionId || !kind) continue;
    out.push({
      actionId,
      kind,
      guidance: typeof a.guidance === 'string' ? a.guidance : '',
      target:
        typeof a.target === 'object' && a.target !== null
          ? (a.target as Record<string, unknown>)
          : {},
    });
  }
  return out;
}
