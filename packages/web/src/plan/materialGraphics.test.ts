import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { materialPlanShadedColor, resolveMaterialPlanGraphics } from './materialGraphics';

describe('material plan graphics', () => {
  it('resolves built-in material cut and surface pattern fallbacks separately from textures', () => {
    const graphics = resolveMaterialPlanGraphics('masonry_brick')!;

    expect(graphics.shadedColor).toBe('#a45a3f');
    expect(graphics.surfacePatternId).toBe('brick');
    expect(graphics.cutPatternId).toBe('brick');
    expect(graphics.useRenderAppearance).toBe(true);
  });

  it('uses project material graphics over render appearance when supplied', () => {
    const material: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-project-brick-graphics',
      name: 'Project Brick Graphics',
      category: 'brick',
      appearance: {
        baseColor: '#884422',
        albedoMapId: 'project/brick/render-only',
      },
      graphics: {
        useRenderAppearance: false,
        shadedColor: '#775544',
        surfacePatternId: 'surface-running-bond',
        surfacePatternColor: '#5f4034',
        cutPatternId: 'cut-masonry-crosshatch',
        cutPatternColor: '#2f241f',
        transparency: 0.15,
      },
    };
    const elementsById: Record<string, Element> = { [material.id]: material };
    const graphics = resolveMaterialPlanGraphics(material.id, elementsById)!;

    expect(graphics.shadedColor).toBe('#775544');
    expect(graphics.surfacePatternId).toBe('surface-running-bond');
    expect(graphics.surfacePatternColor).toBe('#5f4034');
    expect(graphics.cutPatternId).toBe('cut-masonry-crosshatch');
    expect(graphics.cutPatternColor).toBe('#2f241f');
    expect(graphics.transparency).toBe(0.15);
    expect(materialPlanShadedColor(material.id, elementsById)).toBe('#775544');
  });
});
