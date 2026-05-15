import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { collectPathTraceSceneStats, detectPathTraceCapability } from './capabilities';

describe('path trace capabilities', () => {
  it('collects scene complexity from visible meshes and material maps', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    root.add(mesh);

    const stats = collectPathTraceSceneStats(root);

    expect(stats.meshCount).toBe(1);
    expect(stats.triangleCount).toBe(12);
    expect(stats.materialCount).toBe(1);
    expect(stats.textureCount).toBe(1);
  });

  it('marks path tracing unsupported without WebGL2', () => {
    const capability = detectPathTraceCapability(null, {
      triangleCount: 12,
      meshCount: 1,
      materialCount: 1,
      textureCount: 0,
      activeClipping: false,
    });

    expect(capability.status).toBe('unsupported');
    expect(capability.reason).toContain('WebGL2');
  });

  it('marks active clipping unsupported even before scene upload', () => {
    const capability = detectPathTraceCapability(
      {
        domElement: {
          getContext: () => ({
            getExtension: () => ({}),
            getParameter: () => 16384,
            MAX_TEXTURE_SIZE: 0x0d33,
          }),
        },
      } as unknown as THREE.WebGLRenderer,
      {
        triangleCount: 12,
        meshCount: 1,
        materialCount: 1,
        textureCount: 0,
        activeClipping: true,
      },
    );

    expect(capability.status).toBe('unsupported');
    expect(capability.reason).toContain('clipping');
  });
});
