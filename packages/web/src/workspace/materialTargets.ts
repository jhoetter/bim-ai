import type { Element } from '@bim-ai/core';

import type { MaterialBrowserTargetRequest } from './inspector';

type MaterialEditableType = Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>;
type MaterialEditableInstance = Extract<
  Element,
  {
    kind:
      | 'toposolid'
      | 'toposolid_subdivision'
      | 'wall'
      | 'door'
      | 'window'
      | 'roof'
      | 'column'
      | 'beam'
      | 'text_3d'
      | 'sweep'
      | 'mass'
      | 'pipe';
  }
>;

export type MaterialEditableTarget =
  | { kind: 'type-layer'; element: MaterialEditableType }
  | {
      kind: 'instance';
      element: MaterialEditableInstance;
      property: 'materialKey' | 'defaultMaterialKey';
    };

export type ActiveMaterialBrowserTarget =
  | { kind: 'editable'; target: MaterialEditableTarget; label: string; currentKey: string | null }
  | MaterialBrowserTargetRequest;

function hasInstanceMaterialTarget(selected: Element): selected is MaterialEditableInstance {
  switch (selected.kind) {
    case 'toposolid':
    case 'toposolid_subdivision':
    case 'wall':
    case 'door':
    case 'window':
    case 'roof':
    case 'column':
    case 'beam':
    case 'text_3d':
    case 'sweep':
    case 'mass':
    case 'pipe':
      return true;
    default:
      return false;
  }
}

export function materialKeyForInstanceTarget(
  target: Extract<MaterialEditableTarget, { kind: 'instance' }>,
): string | null {
  if (target.element.kind === 'toposolid') return target.element.defaultMaterialKey ?? null;
  return 'materialKey' in target.element ? (target.element.materialKey ?? null) : null;
}

export function materialEditableTargetLabel(target: MaterialEditableTarget): string {
  if (target.kind === 'type-layer') {
    if (target.element.kind === 'wall_type') return `${target.element.name} · exterior layer`;
    if (target.element.kind === 'floor_type') return `${target.element.name} · top layer`;
    return `${target.element.name} · top layer`;
  }
  if (target.element.kind === 'toposolid') return `${target.element.name} · default material`;
  const name =
    'name' in target.element && typeof target.element.name === 'string'
      ? target.element.name
      : target.element.id;
  return `${name} · instance material`;
}

export function resolveMaterialEditableTarget(
  selected: Element | undefined,
  elementsById: Record<string, Element>,
): MaterialEditableTarget | null {
  if (!selected) return null;
  if (
    selected.kind === 'wall_type' ||
    selected.kind === 'floor_type' ||
    selected.kind === 'roof_type'
  ) {
    return { kind: 'type-layer', element: selected };
  }
  if (selected.kind === 'wall' && selected.wallTypeId) {
    const type = elementsById[selected.wallTypeId];
    return type?.kind === 'wall_type' ? { kind: 'type-layer', element: type } : null;
  }
  if (selected.kind === 'roof' && selected.roofTypeId) {
    const type = elementsById[selected.roofTypeId];
    return type?.kind === 'roof_type' ? { kind: 'type-layer', element: type } : null;
  }
  if (hasInstanceMaterialTarget(selected)) {
    return {
      kind: 'instance',
      element: selected,
      property: selected.kind === 'toposolid' ? 'defaultMaterialKey' : 'materialKey',
    };
  }
  if (selected.kind === 'floor') {
    const typeId = selected.floorTypeId;
    if (!typeId) return null;
    const type = elementsById[typeId];
    return type?.kind === 'floor_type' ? { kind: 'type-layer', element: type } : null;
  }
  return null;
}

export function materialSlotTargetLabel(
  target: MaterialBrowserTargetRequest,
  elementsById: Record<string, Element>,
): string {
  const element = elementsById[target.elementId];
  const name =
    element && 'name' in element && typeof element.name === 'string'
      ? element.name
      : target.elementId;
  return `${name} · ${target.label}`;
}
