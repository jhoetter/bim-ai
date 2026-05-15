import { describe, expect, it } from 'vitest';

import {
  isTextureRichRenderStyle,
  normalizeViewerRenderStyle,
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
});
