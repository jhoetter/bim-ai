import type { Element } from '@bim-ai/core';

/** §3.4.1: apply attach_floor_to_roof command to an elementsById map.
 *  Pass roofId='' to detach. Returns a new map (does not mutate). */
export function applyAttachFloorToRoof(
  elementsById: Record<string, Element>,
  floorId: string,
  roofId: string,
): Record<string, Element> {
  const floor = elementsById[floorId];
  if (!floor || floor.kind !== 'floor') return elementsById;

  if (!roofId) {
    return {
      ...elementsById,
      [floorId]: { ...floor, attachedToRoofId: null, topFaceElevationMm: null },
    };
  }

  const roof = elementsById[roofId];
  if (!roof || roof.kind !== 'roof') return elementsById;

  const roofUndersideElevMm = roof.baseElevationMm ?? 0;
  return {
    ...elementsById,
    [floorId]: {
      ...floor,
      attachedToRoofId: roofId,
      topFaceElevationMm: roofUndersideElevMm,
    },
  };
}
