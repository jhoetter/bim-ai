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
  resolveWallAssemblyExposedLayers,
} from '../families/wallTypeCatalog';
import { resolveMaterial, type ViewportPaintBundle } from './materials';
import { yawForPlanSegment } from './planSegmentOrientation';
import { addEdges, readToken } from './sceneHelpers';
import { makeThreeMaterialForKey, materialUvTransformForExtent } from './threeMaterialFactory';
import {
  wall3dCleanupFootprintMm,
  wall3dXJoinCleanupFootprintsMm,
  wallWith3dJoinDisallowGaps,
} from './wallJoinDisplay';

type WallElem = Extract<Element, { kind: 'wall' }>;
type PlanPoint = { xMm: number; yMm: number };

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

function exteriorFaceOffsetForBasis(
  basis: WallTypeAssembly['basisLine'],
  totalThickM: number,
): number {
  // Catalog/project wall assemblies are authored exterior-to-interior. The
  // positive wall normal is the exterior side, matching non-typed wall
  // location-line offsets, so the layer cursor starts at the exterior face
  // and walks inward.
  switch (basis) {
    case 'face_interior':
      return totalThickM;
    case 'face_exterior':
      return 0;
    default:
      return totalThickM / 2;
  }
}

function shiftedLayerWall(
  wall: WallElem,
  normalXMm: number,
  normalYMm: number,
  layerCenterOffsetM: number,
  layerThicknessMm: number,
): WallElem {
  const offsetMm = layerCenterOffsetM * 1000;
  return {
    ...wall,
    wallTypeId: undefined,
    faceMaterialOverrides: undefined,
    thicknessMm: layerThicknessMm,
    start: {
      xMm: wall.start.xMm + normalXMm * offsetMm,
      yMm: wall.start.yMm + normalYMm * offsetMm,
    },
    end: {
      xMm: wall.end.xMm + normalXMm * offsetMm,
      yMm: wall.end.yMm + normalYMm * offsetMm,
    },
  };
}

function cleanupFootprintsForLayer(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
): PlanPoint[][] | null {
  const xCleanup = wall3dXJoinCleanupFootprintsMm(wall, elementsById);
  if (xCleanup) return xCleanup;
  const endpointCleanup = wall3dCleanupFootprintMm(wall, elementsById);
  return endpointCleanup ? [endpointCleanup] : null;
}

function makeLayerFootprintMesh(
  footprint: PlanPoint[],
  heightM: number,
  yBase: number,
  material: THREE.Material,
): THREE.Mesh {
  const first = footprint[0]!;
  const shape = new THREE.Shape();
  shape.moveTo(first.xMm / 1000, -first.yMm / 1000);
  for (let i = 1; i < footprint.length; i += 1) {
    const point = footprint[i]!;
    shape.lineTo(point.xMm / 1000, -point.yMm / 1000);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(0, yBase, 0);
  return mesh;
}

export function makeLayeredWallMesh(
  wall: WallElem,
  assembly: WallTypeAssembly,
  elevM: number,
  paint: ViewportPaintBundle | null,
  elementsById?: Record<string, Element>,
): THREE.Group {
  void paint;
  const displayWall = wallWith3dJoinDisallowGaps(wall, elementsById);
  const sx = displayWall.start.xMm / 1000;
  const sz = displayWall.start.yMm / 1000;
  const ex = displayWall.end.xMm / 1000;
  const ez = displayWall.end.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const baseOff = (displayWall.baseConstraintOffsetMm ?? 0) / 1000;
  const yBase = elevM + baseOff;
  const heightM = THREE.MathUtils.clamp(displayWall.heightMm / 1000, 0.25, 40);
  const yaw = yawForPlanSegment(dx, dz);

  const totalThickM = assembly.layers.reduce((acc, l) => acc + l.thicknessMm, 0) / 1000;

  // Wall-perp unit vector (rotates with yaw): from start.tangent (dx,dz) to perp (-dz,dx)
  const nx = -dz / len;
  const nz = dx / len;
  const cx = sx + dx / 2;
  const cz = sz + dz / 2;

  const group = new THREE.Group();
  group.userData.bimPickId = displayWall.id;
  const exposed = resolveWallAssemblyExposedLayers(assembly);
  group.userData.materialExposure = {
    exteriorMaterialKey: exposed.exterior?.materialKey ?? null,
    interiorMaterialKey: exposed.interior?.materialKey ?? null,
    cutMaterialKeys: exposed.cut.map((layer) => layer.materialKey),
  };

  let exteriorCursorM = exteriorFaceOffsetForBasis(assembly.basisLine, totalThickM);

  for (const layer of assembly.layers) {
    const thickM = layer.thicknessMm / 1000;
    if (layer.function === 'air') {
      exteriorCursorM -= thickM;
      continue;
    }
    const layerCenterOff = exteriorCursorM - thickM / 2;
    const px = cx + nx * layerCenterOff;
    const pz = cz + nz * layerCenterOff;
    const layerMaterial = resolveMaterial(layer.materialKey, elementsById);

    const mat = makeThreeMaterialForKey(layer.materialKey, {
      elementsById,
      usage: 'wallExterior',
      uvTransform: materialUvTransformForExtent(layer.materialKey, {
        elementsById,
        extentMm: { uMm: len * 1000, vMm: heightM * 1000 },
      }),
      fallbackColor: materialHexFor(layer.materialKey),
      fallbackRoughness: roughnessFor(layer),
      fallbackMetalness: 0,
    });
    const layerWall = shiftedLayerWall(displayWall, nx, nz, layerCenterOff, layer.thicknessMm);
    const cleanupFootprints = cleanupFootprintsForLayer(layerWall, elementsById);
    const meshes =
      cleanupFootprints && cleanupFootprints.length > 0
        ? cleanupFootprints
            .filter((footprint) => footprint.length >= 3)
            .map((footprint) => makeLayerFootprintMesh(footprint, heightM, yBase, mat))
        : [new THREE.Mesh(new THREE.BoxGeometry(len, heightM, thickM), mat)];

    for (const mesh of meshes) {
      if (!cleanupFootprints) {
        mesh.position.set(px, yBase + heightM / 2, pz);
        mesh.rotation.y = yaw;
      } else {
        mesh.userData.wallJoinCleanup =
          cleanupFootprints.length > 1 ? 'layered-x' : 'layered-endpoint-t';
        group.userData.wallJoinCleanup = 'layered';
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bimPickId = displayWall.id;
      mesh.userData.layerName = layer.name;
      mesh.userData.layerFunction = layer.function;
      mesh.userData.materialKey = layer.materialKey;
      mesh.userData.faceExposure =
        layer === exposed.exterior ? 'exterior' : layer === exposed.interior ? 'interior' : 'cut';
      addEdges(mesh);

      if (
        !cleanupFootprints &&
        layer === exposed.exterior &&
        layer.function === 'finish' &&
        layerMaterial?.category === 'cladding'
      ) {
        addCladdingBoardsInline(mesh, len, heightM, thickM, 250, 12, layerMaterial.baseColor);
      }

      group.add(mesh);
    }
    exteriorCursorM -= thickM;
  }

  return group;
}
