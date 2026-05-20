import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { makePlacedAssetPlanSymbol } from '../viewport/placedAssetRendering';
import { SLICE_Y } from './interaction/planCameraMath';
import { readPlanToken } from './planCanvasHelpers';

export type ComponentGhostInput = {
  activeLevelId: string;
  entry?: Extract<Element, { kind: 'asset_library_entry' }>;
  widthMm: number;
  heightMm: number;
  rotDeg: number;
};

export function tintComponentGhost(ghost: THREE.Group): THREE.Group {
  ghost.traverse((child) => {
    const material = (child as THREE.Mesh | THREE.Line).material;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if ('transparent' in mat) mat.transparent = true;
      if ('opacity' in mat) mat.opacity = Math.min(Number(mat.opacity) || 1, 0.68);
      if ('depthWrite' in mat) mat.depthWrite = false;
    }
  });
  return ghost;
}

export function buildComponentGhost({
  activeLevelId,
  entry,
  widthMm,
  heightMm,
  rotDeg,
}: ComponentGhostInput): THREE.Group {
  if (entry) {
    const asset: Extract<Element, { kind: 'placed_asset' }> = {
      kind: 'placed_asset',
      id: '__component_ghost__',
      name: entry.name,
      assetId: entry.id,
      levelId: activeLevelId,
      positionMm: { xMm: 0, yMm: 0 },
      rotationDeg: rotDeg,
      paramValues: {},
    };
    return tintComponentGhost(
      makePlacedAssetPlanSymbol(asset, entry, {
        y: SLICE_Y + 0.018,
        color: readPlanToken('--draft-construction-blue', '#2563eb'),
        minFootprintM: 1.8,
      }),
    );
  }

  const group = new THREE.Group();
  const halfWidthM = widthMm / 2000;
  const halfDepthM = heightMm / 2000;
  const points = [
    -halfWidthM,
    SLICE_Y,
    -halfDepthM,
    halfWidthM,
    SLICE_Y,
    -halfDepthM,
    halfWidthM,
    SLICE_Y,
    -halfDepthM,
    halfWidthM,
    SLICE_Y,
    halfDepthM,
    halfWidthM,
    SLICE_Y,
    halfDepthM,
    -halfWidthM,
    SLICE_Y,
    halfDepthM,
    -halfWidthM,
    SLICE_Y,
    halfDepthM,
    -halfWidthM,
    SLICE_Y,
    -halfDepthM,
    -halfWidthM,
    SLICE_Y,
    -halfDepthM,
    halfWidthM,
    SLICE_Y,
    halfDepthM,
    halfWidthM,
    SLICE_Y,
    -halfDepthM,
    -halfWidthM,
    SLICE_Y,
    halfDepthM,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x8b7355,
    opacity: 0.6,
    transparent: true,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  group.add(mesh);
  group.rotation.y = (rotDeg * Math.PI) / 180;
  return tintComponentGhost(group);
}
