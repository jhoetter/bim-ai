import { describe, expect, it } from 'vitest';

import { resolveHatchPatternId } from '../HatchRenderer';

describe('resolveHatchPatternId', () => {
  it('returns explicit id when set', () => {
    expect(resolveHatchPatternId('stone', 'wall')).toBe('stone');
  });
  it('returns brick for wall with no explicit id', () => {
    expect(resolveHatchPatternId(null, 'wall')).toBe('brick');
  });
  it('returns herringbone for floor', () => {
    expect(resolveHatchPatternId(null, 'floor')).toBe('herringbone');
  });
  it('returns tile for roof', () => {
    expect(resolveHatchPatternId(null, 'roof')).toBe('tile');
  });
  it('returns null for window (no category default)', () => {
    expect(resolveHatchPatternId(null, 'window')).toBeNull();
  });
  it('returns null when no category and no id', () => {
    expect(resolveHatchPatternId(null, undefined)).toBeNull();
  });
});
