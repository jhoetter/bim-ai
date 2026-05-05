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

  return reason
    ? `${actionLabel} blocked: ${reason}${stepHint}`
    : `${actionLabel} blocked (model conflict).${stepHint}`;
}
