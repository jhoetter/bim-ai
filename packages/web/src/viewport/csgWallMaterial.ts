import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import {
  resolveWallSurfaceMaterial,
  type ResolvedWallSurfaceMaterial,
  type ViewportPaintBundle,
} from './materials';
import { applyMaterialTextureVisibility } from './visualStyleMaterials';
import { makeThreeMaterialForKey, materialUvTransformForExtent } from './threeMaterialFactory';

export type CsgWallMaterialResult = {
  material: THREE.Material;
  surface: ResolvedWallSurfaceMaterial;
};

export function makeCsgWallMaterial(options: {
  materialKey: string | null | undefined;
  paint: ViewportPaintBundle | null | undefined;
  elementsById: Record<string, Element>;
  lenM: number;
  heightM: number;
  textureMapsVisible: boolean;
}): CsgWallMaterialResult {
  const { materialKey, paint, elementsById, lenM, heightM, textureMapsVisible } = options;
  const surface = resolveWallSurfaceMaterial(materialKey, paint, elementsById);
  const material = makeThreeMaterialForKey(materialKey, {
    elementsById,
    usage: 'wallExterior',
    uvTransform: materialUvTransformForExtent(materialKey, {
      elementsById,
      extentMm: { uMm: Math.max(1, lenM * 1000), vMm: Math.max(1, heightM * 1000) },
    }),
    fallbackColor: surface.baseColor,
    fallbackRoughness: surface.roughness,
    fallbackMetalness: surface.metalness,
  });
  if (material instanceof THREE.MeshStandardMaterial) {
    material.envMapIntensity = surface.envMapIntensity;
  }

  applyMaterialTextureVisibility(material, textureMapsVisible);
  return { material, surface };
}
