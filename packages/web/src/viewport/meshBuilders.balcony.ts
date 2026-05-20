import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { addEdges } from './sceneHelpers';
import { yawForPlanSegment } from './planSegmentOrientation';

export function makeBalconyMesh(
  balcony: Extract<Element, { kind: 'balcony' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = balcony.id;

  const wall = elementsById[balcony.wallId];
  if (wall?.kind !== 'wall') return group;

  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;
  const nx = uz;
  const nz = -ux;
  const yaw = yawForPlanSegment(dx, dz);

  const elevM = balcony.elevationMm / 1000;
  const projM = THREE.MathUtils.clamp((balcony.projectionMm ?? 650) / 1000, 0.1, 3);
  const slabH = THREE.MathUtils.clamp((balcony.slabThicknessMm ?? 150) / 1000, 0.05, 0.5);
  const balH = THREE.MathUtils.clamp((balcony.balustradeHeightMm ?? 1050) / 1000, 0, 2);

  const slabCy = elevM - slabH / 2;
  const slabCx = sx + dx / 2 + (nx * projM) / 2;
  const slabCz = sz + dz / 2 + (nz * projM) / 2;
  const slabMat = new THREE.MeshStandardMaterial({
    color: '#a87a44',
    roughness: 0.85,
    envMapIntensity: 0.15,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, slabH, projM), slabMat);
  slab.position.set(slabCx, slabCy, slabCz);
  slab.rotation.y = yaw;
  addEdges(slab);
  group.add(slab);

  if (balH > 0.01) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xb0d8e8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 0.05,
      metalness: 0.05,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const balThick = 0.025;
    const outerCx = sx + dx / 2 + nx * projM;
    const outerCz = sz + dz / 2 + nz * projM;
    const balGlass = new THREE.Mesh(new THREE.BoxGeometry(len, balH, balThick), glassMat);
    balGlass.position.set(outerCx, elevM + balH / 2, outerCz);
    balGlass.rotation.y = yaw;
    addEdges(balGlass);
    group.add(balGlass);
  }

  void paint;
  return group;
}
