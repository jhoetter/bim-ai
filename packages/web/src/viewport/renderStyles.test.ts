import { describe, expect, it } from 'vitest';

import {
  isPathTraceRenderStyle,
  isTextureRichRenderStyle,
  normalizeViewerRenderStyle,
} from './renderStyles';

describe('viewer render style helpers', () => {
  it('normalizes legacy ray-trace values to high-fidelity', () => {
    expect(normalizeViewerRenderStyle('ray-trace')).toBe('high-fidelity');
  });

  it('treats realistic, high-fidelity, and path-trace-preview as texture-rich styles', () => {
    expect(isTextureRichRenderStyle('realistic')).toBe(true);
    expect(isTextureRichRenderStyle('high-fidelity')).toBe(true);
    expect(isTextureRichRenderStyle('path-trace-preview')).toBe(true);
    expect(isTextureRichRenderStyle('shaded')).toBe(false);
  });

  it('identifies real path trace preview mode', () => {
    expect(isPathTraceRenderStyle('path-trace-preview')).toBe(true);
    expect(isPathTraceRenderStyle('ray-trace')).toBe(false);
  });
});
