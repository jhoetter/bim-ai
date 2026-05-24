import { describe, expect, it } from 'vitest';

import {
  isTextureRichRenderStyle,
  normalizeViewerRenderStyle,
  parseViewerRenderStyleParam,
} from './renderStyles';

describe('viewer render style helpers', () => {
  it('normalizes legacy ray-trace values to high-fidelity', () => {
    expect(normalizeViewerRenderStyle('ray-trace')).toBe('high-fidelity');
    expect(normalizeViewerRenderStyle('path-trace-preview')).toBe('high-fidelity');
  });

  it('treats realistic and high-fidelity as texture-rich styles', () => {
    expect(isTextureRichRenderStyle('realistic')).toBe(true);
    expect(isTextureRichRenderStyle('high-fidelity')).toBe(true);
    expect(isTextureRichRenderStyle('path-trace-preview')).toBe(true);
    expect(isTextureRichRenderStyle('shaded')).toBe(false);
  });

  // MF-render-3 (#27): the capture runner deep-links via ``?renderStyle=…``;
  // the viewer parses the param on mount so wireframe / hidden-line captures
  // never flash a shaded frame before switching.
  describe('parseViewerRenderStyleParam', () => {
    it('returns the matching style for known values', () => {
      expect(parseViewerRenderStyleParam('wireframe')).toBe('wireframe');
      expect(parseViewerRenderStyleParam('shaded')).toBe('shaded');
      expect(parseViewerRenderStyleParam('hidden-line')).toBe('hidden-line');
      expect(parseViewerRenderStyleParam('consistent-colors')).toBe('consistent-colors');
      expect(parseViewerRenderStyleParam('realistic')).toBe('realistic');
    });

    it('is case-insensitive and trims whitespace so URL-encoded values still match', () => {
      expect(parseViewerRenderStyleParam(' Wireframe ')).toBe('wireframe');
      expect(parseViewerRenderStyleParam('SHADED')).toBe('shaded');
    });

    it('normalizes legacy ray-trace through to high-fidelity', () => {
      expect(parseViewerRenderStyleParam('ray-trace')).toBe('high-fidelity');
    });

    it('returns null for missing / unknown values so the store keeps its default', () => {
      expect(parseViewerRenderStyleParam(null)).toBeNull();
      expect(parseViewerRenderStyleParam(undefined)).toBeNull();
      expect(parseViewerRenderStyleParam('')).toBeNull();
      expect(parseViewerRenderStyleParam('toon')).toBeNull();
      expect(parseViewerRenderStyleParam('path-trace-preview')).toBeNull();
    });
  });
});
