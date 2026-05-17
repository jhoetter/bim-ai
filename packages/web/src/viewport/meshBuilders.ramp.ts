import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { categoryColorOr, addEdges } from './sceneHelpers';
import type { ViewportPaintBundle } from './materials';
import { elevationMForLevel } from './meshBuilders';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

type RampElem = Extract<Element, { kind: 'ramp' }>;

const RAMP_SURFACE_THICKNESS = 0.02;

/**
 * Build a 3-D mesh for a ramp element.
 *
 * Geometry: sloped top surface + underside + four side faces.
 * Optional railing edge lines when hasRailingLeft/hasRailingRight are set.
 */
export function makeRampMesh(
  ramp: RampElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();

  const baseElev = elevationMForLevel(ramp.levelId, elementsById);
  const topElev = elevationMForLevel(ramp.topLevelId, elementsById);

  const runM = Math.max(ramp.runMm / 1000, 0.1);
  const widthM = Math.max(ramp.widthMm / 1000, 0.3);

  const anglRad = THREE.MathUtils.degToRad(ramp.runAngleDeg);
  const cosA = Math.cos(anglRad);
  const sinA = Math.sin(anglRad);
  const perpX = -sinA;
  const perpZ = cosA;

  const ox = ramp.insertionXMm / 1000;
  const oz = ramp.insertionYMm / 1000;
  const hw = widthM / 2;

  const BL = new THREE.Vector3(ox - hw * perpX, baseElev + RAMP_SURFACE_THICKNESS, oz - hw * perpZ);
  const BR = new THREE.Vector3(ox + hw * perpX, baseElev + RAMP_SURFACE_THICKNESS, oz + hw * perpZ);
  const TL = new THREE.Vector3(
    ox - hw * perpX + runM * cosA,
    topElev,
    oz - hw * perpZ + runM * sinA,
  );
  const TR = new THREE.Vector3(
    ox + hw * perpX + runM * cosA,
    topElev,
    oz + hw * perpZ + runM * sinA,
  );
  const BLu = new THREE.Vector3(BL.x, baseElev, BL.z);
  const BRu = new THREE.Vector3(BR.x, baseElev, BR.z);
  const TLu = new THREE.Vector3(TL.x, topElev - RAMP_SURFACE_THICKNESS, TL.z);
  const TRu = new THREE.Vector3(TR.x, topElev - RAMP_SURFACE_THICKNESS, TR.z);

  const material = makeThreeMaterialForKey(ramp.material ?? null, {
    elementsById,
    usage: 'generic',
    fallbackColor: categoryColorOr(paint, 'floor'),
    fallbackRoughness: 0.85,
    fallbackMetalness: 0,
  });

  function addQuad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): void {
    const positions = new Float32Array([
      a.x,
      a.y,
      a.z,
      b.x,
      b.y,
      b.z,
      c.x,
      c.y,
      c.z,
      a.x,
      a.y,
      a.z,
      c.x,
      c.y,
      c.z,
      d.x,
      d.y,
      d.z,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bimPickId = ramp.id;
    addEdges(mesh);
    group.add(mesh);
  }

  addQuad(BL, BR, TR, TL);
  addQuad(BLu, TLu, TRu, BRu);
  addQuad(BLu, BL, TL, TLu);
  addQuad(BRu, TRu, TR, BR);
  addQuad(BLu, BRu, BR, BL);
  addQuad(TLu, TL, TR, TRu);

  const railMat = new THREE.LineBasicMaterial({ color: 0x64748b });
  const railY = 0.9;

  if (ramp.hasRailingLeft) {
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(BL.x, BL.y + railY, BL.z),
          new THREE.Vector3(TL.x, TL.y + railY, TL.z),
        ]),
        railMat,
      ),
    );
  }

  if (ramp.hasRailingRight) {
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(BR.x, BR.y + railY, BR.z),
          new THREE.Vector3(TR.x, TR.y + railY, TR.z),
        ]),
        railMat,
      ),
    );
  }

  group.userData.bimPickId = ramp.id;
  return group;
}

/**
 * Build a simple THREE.Mesh for a ramp element (§8.7 grammar-based placement).
 * Returns a single mesh (not a Group) for wiring via the meshBuilders switch.
 */
export function buildRampMesh(el: RampElem): THREE.Mesh {
  const runM = Math.max(el.runMm / 1000, 0.1);
  const widthM = Math.max(el.widthMm / 1000, 0.3);
  const rise = runM * (el.slopePercent / 100);
  const slabThicknessM = 0.15;
  const hw = widthM / 2;

  const positions = new Float32Array([
    0,
    0,
    -hw,
    runM,
    rise,
    -hw,
    runM,
    rise,
    hw,
    0,
    0,
    hw,
    0,
    -slabThicknessM,
    -hw,
    runM,
    rise - slabThicknessM,
    -hw,
    runM,
    rise - slabThicknessM,
    hw,
    0,
    -slabThicknessM,
    hw,
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2, 0, 4, 5, 0, 5, 1, 3, 2,
    6, 3, 6, 7,
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: '#c4a882', roughness: 0.7 });
  const mesh = new THREE.Mesh(geom, mat);

  const anglRad = THREE.MathUtils.degToRad(el.runAngleDeg);
  mesh.position.set(el.insertionXMm / 1000, 0, el.insertionYMm / 1000);
  mesh.rotation.y = -anglRad;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.bimPickId = el.id;
  return mesh;
}
