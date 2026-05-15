import * as THREE from 'three';

export type PathTraceRenderRole =
  | 'model'
  | 'materializedCutSurface'
  | 'helper'
  | 'overlay'
  | 'hitTarget'
  | 'annotation'
  | 'debug';

export type PathTraceSceneFilterResult = {
  scene: THREE.Scene;
  meshCount: number;
  triangleCount: number;
};

function createPathTraceEnvironment(): THREE.DataTexture {
  const width = 64;
  const height = 32;
  const data = new Float32Array(width * height * 4);
  const sky = new THREE.Color('#d8ecff');
  const horizon = new THREE.Color('#fff8ec');
  const ground = new THREE.Color('#b9ad94');
  const color = new THREE.Color();

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    const t = 1 - v;
    if (t >= 0.5) {
      color.lerpColors(horizon, sky, (t - 0.5) * 2);
    } else {
      color.lerpColors(ground, horizon, t * 2);
    }
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData.bimPathTraceOwned = true;
  return texture;
}

function traceableMaterial(material: THREE.Material): THREE.Material {
  if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial
  ) {
    return material;
  }
  const color =
    material instanceof THREE.MeshBasicMaterial
      ? material.color.clone()
      : new THREE.Color(0.75, 0.75, 0.75);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
  });
}

function materialForTrace(
  material: THREE.Material | THREE.Material[],
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) return material.map(traceableMaterial);
  return traceableMaterial(material);
}

function isExplicitlyTraceable(mesh: THREE.Mesh): boolean {
  const role = mesh.userData.renderRole as PathTraceRenderRole | undefined;
  if (role) return role === 'model' || role === 'materializedCutSurface';
  return false;
}

function triangleCountForGeometry(geometry: THREE.BufferGeometry): number {
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

export function buildPathTraceScene(
  sourceScene: THREE.Scene,
  root: THREE.Object3D,
): PathTraceSceneFilterResult {
  const scene = new THREE.Scene();
  scene.background =
    sourceScene.background instanceof THREE.Color ? sourceScene.background.clone() : null;
  scene.environment = createPathTraceEnvironment();
  scene.environmentIntensity = 0.55;
  scene.fog = null;

  let meshCount = 0;
  let triangleCount = 0;

  sourceScene.children.forEach((child) => {
    if (child instanceof THREE.Light) {
      scene.add(child.clone());
    }
  });

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.visible || !isExplicitlyTraceable(obj)) return;
    const geometry = obj.geometry;
    if (!geometry.getAttribute('position')) return;

    const mesh = new THREE.Mesh(geometry, materialForTrace(obj.material));
    mesh.name = obj.name;
    mesh.castShadow = obj.castShadow;
    mesh.receiveShadow = obj.receiveShadow;
    mesh.visible = true;
    mesh.matrix.copy(obj.matrixWorld);
    mesh.matrixAutoUpdate = false;
    mesh.userData.sourceBimPickId = obj.userData.bimPickId ?? null;
    scene.add(mesh);

    meshCount += 1;
    triangleCount += triangleCountForGeometry(geometry);
  });

  return { scene, meshCount, triangleCount };
}
