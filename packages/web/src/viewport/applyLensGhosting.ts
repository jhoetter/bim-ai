import * as THREE from 'three';

export const LENS_GHOST_OPACITY = 0.25;

/**
 * DSC-V3-02 — apply or remove the discipline-lens ghost pass to a Three.js object tree.
 *
 * Ghost: transparent at 25% opacity, colour overridden to the CSS draft-witness token.
 * Foreground: original materials restored from userData.lensOriginalMaterials.
 *
 * Idempotent: repeated calls with the same mode are no-ops.
 */
export function applyLensGhosting(
  obj: THREE.Object3D,
  mode: 'foreground' | 'ghost',
  witnessHex: string,
): void {
  const alreadyGhost = Boolean(obj.userData.lensGhost);
  if (mode === 'ghost' && alreadyGhost) return;
  if (mode === 'foreground' && !alreadyGhost) return;

  if (mode === 'ghost') {
    obj.userData.lensGhost = true;
    const tint = new THREE.Color(witnessHex);
    obj.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      const ghostOne = (m: THREE.Material): THREE.Material => {
        const clone = m.clone();
        clone.transparent = true;
        clone.opacity = LENS_GHOST_OPACITY;
        clone.depthWrite = false;
        const anyMat = clone as THREE.Material & { color?: THREE.Color };
        if (anyMat.color instanceof THREE.Color) {
          anyMat.color.copy(tint);
        }
        return clone;
      };
      if (!node.userData.lensOriginalMaterial) {
        node.userData.lensOriginalMaterial = node.material;
      }
      node.material = Array.isArray(mat) ? mat.map(ghostOne) : ghostOne(mat);
    });
  } else {
    obj.userData.lensGhost = false;
    obj.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.lensOriginalMaterial) {
        node.material = node.userData.lensOriginalMaterial as THREE.Material | THREE.Material[];
        delete node.userData.lensOriginalMaterial;
      }
    });
  }
}
