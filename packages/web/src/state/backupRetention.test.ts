import { describe, expect, it } from 'vitest';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
} from './backupRetention';

describe('backup retention settings', () => {
  it('defaults invalid values and clamps the project checkpoint retention range', () => {
    expect(coerceCheckpointRetentionLimit(undefined)).toBe(DEFAULT_CHECKPOINT_RETENTION_LIMIT);
    expect(coerceCheckpointRetentionLimit('0')).toBe(1);
    expect(coerceCheckpointRetentionLimit('150')).toBe(99);
    expect(coerceCheckpointRetentionLimit('8')).toBe(8);
  });
});
