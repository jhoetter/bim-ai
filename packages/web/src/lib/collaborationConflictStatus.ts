import { ApiHttpError } from './api';

/** Status line when the server rejects undo/redo/apply with 409 conflict + optional replayDiagnostics. */
export function formatCollaboration409Status(
  actionLabel: 'Undo' | 'Redo' | 'Apply',
  e: ApiHttpError,
): string | null {
  if (e.status !== 409) return null;

  const d = e.detail;
  const reason =
    d && typeof d === 'object' && !Array.isArray(d) && 'reason' in d
      ? String((d as { reason?: unknown }).reason ?? '').trim()
      : '';

  const replay =
    d && typeof d === 'object' && !Array.isArray(d) && 'replayDiagnostics' in d
      ? (d as { replayDiagnostics?: Record<string, unknown> }).replayDiagnostics
      : undefined;

  const stepRaw =
    replay && typeof replay === 'object' && replay !== null && 'firstBlockingCommandIndex' in replay
      ? Number((replay as { firstBlockingCommandIndex?: unknown }).firstBlockingCommandIndex)
      : NaN;

  const stepHint =
    Number.isFinite(stepRaw) && stepRaw >= 0 ? ` (step ${Math.floor(stepRaw) + 1})` : '';

  const rulesRaw =
    replay && typeof replay === 'object' && replay !== null && 'blockingViolationRuleIds' in replay
      ? (replay as { blockingViolationRuleIds?: unknown }).blockingViolationRuleIds
      : undefined;
  const rules =
    Array.isArray(rulesRaw) && rulesRaw.length
      ? rulesRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
  const maxRules = 6;
  const rulesHint =
    rules.length > 0
      ? `; blocking rules: ${rules.slice(0, maxRules).join(', ')}${rules.length > maxRules ? ', …' : ''}`
      : '';

  let cmdPeek = '';
  const typesRaw =
    replay &&
    typeof replay === 'object' &&
    replay !== null &&
    'commandTypesInOrder' in replay &&
    typeof (replay as { commandTypesInOrder?: unknown }).commandTypesInOrder !== 'undefined'
      ? (replay as { commandTypesInOrder?: unknown }).commandTypesInOrder
      : undefined;
  if (
    Array.isArray(typesRaw) &&
    typesRaw.length > 0 &&
    typesRaw.every((x): x is string => typeof x === 'string')
  ) {
    const head = typesRaw.slice(0, 8).join(' → ');
    cmdPeek =
      typesRaw.length > 8
        ? ` · cmds: ${head} → … (${typesRaw.length} total)`
        : ` · cmds: ${head}`;
  }

  return reason
    ? `${actionLabel} blocked: ${reason}${stepHint}${rulesHint}${cmdPeek}`
    : `${actionLabel} blocked (model conflict).${stepHint}${rulesHint}${cmdPeek}`;
}
