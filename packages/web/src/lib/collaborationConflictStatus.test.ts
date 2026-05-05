import { describe, expect, it } from 'vitest';

import { ApiHttpError } from './api';
import { formatCollaboration409Status } from './collaborationConflictStatus';

describe('formatCollaboration409Status', () => {
  it('returns null when status is not 409', () => {
    const e = new ApiHttpError(404, 'missing', {});
    expect(formatCollaboration409Status('Apply', e)).toBeNull();
  });

  it('includes reason and 1-based step hint from replayDiagnostics', () => {
    const e = new ApiHttpError(409, 'constraint blocked', {
      reason: 'wall constraint',
      replayDiagnostics: { firstBlockingCommandIndex: 2 },
    });
    expect(formatCollaboration409Status('Apply', e)).toBe(
      'Apply blocked: wall constraint (step 3)',
    );
  });

  it('uses conflict fallback when reason is missing', () => {
    const e = new ApiHttpError(409, '409 Conflict', {
      replayDiagnostics: { firstBlockingCommandIndex: 1 },
    });
    expect(formatCollaboration409Status('Undo', e)).toBe('Undo blocked (model conflict). (step 2)');
  });

  it('matches redo label', () => {
    const e = new ApiHttpError(409, 'x', { reason: 'stale' });
    expect(formatCollaboration409Status('Redo', e)).toBe('Redo blocked: stale');
  });
});
