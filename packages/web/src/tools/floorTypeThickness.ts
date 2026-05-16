import type { Element } from '@bim-ai/core';

export function computeFloorTypeThicknessMm(
  floorType: Extract<Element, { kind: 'floor_type' }> | undefined | null,
): number {
  if (!floorType) return 0;
  return floorType.layers.reduce((sum, layer) => sum + layer.thicknessMm, 0);
}
