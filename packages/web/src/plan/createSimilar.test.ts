import { describe, expect, it } from 'vitest';

import { createSimilarPayload, getToolForElementKind } from './createSimilar';

describe('getToolForElementKind', () => {
  it('returns wall tool for wall kind', () => {
    expect(getToolForElementKind('wall')).toBe('wall');
  });

  it('returns door tool for door kind', () => {
    expect(getToolForElementKind('door')).toBe('door');
  });

  it('returns null for unknown kind', () => {
    expect(getToolForElementKind('unknown')).toBeNull();
  });
});

describe('createSimilarPayload', () => {
  it('returns toolId and typeId for a mapped element', () => {
    expect(createSimilarPayload({ kind: 'window', typeId: 'win-001' })).toEqual({
      toolId: 'window',
      typeId: 'win-001',
    });
  });

  it('returns null for an unmapped element kind', () => {
    expect(createSimilarPayload({ kind: 'unknown_kind' })).toBeNull();
  });
});
