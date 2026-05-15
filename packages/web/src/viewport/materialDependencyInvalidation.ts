import type { Element } from '@bim-ai/core';

function recordMaterialKeys(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (value.trim()) out.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) recordMaterialKeys(item, out);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'materialSlots') {
      recordAllStrings(child, out);
    } else if (
      key === 'materialKey' ||
      key === 'defaultMaterialKey' ||
      key === 'monolithicMaterial'
    ) {
      recordMaterialKeys(child, out);
    } else if (key === 'layers' || key === 'faceMaterialOverrides' || key === 'panelOverrides') {
      recordMaterialKeys(child, out);
    }
  }
}

function recordAllStrings(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (value.trim()) out.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) recordAllStrings(item, out);
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) recordAllStrings(child, out);
}

function materialKeysForElement(element: Element): Set<string> {
  const keys = new Set<string>();
  recordMaterialKeys(element, keys);
  return keys;
}

function addHostsForType(
  elementsById: Record<string, Element>,
  typeId: string,
  dirty: Set<string>,
): void {
  for (const element of Object.values(elementsById)) {
    if (element.kind === 'wall' && element.wallTypeId === typeId) dirty.add(element.id);
    if (element.kind === 'floor' && element.floorTypeId === typeId) dirty.add(element.id);
    if (element.kind === 'roof' && element.roofTypeId === typeId) dirty.add(element.id);
  }
}

export function materialDependencyDirtyIds(
  elementsById: Record<string, Element>,
  changedIds: Iterable<string>,
): Set<string> {
  const dirty = new Set<string>();
  const changedMaterialKeys = new Set<string>();
  const changedTypeIds = new Set<string>();

  for (const id of changedIds) {
    const element = elementsById[id];
    if (!element) continue;
    if (element.kind === 'material') changedMaterialKeys.add(id);
    if (
      element.kind === 'wall_type' ||
      element.kind === 'floor_type' ||
      element.kind === 'roof_type'
    ) {
      changedTypeIds.add(id);
    }
  }

  for (const typeId of changedTypeIds) addHostsForType(elementsById, typeId, dirty);

  if (changedMaterialKeys.size === 0) return dirty;

  for (const element of Object.values(elementsById)) {
    const keys = materialKeysForElement(element);
    if (![...changedMaterialKeys].some((key) => keys.has(key))) continue;
    dirty.add(element.id);
    if (
      element.kind === 'wall_type' ||
      element.kind === 'floor_type' ||
      element.kind === 'roof_type'
    ) {
      addHostsForType(elementsById, element.id, dirty);
    }
  }

  return dirty;
}
