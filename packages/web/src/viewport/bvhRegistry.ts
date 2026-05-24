/**
 * PERF-I05 — viewport raycast acceleration via `three-mesh-bvh`.
 *
 * Three.js's default raycaster walks every Object3D in the scene, then runs a
 * bounding-sphere reject and per-triangle test on each Mesh it visits. On the
 * heavy-house fixture that's the dominant cost of hover/click picking.
 *
 * `three-mesh-bvh` installs a BVH on each mesh's `BufferGeometry` and a
 * replacement raycast on `THREE.Mesh.prototype` that uses it. The trade-off
 * is a one-time BVH build per geometry — only worth it for static meshes
 * picked many times.
 *
 * This module:
 *   1. `installBvhExtensions()` — patches `THREE.Mesh.prototype.raycast` and
 *      `BufferGeometry.prototype.{computeBoundsTree,disposeBoundsTree}`.
 *      Idempotent (safe to call from multiple entry points / hot-reload).
 *   2. `ensureBvhForPickables(root, opts)` — call before each
 *      `raycaster.intersectObjects(root.children, true)` to lazily build a
 *      BVH on each static pickable Mesh that doesn't have one yet. Cheap on
 *      subsequent calls because the result is cached on `mesh.userData`.
 *   3. `disposeBvhForObject(obj)` — release the BVH on a mesh subtree when
 *      it leaves the scene (called from the existing geometry-dispose paths
 *      so we don't leak the BVH buffers).
 *
 * Scope guard: only meshes that the existing `bimPickId` convention marks as
 * pickable element geometry get a BVH. Authoring previews / drag drafts /
 * gizmo handles either don't carry `bimPickId` or explicitly clear it (see
 * `tintWallDraftPreviewObject` in Viewport.tsx) — those are skipped, since
 * the issue calls out ephemeral helpers as not worth the build cost.
 */

import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

type GeometryWithBoundsTree = THREE.BufferGeometry & {
  boundsTree?: unknown;
  computeBoundsTree?: () => void;
  disposeBoundsTree?: () => void;
};

type MeshUserData = {
  bimPickId?: unknown;
  isAuthoringPreview?: unknown;
  bvhBuilt?: boolean;
};

/**
 * Below this triangle count the per-call BVH traversal setup costs more than
 * the savings vs. the default raycaster's per-triangle loop. The number is
 * empirical from three-mesh-bvh's own benchmarks; tweak only if a real
 * profile says so.
 */
const BVH_MIN_TRIANGLES = 32;

let installed = false;

/**
 * Mutate the three.js prototypes so every Mesh routes its raycast through
 * `acceleratedRaycast` and every BufferGeometry can `computeBoundsTree()` /
 * `disposeBoundsTree()`. This is the canonical three-mesh-bvh wiring; doing
 * it here (not at each mesh-build site) keeps the patch idempotent and
 * unambiguous in greps.
 *
 * The accelerated raycast is a strict superset of the default — for a mesh
 * without a `boundsTree` it falls back to the default path, so installing
 * the extension is safe even for meshes we never call `computeBoundsTree`
 * on (e.g. ephemeral helpers).
 */
export function installBvhExtensions(): void {
  if (installed) return;
  const geomProto = THREE.BufferGeometry.prototype as GeometryWithBoundsTree;
  geomProto.computeBoundsTree = computeBoundsTree;
  geomProto.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  installed = true;
}

/** Test-only: reset the install guard so unit tests can assert idempotency. */
export function __resetBvhExtensionsForTests(): void {
  installed = false;
}

function shouldBuildBvhForMesh(mesh: THREE.Mesh): boolean {
  const ud = mesh.userData as MeshUserData;
  // Pickable element meshes only — ephemeral previews/handles either lack
  // bimPickId or set isAuthoringPreview when reusing a real mesh's geometry.
  if (typeof ud.bimPickId !== 'string') return false;
  if (ud.isAuthoringPreview === true) return false;

  const geom = mesh.geometry as GeometryWithBoundsTree | undefined;
  if (!geom) return false;
  // Already built — `computeBoundsTree` is idempotent but the userData flag
  // lets us skip the geometry inspection on hot pointermove paths.
  if (ud.bvhBuilt && geom.boundsTree) return false;

  const index = geom.getIndex();
  const position = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!position) return false;
  const triCount = index ? index.count / 3 : position.count / 3;
  if (triCount < BVH_MIN_TRIANGLES) return false;

  return true;
}

/**
 * Walk a subtree and build BVHs on every static pickable mesh that doesn't
 * already have one. Designed to be called right before a raycast — the
 * traversal is O(N) over scene nodes, but the BVH build itself only fires
 * once per (mesh, geometry) pair and then short-circuits on `bvhBuilt`.
 *
 * Returns the number of BVHs newly built, mostly so tests can assert this
 * happened.
 */
export function ensureBvhForPickables(root: THREE.Object3D): number {
  let built = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (!shouldBuildBvhForMesh(node)) return;
    const geom = node.geometry as GeometryWithBoundsTree;
    geom.computeBoundsTree?.();
    (node.userData as MeshUserData).bvhBuilt = true;
    built += 1;
  });
  return built;
}

/**
 * Release any BVH on a mesh or subtree. Call from the same place that
 * already disposes the mesh's geometry (e.g. the CSG worker reload path in
 * Viewport.tsx around line 790) so the BVH buffers don't outlive the
 * geometry they describe.
 *
 * Safe to call on non-mesh objects and on geometries without a BVH — both
 * become no-ops.
 */
export function disposeBvhForObject(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geom = node.geometry as GeometryWithBoundsTree | undefined;
    if (!geom) return;
    if (geom.boundsTree) geom.disposeBoundsTree?.();
    const ud = node.userData as MeshUserData;
    ud.bvhBuilt = false;
  });
}
