import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { MaterialTextureManager } from './threeMaterialFactory';
import { MATERIAL_QA_GALLERY, buildMaterialQaEvidence } from './materialQaGallery';

function textureManagerStub(): MaterialTextureManager {
  return new MaterialTextureManager({
    loader: {
      load: (url: string) => {
        const texture = new THREE.Texture();
        texture.name = url;
        return texture;
      },
    },
  });
}

describe('material QA gallery evidence — MAT-13', () => {
  it('covers the required architectural material scene samples', () => {
    expect(MATERIAL_QA_GALLERY.map((sample) => sample.id)).toEqual([
      'brick-wall',
      'concrete-slab',
      'timber-beam',
      'glass-window',
      'metal-roof',
      'painted-wall',
      'floor-tile',
    ]);
  });

  it('flags procedural materials as non-flat and verifies transparent glass', () => {
    const evidence = buildMaterialQaEvidence({ textureManager: textureManagerStub() });
    expect(evidence.format).toBe('materialQaGalleryEvidence_v1');

    const byId = Object.fromEntries(evidence.samples.map((sample) => [sample.id, sample]));
    expect(byId['brick-wall']?.renderPath).toBe('procedural');
    expect(byId['brick-wall']?.hasAlbedoMap).toBe(true);
    expect(byId['brick-wall']?.hasReliefMap).toBe(true);
    expect(byId['brick-wall']?.albedoUniqueByteCount).toBeGreaterThan(8);
    expect(byId['concrete-slab']?.renderPath).toBe('procedural');
    expect(byId['timber-beam']?.renderPath).toBe('procedural');
    expect(byId['metal-roof']?.renderPath).toBe('procedural');
    expect(byId['painted-wall']?.renderPath).toBe('procedural');
    expect(byId['glass-window']?.renderPath).toBe('transparent');
    expect(byId['glass-window']?.transparent).toBe(true);
    expect(byId['glass-window']?.opacity).toBeLessThan(1);
    expect(byId['floor-tile']?.renderPath).toBe('texture');
    expect(byId['floor-tile']?.hasAlbedoMap).toBe(true);
  });
});
