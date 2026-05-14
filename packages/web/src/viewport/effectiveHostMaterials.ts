import type { Element, MaterialFaceKind } from '@bim-ai/core';

import {
  getBuiltInWallType,
  resolveWallAssemblyExposedLayers,
} from '../families/wallTypeCatalog';

type WallElem = Extract<Element, { kind: 'wall' }>;
type FloorElem = Extract<Element, { kind: 'floor' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

function lastWallFaceMaterialKey(
  wall: WallElem,
  faceKind: MaterialFaceKind,
): string | null | undefined {
  const overrides = wall.faceMaterialOverrides ?? [];
  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    const override = overrides[index];
    if (override?.faceKind === faceKind && override.materialKey) return override.materialKey;
  }
  return null;
}

function wallTypeFaceMaterialKey(
  wall: WallElem,
  faceKind: MaterialFaceKind,
  elementsById?: Record<string, Element>,
): string | null | undefined {
  if (!wall.wallTypeId) return null;
  const type = elementsById?.[wall.wallTypeId];
  if (type?.kind === 'wall_type') {
    if (faceKind === 'interior') return type.layers.at(-1)?.materialKey ?? null;
    return type.layers[0]?.materialKey ?? null;
  }
  const builtIn = getBuiltInWallType(wall.wallTypeId);
  if (!builtIn) return null;
  const exposed = resolveWallAssemblyExposedLayers(builtIn);
  return faceKind === 'interior'
    ? (exposed.interior?.materialKey ?? null)
    : (exposed.exterior?.materialKey ?? null);
}

export function effectiveWallFaceMaterialKey(
  wall: WallElem,
  faceKind: MaterialFaceKind = 'exterior',
  elementsById?: Record<string, Element>,
): string | null | undefined {
  return (
    lastWallFaceMaterialKey(wall, faceKind) ??
    effectiveWallBaseMaterialKey(wall, faceKind, elementsById)
  );
}

export function effectiveWallBaseMaterialKey(
  wall: WallElem,
  faceKind: MaterialFaceKind = 'exterior',
  elementsById?: Record<string, Element>,
): string | null | undefined {
  return (
    wallTypeFaceMaterialKey(wall, faceKind, elementsById) ??
    wall.materialKey
  );
}

export function effectiveFloorTopMaterialKey(
  floor: FloorElem,
  elementsById?: Record<string, Element>,
): string | null | undefined {
  const floorType = floor.floorTypeId ? elementsById?.[floor.floorTypeId] : undefined;
  return floorType?.kind === 'floor_type' ? floorType.layers[0]?.materialKey : undefined;
}

export function effectiveRoofTopMaterialKey(
  roof: RoofElem,
  elementsById?: Record<string, Element>,
): string | null | undefined {
  const roofType = roof.roofTypeId ? elementsById?.[roof.roofTypeId] : undefined;
  if (roofType?.kind === 'roof_type') return roofType.layers[0]?.materialKey ?? roof.materialKey;
  return roof.materialKey;
}

export function isWhiteRenderLikeMaterial(materialKey: string | null | undefined): boolean {
  return materialKey === 'white_cladding' || materialKey === 'white_render';
}
