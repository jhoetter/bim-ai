import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type FamilyExtrusionEl = Extract<Element, { kind: 'family_extrusion' }>;

/**
 * Builds a rectangular window frame mesh:
 * outer rectangle minus inner rectangle = frame profile, extruded to depthMm.
 */
export function buildWindowFrameMesh(el: FamilyExtrusionEl): THREE.Mesh {
  const outerW = ((el as any).widthMm ?? 900) / 1000;
  const outerH = ((el as any).heightMm ?? 1200) / 1000;
  const frameW = ((el as any).frameInnerWidthMm ?? 50) / 1000;
  const depth = ((el as any).depthMm ?? 100) / 1000;

  const outerShape = new THREE.Shape();
  outerShape.moveTo(-outerW / 2, 0);
  outerShape.lineTo(outerW / 2, 0);
  outerShape.lineTo(outerW / 2, outerH);
  outerShape.lineTo(-outerW / 2, outerH);
  outerShape.closePath();

  // Inner hole
  const innerHole = new THREE.Path();
  innerHole.moveTo(-outerW / 2 + frameW, frameW);
  innerHole.lineTo(outerW / 2 - frameW, frameW);
  innerHole.lineTo(outerW / 2 - frameW, outerH - frameW);
  innerHole.lineTo(-outerW / 2 + frameW, outerH - frameW);
  innerHole.closePath();
  outerShape.holes.push(innerHole);

  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth,
    bevelEnabled: false,
  });
  const mat = new THREE.MeshStandardMaterial({ color: '#d4c5a9', roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/**
 * Builds a glazing panel mesh: thin flat rectangle of glass material.
 */
export function buildGlazingMesh(el: FamilyExtrusionEl): THREE.Mesh {
  const outerW = ((el as any).widthMm ?? 900) / 1000;
  const outerH = ((el as any).heightMm ?? 1200) / 1000;
  const frameW = ((el as any).frameInnerWidthMm ?? 50) / 1000;
  const glassThickness = 0.006; // 6mm glass

  const geo = new THREE.BoxGeometry(outerW - frameW * 2, outerH - frameW * 2, glassThickness);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#a8d8ea',
    transparent: true,
    opacity: 0.35,
    roughness: 0,
    metalness: 0.1,
    transmission: 0.8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, (outerH - frameW * 2) / 2 + frameW, glassThickness / 2);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
