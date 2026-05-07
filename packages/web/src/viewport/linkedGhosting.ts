import * as THREE from 'three';

/**
 * FED-01 — ghost a linked element's mesh tree.
 *
 * Linked elements (id prefixed `<linkId>::<sourceElemId>` by the
 * snapshot-expansion path) need to be visible but visibly de-emphasised so
 * the user reads them as read-only context, not host-authored geometry.
 *
 * Implementation: clone each material, dial the clone to a translucent blue
 * tint, and replace the mesh's material reference. We clone rather than
 * mutate because meshBuilders cache materials by reference; mutating in
 * place would ghost host meshes that share the same material.
 *
 * Idempotent — guarded by `userData.linkedGhost`.
 */

export const LINKED_GHOST_OPACITY = 0.6;
export const LINKED_GHOST_TINT = '#5b8def';

export function applyLinkedGhosting(obj: THREE.Object3D): void {
  if (obj.userData.linkedGhost) return;
  obj.userData.linkedGhost = true;
  obj.userData.linked = true;
  const tint = new THREE.Color(LINKED_GHOST_TINT);
  obj.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mat = node.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const ghostOne = (m: THREE.Material): THREE.Material => {
      const clone = m.clone();
      clone.transparent = true;
      clone.opacity = LINKED_GHOST_OPACITY;
      clone.depthWrite = false;
      const anyMat = clone as THREE.Material & { color?: THREE.Color };
      if (anyMat.color instanceof THREE.Color) {
        anyMat.color.lerp(tint, 0.4);
      }
      return clone;
    };
    if (Array.isArray(mat)) {
      node.material = mat.map(ghostOne);
    } else {
      node.material = ghostOne(mat);
    }
  });
}
