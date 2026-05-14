import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { makeCsgWallMaterial } from './csgWallMaterial';

describe('CSG wall material replacement', () => {
  it('preserves procedural material maps for realistic mode', () => {
    const { material } = makeCsgWallMaterial({
      materialKey: 'masonry_brick',
      paint: null,
      elementsById: {},
      lenM: 4,
      heightM: 3,
      textureMapsVisible: true,
    });

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const standard = material as THREE.MeshStandardMaterial;
    expect(standard.userData.materialKey).toBe('masonry_brick');
    expect(standard.map?.name).toBe('masonry_brick:procedural:albedo');
    expect(standard.bumpMap?.name).toBe('masonry_brick:procedural:bump');
  });

  it('hides texture maps immediately for shaded mode', () => {
    const { material } = makeCsgWallMaterial({
      materialKey: 'masonry_brick',
      paint: null,
      elementsById: {},
      lenM: 4,
      heightM: 3,
      textureMapsVisible: false,
    });

    const standard = material as THREE.MeshStandardMaterial;
    expect(standard.map).toBeNull();
    expect(standard.bumpMap).toBeNull();
  });
});
