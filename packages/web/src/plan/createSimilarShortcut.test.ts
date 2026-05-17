import { describe, expect, it } from 'vitest';

import { createSimilarPayload } from './createSimilar';

describe('create similar shortcut — §3.3.9', () => {
  it('createSimilarPayload returns command for wall element', () => {
    const payload = createSimilarPayload({ kind: 'wall', typeId: 'wall-type-001' });
    expect(payload).not.toBeNull();
    expect(payload!.toolId).toBe('wall');
    expect(payload!.typeId).toBe('wall-type-001');
  });

  it('createSimilarPayload returns command for door element', () => {
    const payload = createSimilarPayload({ kind: 'door', typeId: 'door-type-001' });
    expect(payload).not.toBeNull();
    expect(payload!.toolId).toBe('door');
    expect(payload!.typeId).toBe('door-type-001');
  });

  it('createSimilarPayload returns null for level element (not applicable)', () => {
    const payload = createSimilarPayload({ kind: 'level', typeId: undefined });
    expect(payload).toBeNull();
  });
});
