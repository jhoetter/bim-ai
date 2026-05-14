import * as THREE from 'three';

import { makeThreeMaterialForKey, type MaterialTextureManager } from './threeMaterialFactory';
import { resolveMaterial, type MaterialPbrSpec } from './materials';

export type MaterialQaGallerySample = {
  id: string;
  label: string;
  materialKey: string;
  expected: 'procedural' | 'texture' | 'transparent' | 'color';
};

export const MATERIAL_QA_GALLERY: MaterialQaGallerySample[] = [
  { id: 'brick-wall', label: 'Brick wall', materialKey: 'masonry_brick', expected: 'procedural' },
  {
    id: 'concrete-slab',
    label: 'Concrete slab',
    materialKey: 'concrete_smooth',
    expected: 'procedural',
  },
  {
    id: 'timber-beam',
    label: 'Timber beam',
    materialKey: 'cladding_warm_wood',
    expected: 'procedural',
  },
  {
    id: 'glass-window',
    label: 'Glass window',
    materialKey: 'glass_clear',
    expected: 'transparent',
  },
  {
    id: 'metal-roof',
    label: 'Metal roof',
    materialKey: 'metal_standing_seam_dark_grey',
    expected: 'procedural',
  },
  {
    id: 'painted-wall',
    label: 'Painted interior wall',
    materialKey: 'white_render',
    expected: 'procedural',
  },
  {
    id: 'floor-tile',
    label: 'Floor tile',
    materialKey: 'asset_limestone_honed',
    expected: 'texture',
  },
];

function uniqueByteCount(texture: THREE.Texture | null | undefined): number {
  const image = texture?.image as { data?: Uint8Array | Uint8ClampedArray } | undefined;
  if (!image?.data) return 0;
  return new Set(image.data).size;
}

function renderPath(spec: MaterialPbrSpec | null, material: THREE.Material): string {
  if ((material as THREE.MeshPhysicalMaterial).transmission) return 'transparent';
  if ((material as THREE.MeshStandardMaterial).map?.name.includes(':procedural:')) {
    return 'procedural';
  }
  if (spec?.textureMapUrl) return 'texture';
  return 'color';
}

export function buildMaterialQaEvidence(options?: { textureManager?: MaterialTextureManager }): {
  format: 'materialQaGalleryEvidence_v1';
  samples: Array<{
    id: string;
    materialKey: string;
    displayName: string;
    category: string;
    renderPath: string;
    hasAlbedoMap: boolean;
    hasReliefMap: boolean;
    albedoUniqueByteCount: number;
    transparent: boolean;
    opacity: number;
  }>;
} {
  return {
    format: 'materialQaGalleryEvidence_v1',
    samples: MATERIAL_QA_GALLERY.map((sample) => {
      const spec = resolveMaterial(sample.materialKey);
      const material = makeThreeMaterialForKey(sample.materialKey, {
        textureManager: options?.textureManager,
        usage: sample.id.includes('roof') ? 'roofTop' : 'wallExterior',
      }) as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      return {
        id: sample.id,
        materialKey: sample.materialKey,
        displayName: spec?.displayName ?? sample.materialKey,
        category: spec?.category ?? 'placeholder',
        renderPath: renderPath(spec, material),
        hasAlbedoMap: Boolean(material.map),
        hasReliefMap: Boolean(material.normalMap || material.bumpMap),
        albedoUniqueByteCount: uniqueByteCount(material.map),
        transparent: material.transparent,
        opacity: material.opacity,
      };
    }),
  };
}
