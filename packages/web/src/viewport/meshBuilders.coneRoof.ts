import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type ConicalRoofEl = Extract<Element, { kind: 'conical_roof' }>;
type DomeRoofEl = Extract<Element, { kind: 'dome_roof' }>;
type SpireRoofEl = Extract<Element, { kind: 'spire_roof' }>;

/** Builds a LatheGeometry cone with an open bottom. */
export function buildConicalRoofMesh(el: ConicalRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const hM = el.heightMm / 1000;
  const baseM = el.baseElevationMm / 1000;
  const points = [new THREE.Vector2(rM, 0), new THREE.Vector2(0, hM)];
  const geo = new THREE.LatheGeometry(points, 32);
  const mat = new THREE.MeshStandardMaterial({ color: '#8b6363', roughness: 0.7, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/** Builds a partial sphere (SphereGeometry sliced at equator). */
export function buildDomeRoofMesh(el: DomeRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const rise = Math.max(0.1, Math.min(1.0, el.riseRatio));
  const points: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2) * rise;
    points.push(new THREE.Vector2(Math.cos(t) * rM, Math.sin(t) * rM));
  }
  const geo = new THREE.LatheGeometry(points, 32);
  const mat = new THREE.MeshStandardMaterial({ color: '#7a8ea0', roughness: 0.5, metalness: 0.2 });
  const baseM = el.baseElevationMm / 1000;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/** Very tall narrow cone. */
export function buildSpireRoofMesh(el: SpireRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const hM = el.heightMm / 1000;
  const baseM = el.baseElevationMm / 1000;
  const points = [
    new THREE.Vector2(rM, 0),
    new THREE.Vector2(0.01, hM * 0.85),
    new THREE.Vector2(0, hM),
  ];
  const geo = new THREE.LatheGeometry(points, 16);
  const mat = new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.5, metalness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
