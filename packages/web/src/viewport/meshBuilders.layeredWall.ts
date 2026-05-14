/**
 * Layered wall renderer — FL-08.
 *
 * `makeLayeredWallMesh` extrudes each layer of a wall assembly as its
 * own `BoxGeometry`, stacked along the wall normal in spec order, with
 * the cumulative offset honouring the assembly's `basisLine`. Air
 * layers advance the offset but emit no mesh. The exterior-most finish
 * layer with a cladding `materialKey` reuses the existing
 * `addCladdingBoards` helper for board geometry.
 */

import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import {
  type WallTypeAssembly,
  type WallAssemblyLayer,
  materialHexFor,
} from '../families/wallTypeCatalog';
import type { ViewportPaintBundle } from './materials';
import { yawForPlanSegment } from './planSegmentOrientation';
import { addEdges, readToken } from './sceneHelpers';

type WallElem = Extract<Element, { kind: 'wall' }>;

function addCladdingBoardsInline(
  hostMesh: THREE.Mesh,
  wallLenM: number,
  wallHeightM: number,
  wallThickM: number,
  boardWidthMm: number,
  gapMm: number,
  colorOverride: string | undefined,
): void {
  const pitchM = (boardWidthMm + gapMm) / 1000;
  const count = Math.max(1, Math.floor(wallLenM / pitchM));
  const boardProtrude = 0.012;
  const boardH = wallHeightM - 0.05;
  const boardD = pitchM - 0.002;
  const color = colorOverride ?? readToken('--cat-timber-cladding', '#8B6340');
  const isOverride = colorOverride !== undefined;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: isOverride ? 0.92 : 0.85,
    metalness: 0.0,
    envMapIntensity: isOverride ? 0.08 : 1.0,
  });

  for (let i = 0; i < count; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(boardD, boardH, boardProtrude), mat);
    board.position.set((i + 0.5) * pitchM - wallLenM / 2, 0, wallThickM / 2 + boardProtrude / 2);
    addEdges(board);
    hostMesh.add(board);
  }
}

export function darkenHex(hex: string, factor: number): string {
  // factor 0..1: 0 = no change, 1 = black
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, Math.round(parseInt(n.slice(0, 2), 16) * (1 - factor))));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(n.slice(2, 4), 16) * (1 - factor))));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(n.slice(4, 6), 16) * (1 - factor))));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function roughnessFor(layer: WallAssemblyLayer): number {
  switch (layer.function) {
    case 'finish':
      return layer.materialKey === 'timber_cladding' ? 0.9 : 0.85;
    case 'structure':
      return 0.8;
    case 'insulation':
      return 0.95;
    case 'membrane':
      return 0.6;
    default:
      return 0.85;
  }
}

function offsetForBasis(basis: WallTypeAssembly['basisLine'], totalThickM: number): number {
  // Distance along the wall normal from the wall's centerline to the start
  // (interior face) of the layer stack. Positive moves toward the exterior.
  switch (basis) {
    case 'face_interior':
      return -totalThickM / 2;
    case 'face_exterior':
      return totalThickM / 2;
    default:
      return -totalThickM / 2;
  }
}

export function makeLayeredWallMesh(
  wall: WallElem,
  assembly: WallTypeAssembly,
  elevM: number,
  paint: ViewportPaintBundle | null,
  _elementsById?: Record<string, Element>,
): THREE.Group {
  void paint;
  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const baseOff = (wall.baseConstraintOffsetMm ?? 0) / 1000;
  const yBase = elevM + baseOff;
  const heightM = THREE.MathUtils.clamp(wall.heightMm / 1000, 0.25, 40);
  const yaw = yawForPlanSegment(dx, dz);

  const totalThickM = assembly.layers.reduce((acc, l) => acc + l.thicknessMm, 0) / 1000;

  // Wall-perp unit vector (rotates with yaw): from start.tangent (dx,dz) to perp (-dz,dx)
  const nx = -dz / len;
  const nz = dx / len;
  const cx = sx + dx / 2;
  const cz = sz + dz / 2;

  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;

  // Start offset along normal at the interior face of the stack.
  const startNormalOffM = offsetForBasis(assembly.basisLine, totalThickM);

  let cursorM = startNormalOffM;
  const exteriorFinishKey = assembly.layers.find(
    (l) => l.function === 'finish' && l.exterior,
  )?.materialKey;

  for (const layer of assembly.layers) {
    const thickM = layer.thicknessMm / 1000;
    if (layer.function === 'air') {
      cursorM += thickM;
      continue;
    }
    const layerCenterOff = cursorM + thickM / 2;
    const px = cx + nx * layerCenterOff;
    const pz = cz + nz * layerCenterOff;

    const colorHex = materialHexFor(layer.materialKey);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: roughnessFor(layer),
      metalness: 0,
    });
    const geom = new THREE.BoxGeometry(len, heightM, thickM);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(px, yBase + heightM / 2, pz);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bimPickId = wall.id;
    mesh.userData.layerName = layer.name;
    addEdges(mesh);

    if (
      layer.exterior &&
      layer.function === 'finish' &&
      (layer.materialKey === 'timber_cladding' || layer.materialKey === 'white_cladding') &&
      layer.materialKey === exteriorFinishKey
    ) {
      const boardColor = layer.materialKey === 'white_cladding' ? '#f4f4f0' : undefined;
      addCladdingBoardsInline(mesh, len, heightM, thickM, 150, 8, boardColor);
    }

    group.add(mesh);
    cursorM += thickM;
  }

  return group;
}
