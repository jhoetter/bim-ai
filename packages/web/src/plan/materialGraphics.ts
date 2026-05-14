import type { Element } from '@bim-ai/core';

import {
  materialDefinitionToGraphicsSpec,
  resolveMaterialDefinition,
  type MaterialPbrSpec,
} from '../viewport/materials';

export type ResolvedMaterialPlanGraphics = {
  materialKey: string | null;
  displayName: string;
  shadedColor: string;
  transparency: number;
  surfacePatternId: string | null;
  surfacePatternColor: string | null;
  cutPatternId: string | null;
  cutPatternColor: string | null;
  useRenderAppearance: boolean;
};

function categoryFallbackPattern(definition: MaterialPbrSpec): string | null {
  switch (definition.category) {
    case 'brick':
      return 'brick';
    case 'concrete':
      return 'concrete';
    case 'stone':
      return 'stone';
    case 'metal_roof':
      return 'standing_seam';
    case 'timber':
    case 'cladding':
      return 'wood';
    case 'glass':
    case 'air':
      return null;
    default:
      return definition.hatchPattern ?? null;
  }
}

export function resolveMaterialPlanGraphics(
  materialKey: string | null | undefined,
  elementsById?: Record<string, Element>,
): ResolvedMaterialPlanGraphics | null {
  const definition = resolveMaterialDefinition(materialKey, elementsById);
  if (!definition) return null;
  const graphics = materialDefinitionToGraphicsSpec(definition);
  const fallbackPattern = categoryFallbackPattern(definition);
  const surfacePattern =
    graphics.surfacePattern && graphics.surfacePattern !== 'Solid fill'
      ? graphics.surfacePattern
      : null;
  const cutPattern =
    graphics.cutPattern && graphics.cutPattern !== 'By material' ? graphics.cutPattern : null;
  const useRenderAppearance = graphics.useRenderAppearance !== false;
  return {
    materialKey: definition.key,
    displayName: definition.displayName,
    shadedColor: graphics.shadedColor ?? (useRenderAppearance ? definition.baseColor : '#cccccc'),
    transparency: Math.max(0, Math.min(1, graphics.transparency ?? 0)),
    surfacePatternId: surfacePattern ?? definition.hatchPattern ?? fallbackPattern,
    surfacePatternColor: graphics.surfacePatternColor ?? null,
    cutPatternId: cutPattern ?? definition.hatchPattern ?? fallbackPattern,
    cutPatternColor: graphics.cutPatternColor ?? null,
    useRenderAppearance,
  };
}

export function materialPlanShadedColor(
  materialKey: string | null | undefined,
  elementsById?: Record<string, Element>,
  fallback = '#cccccc',
): string {
  return resolveMaterialPlanGraphics(materialKey, elementsById)?.shadedColor ?? fallback;
}
