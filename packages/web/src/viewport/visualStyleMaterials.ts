import * as THREE from 'three';

type StoredMaps = {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  bumpMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  metalnessMap: THREE.Texture | null;
};

const MAP_STORE_KEY = 'bimAiStoredTextureMaps';

export function applyMaterialTextureVisibility(material: THREE.Material, visible: boolean): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  const mat = material as THREE.MeshStandardMaterial;
  const stored = mat.userData[MAP_STORE_KEY] as StoredMaps | undefined;
  if (visible) {
    if (!stored) return;
    mat.map = stored.map;
    mat.normalMap = stored.normalMap;
    mat.bumpMap = stored.bumpMap;
    mat.roughnessMap = stored.roughnessMap;
    mat.metalnessMap = stored.metalnessMap;
    delete mat.userData[MAP_STORE_KEY];
    mat.needsUpdate = true;
    return;
  }

  if (!stored) {
    mat.userData[MAP_STORE_KEY] = {
      map: mat.map,
      normalMap: mat.normalMap,
      bumpMap: mat.bumpMap,
      roughnessMap: mat.roughnessMap,
      metalnessMap: mat.metalnessMap,
    } satisfies StoredMaps;
  }
  mat.map = null;
  mat.normalMap = null;
  mat.bumpMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.needsUpdate = true;
}

export function applyTextureVisibilityToMesh(mesh: THREE.Mesh, visible: boolean): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) applyMaterialTextureVisibility(material, visible);
}
