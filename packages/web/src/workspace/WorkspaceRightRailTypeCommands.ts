import type { Element } from '@bim-ai/core';

export type DuplicableTypeElement = Extract<
  Element,
  { kind: 'family_type' | 'wall_type' | 'floor_type' | 'roof_type' }
>;

export function isDuplicableTypeElement(element: Element): element is DuplicableTypeElement {
  return (
    element.kind === 'family_type' ||
    element.kind === 'wall_type' ||
    element.kind === 'floor_type' ||
    element.kind === 'roof_type'
  );
}

export function typePropertyUpdateCommand(
  element: DuplicableTypeElement,
  property: string,
  value: unknown,
): Record<string, unknown> {
  if (element.kind === 'family_type') {
    const parameters = { ...element.parameters };
    if (property === 'name') {
      parameters.name = value;
    } else if (property.startsWith('parameters.')) {
      parameters[property.slice('parameters.'.length)] = value;
    }
    return {
      type: 'upsertFamilyType',
      id: element.id,
      discipline: element.discipline,
      parameters,
      ...(element.catalogSource ? { catalogSource: { ...element.catalogSource } } : {}),
    };
  }
  if (element.kind === 'wall_type') {
    return {
      type: 'upsertWallType',
      id: element.id,
      name: property === 'name' && typeof value === 'string' ? value : element.name,
      basisLine:
        property === 'basisLine' &&
        (value === 'center' || value === 'face_interior' || value === 'face_exterior')
          ? value
          : (element.basisLine ?? 'center'),
      layers: element.layers.map((layer) => ({ ...layer })),
    };
  }
  if (element.kind === 'floor_type') {
    return {
      type: 'upsertFloorType',
      id: element.id,
      name: property === 'name' && typeof value === 'string' ? value : element.name,
      layers: element.layers.map((layer) => ({ ...layer })),
    };
  }
  return {
    type: 'upsertRoofType',
    id: element.id,
    name: property === 'name' && typeof value === 'string' ? value : element.name,
    layers: element.layers.map((layer) => ({ ...layer })),
  };
}
