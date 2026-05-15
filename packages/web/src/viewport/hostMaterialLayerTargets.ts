import type { Element } from '@bim-ai/core';

type Layer = Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>['layers'][number];

function firstVisibleLayerIndex(layers: Layer[]): number {
  const visible = layers.findIndex((layer) => layer.materialKey !== 'air');
  return visible >= 0 ? visible : 0;
}

function lastVisibleLayerIndex(layers: Layer[]): number {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    if (layers[index]?.materialKey !== 'air') return index;
  }
  return Math.max(0, layers.length - 1);
}

export function wallTypeExteriorLayerIndex(type: Extract<Element, { kind: 'wall_type' }>): number {
  const finish = type.layers.findIndex(
    (layer) => layer.function === 'finish' && layer.materialKey !== 'air',
  );
  return finish >= 0 ? finish : firstVisibleLayerIndex(type.layers);
}

export function wallTypeInteriorLayerIndex(type: Extract<Element, { kind: 'wall_type' }>): number {
  for (let index = type.layers.length - 1; index >= 0; index -= 1) {
    const layer = type.layers[index];
    if (layer?.function === 'finish' && index !== wallTypeExteriorLayerIndex(type)) return index;
  }
  return lastVisibleLayerIndex(type.layers);
}

export function topLayerIndex(
  type: Extract<Element, { kind: 'floor_type' | 'roof_type' }>,
): number {
  const finish = type.layers.findIndex(
    (layer) => layer.function === 'finish' && layer.materialKey !== 'air',
  );
  return finish >= 0 ? finish : firstVisibleLayerIndex(type.layers);
}

export function materialTargetLayerIndex(
  type: Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>,
): number {
  if (type.kind === 'wall_type') return wallTypeExteriorLayerIndex(type);
  return topLayerIndex(type);
}
