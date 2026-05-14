import { describe, expect, it, afterEach } from 'vitest';
import * as THREE from 'three';

import { resolveMaterial } from './materials';
import { clearProceduralMaterialCache, createProceduralMaterialMaps } from './proceduralMaterials';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

function uniqueByteCount(texture: THREE.DataTexture): number {
  return new Set(texture.image.data as Uint8Array).size;
}

describe('procedural material maps', () => {
  afterEach(() => clearProceduralMaterialCache());

  it('creates deterministic non-uniform brick albedo and bump maps without DOM canvas', () => {
    const spec = resolveMaterial('brick_red')!;
    const first = createProceduralMaterialMaps(spec, undefined, 32)!;
    const second = createProceduralMaterialMaps(spec, undefined, 32)!;

    expect(first).toBe(second);
    expect(first.map).toBeInstanceOf(THREE.DataTexture);
    expect(first.map.image.width).toBe(32);
    expect(first.map.image.height).toBe(32);
    expect(first.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(first.map.magFilter).toBe(THREE.LinearFilter);
    expect(first.map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(first.map.generateMipmaps).toBe(true);
    expect(first.bumpMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(uniqueByteCount(first.map)).toBeGreaterThan(12);
    expect(uniqueByteCount(first.bumpMap)).toBeGreaterThan(2);
  });

  it('creates different procedural structure for concrete, timber, stone, and metal roof', () => {
    for (const key of [
      'concrete_smooth',
      'timber_cladding',
      'stone_limestone',
      'metal_standing_seam_dark_grey',
    ]) {
      const maps = createProceduralMaterialMaps(resolveMaterial(key)!, undefined, 32)!;
      expect(uniqueByteCount(maps.map)).toBeGreaterThan(6);
      expect(uniqueByteCount(maps.roughnessMap)).toBeGreaterThan(1);
    }
  });

  it('supplies procedural fallback maps through the material factory when no asset URLs exist', () => {
    const material = makeThreeMaterialForKey('masonry_brick', {
      fallbackColor: '#999999',
    }) as THREE.MeshStandardMaterial;

    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect(material.bumpMap).toBeInstanceOf(THREE.DataTexture);
    expect(material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    expect(material.map?.name).toBe('masonry_brick:procedural:albedo');
  });
});
