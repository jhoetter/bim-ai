import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { makeThreeMaterialForKey, MaterialTextureManager } from './threeMaterialFactory';

function stubTextureManager(loads: string[] = []): MaterialTextureManager {
  return new MaterialTextureManager({
    maxAnisotropy: 8,
    assetUrlResolver: (asset) => `asset://${asset}`,
    loader: {
      load: (url: string) => {
        loads.push(url);
        const texture = new THREE.Texture();
        texture.name = url;
        return texture;
      },
    },
  });
}

describe('three material factory', () => {
  it('creates a color-only standard material for unknown keys', () => {
    const material = makeThreeMaterialForKey('missing-material', {
      fallbackColor: '#336699',
      fallbackRoughness: 0.44,
      fallbackMetalness: 0.12,
    });

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((material as THREE.MeshStandardMaterial).color.getHexString()).toBe('336699');
    expect((material as THREE.MeshStandardMaterial).roughness).toBe(0.44);
    expect((material as THREE.MeshStandardMaterial).metalness).toBe(0.12);
    expect(material.userData.materialResolved).toBe(false);
  });

  it('creates physical glass with transparent depth settings', () => {
    const material = makeThreeMaterialForKey('asset_clear_glass_double', {
      textureManager: stubTextureManager(),
    });

    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect((material as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0.8);
  });

  it('loads albedo and bump maps through a shared texture cache', () => {
    const loads: string[] = [];
    const textureManager = stubTextureManager(loads);
    const first = makeThreeMaterialForKey('asset_brick_running_red', { textureManager });
    const second = makeThreeMaterialForKey('asset_brick_running_red', { textureManager });

    const firstStandard = first as THREE.MeshStandardMaterial;
    const secondStandard = second as THREE.MeshStandardMaterial;
    expect(firstStandard.map).toBeTruthy();
    expect(firstStandard.bumpMap).toBeTruthy();
    expect(firstStandard.normalMap).toBeFalsy();
    expect(firstStandard.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(firstStandard.bumpMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(firstStandard.map).toBe(secondStandard.map);
    expect(firstStandard.bumpMap).toBe(secondStandard.bumpMap);
    expect(loads).toEqual([
      'asset://library/masonry/brick-running-red-albedo',
      'asset://library/masonry/brick-running-red-bump',
    ]);
    expect(textureManager.size()).toBe(2);
  });

  it('prefers normal maps over bump maps for project material elements', () => {
    const loads: string[] = [];
    const textureManager = stubTextureManager(loads);
    const materialElement: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-project-normal',
      name: 'Project Normal Brick',
      category: 'brick',
      appearance: {
        baseColor: '#884422',
        albedoMapId: 'project/brick/albedo',
        normalMapId: 'project/brick/normal',
        heightMapId: 'project/brick/height',
        roughnessMapId: 'project/brick/roughness',
        metallicMapId: 'project/brick/metal',
      },
    };

    const material = makeThreeMaterialForKey(materialElement.id, {
      elementsById: { [materialElement.id]: materialElement },
      textureManager,
    }) as THREE.MeshStandardMaterial;

    expect(material.map?.name).toBe('project/brick/albedo');
    expect(material.normalMap?.name).toBe('project/brick/normal');
    expect(material.bumpMap).toBeFalsy();
    expect(material.roughnessMap?.name).toBe('project/brick/roughness');
    expect(material.metalnessMap?.name).toBe('project/brick/metal');
    expect(loads).not.toContain('asset://project/brick/height');
  });

  it('disposes cached textures', () => {
    const textureManager = stubTextureManager();
    const material = makeThreeMaterialForKey('asset_oak_plank_satin', { textureManager });
    const map = (material as THREE.MeshStandardMaterial).map!;
    const dispose = vi.spyOn(map, 'dispose');

    textureManager.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(textureManager.size()).toBe(0);
  });
});
