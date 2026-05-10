export const DEFAULT_CHECKPOINT_RETENTION_LIMIT = 20;
export const MIN_CHECKPOINT_RETENTION_LIMIT = 1;
export const MAX_CHECKPOINT_RETENTION_LIMIT = 99;

export function coerceCheckpointRetentionLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_CHECKPOINT_RETENTION_LIMIT;
  return Math.min(
    MAX_CHECKPOINT_RETENTION_LIMIT,
    Math.max(MIN_CHECKPOINT_RETENTION_LIMIT, Math.round(n)),
  );
}
