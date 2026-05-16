import { describe, expect, it } from 'vitest';
import { resolveElementFillColor, resolveElementSurfaceColor } from './graphicsOverride';

describe('resolveElementFillColor — §2.1.4', () => {
  it('returns default when no override', () => {
    expect(resolveElementFillColor('#aabbcc', undefined)).toBe('#aabbcc');
  });

  it('returns default when override is null', () => {
    expect(resolveElementFillColor('#aabbcc', null)).toBe('#aabbcc');
  });

  it('returns default when fillColorHex is null', () => {
    expect(resolveElementFillColor('#aabbcc', { fillColorHex: null })).toBe('#aabbcc');
  });

  it('returns override color when set', () => {
    expect(resolveElementFillColor('#aabbcc', { fillColorHex: '#ff0000' })).toBe('#ff0000');
  });

  it('resolveElementSurfaceColor: returns surfaceColorHex when set', () => {
    expect(resolveElementSurfaceColor('#aabbcc', { surfaceColorHex: '#00ff00' })).toBe('#00ff00');
  });
});
