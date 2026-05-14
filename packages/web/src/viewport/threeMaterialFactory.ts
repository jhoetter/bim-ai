import * as THREE from 'three';

import { resolveMaterial } from './materials';

export function makeThreeMaterialForKey(
  materialKey: string | null | undefined,
  fallbackColor: string,
  opts: { fallbackRoughness?: number; fallbackMetalness?: number } = {},
): THREE.Material {
  const spec = resolveMaterial(materialKey);
  if (spec?.category === 'glass') {
    return new THREE.MeshPhysicalMaterial({
      color: spec.baseColor,
      roughness: spec.roughness,
      metalness: spec.metalness,
      transparent: true,
      opacity: spec.key.includes('spandrel') ? 0.62 : 0.38,
      transmission: spec.key.includes('spandrel') ? 0.35 : 0.9,
      thickness: 0.012,
      ior: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.2,
    });
  }

  const isRenderOrCladding = spec?.category === 'render' || spec?.category === 'cladding';
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec?.baseColor ?? fallbackColor),
    roughness: spec?.roughness ?? opts.fallbackRoughness ?? 0.7,
    metalness: spec?.metalness ?? opts.fallbackMetalness ?? 0,
    envMapIntensity: isRenderOrCladding ? 0.15 : 1.0,
  });
}
