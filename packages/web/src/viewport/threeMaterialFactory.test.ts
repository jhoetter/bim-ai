import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import {
  applyMaterialUvTransform,
  makeThreeMaterialForKey,
  materialUvTransformForExtent,
  MaterialTextureManager,
} from './threeMaterialFactory';

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

  it('uses procedural fallback instead of loading virtual curated texture ids', () => {
    const loads: string[] = [];
    const textureManager = stubTextureManager(loads);
    const first = makeThreeMaterialForKey('asset_brick_running_red', { textureManager });
    const second = makeThreeMaterialForKey('asset_brick_running_red', { textureManager });

    const firstStandard = first as THREE.MeshStandardMaterial;
    const secondStandard = second as THREE.MeshStandardMaterial;
    expect(firstStandard.map).toBeTruthy();
    expect(firstStandard.bumpMap).toBeTruthy();
    expect(firstStandard.normalMap).toBeFalsy();
    expect(firstStandard.map?.name).toBe('asset_brick_running_red:procedural:albedo');
    expect(firstStandard.bumpMap?.name).toBe('asset_brick_running_red:procedural:bump');
    expect(firstStandard.map).toBe(secondStandard.map);
    expect(firstStandard.bumpMap).toBe(secondStandard.bumpMap);
    expect(firstStandard.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(firstStandard.bumpMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(loads).toEqual([]);
    expect(textureManager.size()).toBe(0);
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
    const materialElement: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-cache-test',
      name: 'Cache Test',
      category: 'timber',
      appearance: {
        baseColor: '#885522',
        albedoMapId: 'data:image/png;base64,abc',
      },
    };
    const material = makeThreeMaterialForKey(materialElement.id, {
      elementsById: { [materialElement.id]: materialElement },
      textureManager,
    });
    const map = (material as THREE.MeshStandardMaterial).map!;
    const dispose = vi.spyOn(map, 'dispose');

    textureManager.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(textureManager.size()).toBe(0);
  });

  it('derives real-world brick repeats from material category scale', () => {
    const transform = materialUvTransformForExtent('asset_brick_running_red', {
      extentMm: { uMm: 4000, vMm: 3000 },
    });

    expect(transform?.repeat?.u).toBeCloseTo(4000 / 215);
    expect(transform?.repeat?.v).toBeCloseTo(3000 / 75);
    expect(transform?.rotationRad).toBe(0);
  });

  it('derives vertical cladding repeats from board pitch and full wall height', () => {
    const transform = materialUvTransformForExtent('cladding_beige_grey', {
      extentMm: { uMm: 4000, vMm: 3000 },
    });

    expect(transform?.repeat?.u).toBeCloseTo(4000 / 250);
    expect(transform?.repeat?.v).toBeCloseTo(1);
  });

  it('applies explicit project uv scale, offset, and rotation to textures', () => {
    const projectMaterial: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-project-tile',
      name: 'Project Tile',
      category: 'stone',
      appearance: {
        baseColor: '#bbbbbb',
        uvScaleMm: { uMm: 300, vMm: 600 },
        uvOffsetMm: { uMm: 150, vMm: 300 },
        uvRotationDeg: 90,
      },
    };
    const transform = materialUvTransformForExtent(projectMaterial.id, {
      elementsById: { [projectMaterial.id]: projectMaterial },
      extentMm: { uMm: 1200, vMm: 1800 },
    });
    const texture = applyMaterialUvTransform(new THREE.Texture(), transform);

    expect(transform?.repeat).toEqual({ u: 4, v: 3 });
    expect(texture.repeat.x).toBe(4);
    expect(texture.repeat.y).toBe(3);
    expect(texture.offset.x).toBe(0.5);
    expect(texture.offset.y).toBe(0.5);
    expect(texture.rotation).toBeCloseTo(Math.PI / 2);
  });
});
