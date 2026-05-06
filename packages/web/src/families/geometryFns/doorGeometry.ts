import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import type { ViewportPaintBundle } from '../../viewport/materials';
import { resolveParam, type FamilyDefinition } from '../types';

export type DoorGeomInput = {
  door:      Extract<Element, { kind: 'door' }>;
  wall:      Extract<Element, { kind: 'wall' }>;
  elevM:     number;
  paint:     ViewportPaintBundle | null;
  familyDef: FamilyDefinition | undefined;
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

export function buildDoorGeometry(input: DoorGeomInput): THREE.Group {
  const { door, wall, paint, familyDef } = input;

  const ip = door.overrideParams;
  const typeEntry = door.familyTypeId
    ? familyDef?.defaultTypes.find(t => t.id === door.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;

  const leafWidthMm  = Number(resolveParam('leafWidthMm',  ip, tp, familyDef, door.widthMm));
  const leafHeightMm = Number(resolveParam('leafHeightMm', ip, tp, familyDef, wall.heightMm * 0.86));
  const frameDepthMm = Number(resolveParam('frameDepthMm', ip, tp, familyDef, wall.thicknessMm));
  const frameSectMm  = Number(resolveParam('frameSectMm',  ip, tp, familyDef, 70));
  const panelThickMm = Number(resolveParam('panelThickMm', ip, tp, familyDef, 45));

  const leafWidth  = THREE.MathUtils.clamp(leafWidthMm  / 1000, 0.35, 4.0);
  const leafHeight = THREE.MathUtils.clamp(leafHeightMm / 1000, 0.60, 2.5);
  const depth      = THREE.MathUtils.clamp(frameDepthMm / 1000, 0.08, 0.5);
  const frameSect  = frameSectMm  / 1000;
  const panelThick = panelThickMm / 1000;

  const frameColor = paint?.categories.door.color ?? FALLBACK_COLOR;
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: paint?.categories.door.roughness ?? 0.70,
    metalness: paint?.categories.door.metalness ?? 0.0,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: paint?.categories.door.roughness ?? 0.70,
  });

  function member(
    w: number, h: number, d: number,
    x: number, y: number,
    mat: THREE.MeshStandardMaterial,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    m.userData.bimPickId = door.id;
    addEdges(m);
    return m;
  }

  const frameGroup = new THREE.Group();
  // head spans full opening width including jambs
  frameGroup.add(member(leafWidth + 2 * frameSect, frameSect, depth, 0, leafHeight + frameSect / 2, frameMat));
  // jamb-L
  frameGroup.add(member(frameSect, leafHeight, depth, -(leafWidth / 2 + frameSect / 2), leafHeight / 2, frameMat));
  // jamb-R
  frameGroup.add(member(frameSect, leafHeight, depth,  (leafWidth / 2 + frameSect / 2), leafHeight / 2, frameMat));

  const panelMesh  = member(leafWidth, leafHeight, panelThick, 0, leafHeight / 2, panelMat);
  // threshold sits at floor level (centre of 0.02 m height = 0.01 m above base)
  const threshMesh = member(leafWidth, 0.02, depth, 0, 0.01, frameMat);

  const group = new THREE.Group();
  group.add(frameGroup, panelMesh, threshMesh);
  group.userData.bimPickId = door.id;
  return group;
}
