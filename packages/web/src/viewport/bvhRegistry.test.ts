import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  __resetBvhExtensionsForTests,
  disposeBvhForObject,
  ensureBvhForPickables,
  installBvhExtensions,
} from './bvhRegistry';

/**
 * PERF-I05 — `bvhRegistry` covers the prototype patch (idempotent), the
 * lazy-build picker preflight, and disposal. The behavioral guarantee is
 * that a BVH-accelerated raycast returns the same hit object as the
 * default raycaster on a known scene — exercised here against a denser
 * sphere (above the BVH triangle threshold) so we actually take the
 * accelerated path.
 */

type GeomWithBoundsTree = THREE.BufferGeometry & { boundsTree?: unknown };

function makeStaticPickableMesh(id: string): THREE.Mesh {
  // SphereGeometry(1, 16, 16) → ~480 triangles, comfortably above the
  // BVH_MIN_TRIANGLES threshold so the registry actually builds a BVH.
  const geom = new THREE.SphereGeometry(1, 16, 16);
  const mat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.bimPickId = id;
  return mesh;
}

describe('PERF-I05 bvhRegistry', () => {
  beforeEach(() => {
    __resetBvhExtensionsForTests();
  });

  it('installBvhExtensions patches prototypes and is idempotent', () => {
    installBvhExtensions();
    const geom = new THREE.BufferGeometry() as GeomWithBoundsTree & {
      computeBoundsTree?: () => void;
      disposeBoundsTree?: () => void;
    };
    expect(typeof geom.computeBoundsTree).toBe('function');
    expect(typeof geom.disposeBoundsTree).toBe('function');

    const raycastRef = THREE.Mesh.prototype.raycast;
    installBvhExtensions();
    // Second call must not replace the raycast fn (idempotent).
    expect(THREE.Mesh.prototype.raycast).toBe(raycastRef);
  });

  it('ensureBvhForPickables builds a BVH on static pickable meshes', () => {
    installBvhExtensions();
    const root = new THREE.Group();
    const mesh = makeStaticPickableMesh('elem-1');
    root.add(mesh);

    const built = ensureBvhForPickables(root);
    expect(built).toBe(1);
    expect((mesh.geometry as GeomWithBoundsTree).boundsTree).toBeDefined();
    expect(mesh.userData.bvhBuilt).toBe(true);

    // Second pass over the same scene must not rebuild.
    const builtAgain = ensureBvhForPickables(root);
    expect(builtAgain).toBe(0);
  });

  it('skips meshes without bimPickId and authoring-preview meshes', () => {
    installBvhExtensions();
    const root = new THREE.Group();

    const noPickId = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshBasicMaterial(),
    );
    const preview = makeStaticPickableMesh('preview-1');
    preview.userData.isAuthoringPreview = true;

    root.add(noPickId, preview);

    expect(ensureBvhForPickables(root)).toBe(0);
    expect((noPickId.geometry as GeomWithBoundsTree).boundsTree).toBeUndefined();
    expect((preview.geometry as GeomWithBoundsTree).boundsTree).toBeUndefined();
  });

  it('skips meshes below the triangle threshold (tiny gizmos)', () => {
    installBvhExtensions();
    const root = new THREE.Group();
    // Default BoxGeometry → 12 triangles, below BVH_MIN_TRIANGLES (32).
    const tiny = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    tiny.userData.bimPickId = 'tiny-elem';
    root.add(tiny);

    expect(ensureBvhForPickables(root)).toBe(0);
    expect((tiny.geometry as GeomWithBoundsTree).boundsTree).toBeUndefined();
  });

  it('disposeBvhForObject releases the BVH and clears the flag', () => {
    installBvhExtensions();
    const root = new THREE.Group();
    const mesh = makeStaticPickableMesh('elem-1');
    root.add(mesh);
    ensureBvhForPickables(root);

    disposeBvhForObject(mesh);
    // three-mesh-bvh's `disposeBoundsTree` sets `geometry.boundsTree = null`
    // (it doesn't `delete` the property), so assert "no tree" rather than
    // strict undefined.
    expect((mesh.geometry as GeomWithBoundsTree).boundsTree ?? null).toBeNull();
    expect(mesh.userData.bvhBuilt).toBe(false);
  });

  it('accelerated raycast returns the same bimPickId as the default path', () => {
    installBvhExtensions();

    const root = new THREE.Group();
    const a = makeStaticPickableMesh('elem-a');
    a.position.set(-2, 0, 0);
    const b = makeStaticPickableMesh('elem-b');
    b.position.set(2, 0, 0);
    root.add(a, b);
    root.updateMatrixWorld(true);

    ensureBvhForPickables(root);
    expect((a.geometry as GeomWithBoundsTree).boundsTree).toBeDefined();
    expect((b.geometry as GeomWithBoundsTree).boundsTree).toBeDefined();

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(2, 0, 10), new THREE.Vector3(0, 0, -1));
    const hits = raycaster.intersectObjects(root.children, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.userData.bimPickId).toBe('elem-b');
  });
});
