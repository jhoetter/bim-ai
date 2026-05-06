import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import type { ViewportPaintBundle } from '../../viewport/materials';
import { resolveParam, type FamilyDefinition } from '../types';

export type StairGeomInput = {
  stair:          Extract<Element, { kind: 'stair' }>;
  baseLevelElevM: number;
  topLevelElevM:  number;
  paint:          ViewportPaintBundle | null;
  familyDef:      FamilyDefinition | undefined;
};

const FALLBACK_COLOR = '#cbd5e1';

function addEdges(mesh: THREE.Mesh): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: '#1a1a1a', linewidth: 1 }),
  );
  lines.renderOrder = 1;
  mesh.add(lines);
}

export function buildStairGeometry(input: StairGeomInput): THREE.Group {
  const { stair, baseLevelElevM, topLevelElevM, paint, familyDef } = input;

  const ip = stair.overrideParams;
  const typeEntry = stair.overrideParams?.familyTypeId
    ? familyDef?.defaultTypes.find(t => t.id === stair.overrideParams?.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;

  const widthMm  = THREE.MathUtils.clamp(
    Number(resolveParam('widthMm',  ip, tp, familyDef, stair.widthMm)),
    300, 4000,
  );
  const riserMm  = Number(resolveParam('riserMm',  ip, tp, familyDef, stair.riserMm > 0 ? stair.riserMm : 175));
  // treadMm is informational; actual tread depth = runLen / riserCount
  Number(resolveParam('treadMm', ip, tp, familyDef, stair.treadMm));

  const group = new THREE.Group();

  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const runLen = Math.max(1e-3, Math.hypot(dx, dz));
  const stairWidth = widthMm / 1000;

  const totalRise = Math.max(Math.abs(topLevelElevM - baseLevelElevM), 0.1);

  const riserCount = Math.max(
    Math.round((totalRise * 1000) / (riserMm > 0 ? riserMm : 175)),
    2,
  );
  const riserH = totalRise / riserCount;
  const treadDepth = runLen / riserCount;
  const treadThick = 0.040;
  const angle = Math.atan2(dz, dx);

  const mat = new THREE.MeshStandardMaterial({
    color: paint?.categories.stair.color ?? FALLBACK_COLOR,
    roughness: paint?.categories.stair.roughness ?? 0.85,
  });

  const treadGeom = new THREE.BoxGeometry(treadDepth, treadThick, stairWidth);
  for (let i = 0; i < riserCount; i++) {
    const treadMesh = new THREE.Mesh(treadGeom, mat);
    const cx = sx + ((i + 0.5) / riserCount) * dx;
    const cz = sz + ((i + 0.5) / riserCount) * dz;
    const cy = baseLevelElevM + (i + 1) * riserH - treadThick / 2;
    treadMesh.position.set(cx, cy, cz);
    treadMesh.rotation.y = angle;
    treadMesh.castShadow = true;
    treadMesh.receiveShadow = true;
    treadMesh.userData.bimPickId = stair.id;
    addEdges(treadMesh);
    group.add(treadMesh);
  }

  const stringerGeom = new THREE.BoxGeometry(runLen, totalRise, 0.025);
  const midCx = (sx + ex) / 2;
  const midCz = (sz + ez) / 2;
  const midCy = baseLevelElevM + totalRise / 2;
  const perpX = dz / runLen;
  const perpZ = dx / runLen;

  for (const side of [-1, 1] as const) {
    const stringer = new THREE.Mesh(stringerGeom, mat);
    stringer.position.set(
      midCx + perpX * side * (stairWidth / 2),
      midCy,
      midCz + perpZ * side * (stairWidth / 2),
    );
    stringer.rotation.y = angle;
    stringer.castShadow = true;
    stringer.receiveShadow = true;
    stringer.userData.bimPickId = stair.id;
    addEdges(stringer);
    group.add(stringer);
  }

  group.userData.bimPickId = stair.id;
  return group;
}
