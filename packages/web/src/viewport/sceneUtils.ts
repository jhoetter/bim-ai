import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type ViewerCatKey =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'door'
  | 'window'
  | 'room'
  | 'railing'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'family_instance'
  | 'placed_asset'
  | 'mass'
  | 'reference_plane'
  | 'text_3d'
  | 'sweep'
  | 'dormer'
  | 'site'
  | 'site_origin';

export function elemViewerCategory(e: Element): ViewerCatKey | null {
  switch (e.kind) {
    case 'wall':
      return 'wall';
    case 'floor':
      return 'floor';
    case 'roof':
      return 'roof';
    case 'stair':
      return 'stair';
    case 'door':
      return 'door';
    case 'window':
      return 'window';
    case 'room':
      return 'room';
    case 'railing':
      return 'railing';
    case 'column':
      return 'column';
    case 'beam':
      return 'beam';
    case 'ceiling':
      return 'ceiling';
    case 'family_instance':
      return 'family_instance';
    case 'placed_asset':
      return 'placed_asset';
    case 'mass':
      return 'mass';
    case 'reference_plane':
      return 'reference_plane';
    case 'text_3d':
      return 'text_3d';
    case 'sweep':
      return 'sweep';
    case 'dormer':
      return 'dormer';
    case 'balcony':
      return 'floor';
    case 'site':
      return 'site';
    case 'internal_origin':
    case 'project_base_point':
    case 'survey_point':
      return 'site_origin';
    default:
      return null;
  }
}

export function computeRootBoundingBox(
  root: THREE.Object3D,
): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null {
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return null;
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

export function aabbWireframeVertices(
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): THREE.Vector3[] {
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  const c000 = v(min.x, min.y, min.z);
  const c100 = v(max.x, min.y, min.z);
  const c010 = v(min.x, max.y, min.z);
  const c110 = v(max.x, max.y, min.z);
  const c001 = v(min.x, min.y, max.z);
  const c101 = v(max.x, min.y, max.z);
  const c011 = v(min.x, max.y, max.z);
  const c111 = v(max.x, max.y, max.z);
  // 12 edges as vertex pairs.
  return [
    c000,
    c100,
    c100,
    c110,
    c110,
    c010,
    c010,
    c000,
    c001,
    c101,
    c101,
    c111,
    c111,
    c011,
    c011,
    c001,
    c000,
    c001,
    c100,
    c101,
    c110,
    c111,
    c010,
    c011,
  ];
}

export function applyClippingPlanesToMeshes(root: THREE.Object3D, planes: THREE.Plane[]) {
  if (!planes.length) return;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      const m = mesh.material.clone();
      m.clippingPlanes = planes.slice();
      mesh.material = m;
    }
  });
}

export function makeClipPlaneCap(plane: THREE.Plane, capColor: string): THREE.Mesh {
  const capGeom = new THREE.PlaneGeometry(500, 500);
  const capMat = new THREE.MeshBasicMaterial({
    color: capColor,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
    depthWrite: false,
  });
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.renderOrder = 2;
  cap.userData.isClipCap = true;

  cap.onBeforeRender = () => {
    cap.position.copy(plane.normal).multiplyScalar(-plane.constant);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      plane.normal.clone().negate(),
    );
    cap.quaternion.copy(quat);
  };
  return cap;
}
