import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { getBuiltInWallType, resolveWallAssemblyExposedLayers } from '../families/wallTypeCatalog';
import {
  effectiveWallBaseMaterialKey,
  effectiveWallFaceMaterialKey,
} from './effectiveHostMaterials';
import {
  resolveWallSurfaceMaterial,
  type ResolvedWallSurfaceMaterial,
  type ViewportPaintBundle,
} from './materials';
import { applyMaterialTextureVisibility } from './visualStyleMaterials';
import { makeThreeMaterialForKey, materialUvTransformForExtent } from './threeMaterialFactory';

export type CsgWallMaterialResult = {
  material: THREE.Material | THREE.Material[];
  surface: ResolvedWallSurfaceMaterial;
};

export type CsgWallFaceRole = 'exterior' | 'interior' | 'side' | 'top' | 'bottom' | 'generatedCut';

export const CSG_WALL_FACE_MATERIAL_INDEX: Record<CsgWallFaceRole, number> = {
  exterior: 0,
  interior: 1,
  side: 2,
  top: 3,
  bottom: 4,
  generatedCut: 5,
};

const CSG_WALL_FACE_ROLE_BY_MATERIAL_INDEX = Object.fromEntries(
  Object.entries(CSG_WALL_FACE_MATERIAL_INDEX).map(([role, materialIndex]) => [
    materialIndex,
    role,
  ]),
) as Record<number, CsgWallFaceRole>;

export type CsgWallMaterialGoldenStatus = {
  format: 'csgWallMaterialGoldenStatus_v1';
  ok: boolean;
  triangleCount: number;
  materialGroupTriangleCounts: Record<CsgWallFaceRole, number>;
  materialKeysByRole: Record<CsgWallFaceRole, string | null>;
  diagnostics: Array<{
    code:
      | 'renderer.wall_cut.mesh.blank'
      | 'renderer.wall_cut.material_groups.missing'
      | 'renderer.wall_cut.generated_cut.material_group_missing'
      | 'renderer.material.csg_wall.unresolved';
    message: string;
    trackerItems: string[];
  }>;
};

type WallElem = Extract<Element, { kind: 'wall' }>;

function projectWallTypeCutMaterialKey(
  wall: WallElem,
  elementsById: Record<string, Element>,
): string | null {
  if (!wall.wallTypeId) return null;
  const wallType = elementsById[wall.wallTypeId];
  if (wallType?.kind === 'wall_type') {
    const visible = wallType.layers.filter(
      (layer) => layer.function !== 'air' && layer.materialKey,
    );
    return (
      visible.find((layer) => layer.function === 'structure')?.materialKey ??
      visible[Math.floor(visible.length / 2)]?.materialKey ??
      null
    );
  }
  const builtIn = getBuiltInWallType(wall.wallTypeId);
  if (!builtIn) return null;
  const exposed = resolveWallAssemblyExposedLayers(builtIn);
  return (
    exposed.cut.find((layer) => layer.function === 'structure')?.materialKey ??
    exposed.cut[Math.floor(exposed.cut.length / 2)]?.materialKey ??
    null
  );
}

function makeCsgFaceMaterial(options: {
  materialKey: string | null | undefined;
  paint: ViewportPaintBundle | null | undefined;
  elementsById: Record<string, Element>;
  usage: 'wallExterior' | 'wallInterior';
  extentMm: { uMm: number; vMm: number };
  textureMapsVisible: boolean;
}): THREE.Material {
  const { materialKey, paint, elementsById, usage, extentMm, textureMapsVisible } = options;
  const surface = resolveWallSurfaceMaterial(materialKey, paint, elementsById);
  const material = makeThreeMaterialForKey(materialKey, {
    elementsById,
    usage,
    uvTransform: materialUvTransformForExtent(materialKey, { elementsById, extentMm }),
    fallbackColor: surface.baseColor,
    fallbackRoughness: surface.roughness,
    fallbackMetalness: surface.metalness,
  });
  if (material instanceof THREE.MeshStandardMaterial) {
    material.envMapIntensity = surface.envMapIntensity;
  }
  applyMaterialTextureVisibility(material, textureMapsVisible);
  return material;
}

export function makeCsgWallMaterial(options: {
  materialKey: string | null | undefined;
  wall?: WallElem | null;
  paint: ViewportPaintBundle | null | undefined;
  elementsById: Record<string, Element>;
  lenM: number;
  heightM: number;
  textureMapsVisible: boolean;
}): CsgWallMaterialResult {
  const { materialKey, wall, paint, elementsById, lenM, heightM, textureMapsVisible } = options;
  const surface = resolveWallSurfaceMaterial(materialKey, paint, elementsById);
  if (wall) {
    const exteriorKey = effectiveWallFaceMaterialKey(wall, 'exterior', elementsById) ?? materialKey;
    const interiorKey =
      effectiveWallFaceMaterialKey(wall, 'interior', elementsById) ??
      effectiveWallBaseMaterialKey(wall, 'interior', elementsById) ??
      exteriorKey;
    const cutKey = projectWallTypeCutMaterialKey(wall, elementsById) ?? interiorKey ?? exteriorKey;
    const faceExtentMm = { uMm: Math.max(1, lenM * 1000), vMm: Math.max(1, heightM * 1000) };
    const sideExtentMm = {
      uMm: Math.max(1, wall.thicknessMm ?? 1),
      vMm: Math.max(1, heightM * 1000),
    };
    const topBottomExtentMm = {
      uMm: Math.max(1, lenM * 1000),
      vMm: Math.max(1, wall.thicknessMm ?? 1),
    };
    return {
      material: [
        makeCsgFaceMaterial({
          materialKey: exteriorKey,
          paint,
          elementsById,
          usage: 'wallExterior',
          extentMm: faceExtentMm,
          textureMapsVisible,
        }),
        makeCsgFaceMaterial({
          materialKey: interiorKey,
          paint,
          elementsById,
          usage: 'wallInterior',
          extentMm: faceExtentMm,
          textureMapsVisible,
        }),
        makeCsgFaceMaterial({
          materialKey: cutKey,
          paint,
          elementsById,
          usage: 'wallInterior',
          extentMm: sideExtentMm,
          textureMapsVisible,
        }),
        makeCsgFaceMaterial({
          materialKey: cutKey,
          paint,
          elementsById,
          usage: 'wallInterior',
          extentMm: topBottomExtentMm,
          textureMapsVisible,
        }),
        makeCsgFaceMaterial({
          materialKey: cutKey,
          paint,
          elementsById,
          usage: 'wallInterior',
          extentMm: topBottomExtentMm,
          textureMapsVisible,
        }),
        makeCsgFaceMaterial({
          materialKey: cutKey,
          paint,
          elementsById,
          usage: 'wallInterior',
          extentMm: sideExtentMm,
          textureMapsVisible,
        }),
      ],
      surface,
    };
  }

  const material = makeThreeMaterialForKey(materialKey, {
    elementsById,
    usage: 'wallExterior',
    uvTransform: materialUvTransformForExtent(materialKey, {
      elementsById,
      extentMm: { uMm: Math.max(1, lenM * 1000), vMm: Math.max(1, heightM * 1000) },
    }),
    fallbackColor: surface.baseColor,
    fallbackRoughness: surface.roughness,
    fallbackMetalness: surface.metalness,
  });
  if (material instanceof THREE.MeshStandardMaterial) {
    material.envMapIntensity = surface.envMapIntensity;
  }

  applyMaterialTextureVisibility(material, textureMapsVisible);
  return { material, surface };
}

function csgWallFaceRoleForTriangle(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  lenM: number,
  heightM: number,
  thickM: number,
): CsgWallFaceRole {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const nLen = Math.hypot(nx, ny, nz) || 1;
  const nnx = nx / nLen;
  const nny = ny / nLen;
  const nnz = nz / nLen;
  const mx = (ax + bx + cx) / 3;
  const my = (ay + by + cy) / 3;
  const mz = (az + bz + cz) / 3;
  const xBoundary = Math.max(0.002, lenM * 0.0005);
  const yBoundary = Math.max(0.002, heightM * 0.0005);
  const zBoundary = Math.max(0.002, thickM * 0.01);

  if (Math.abs(nnz) > 0.75 && Math.abs(Math.abs(mz) - thickM / 2) <= zBoundary) {
    return nnz >= 0 ? 'exterior' : 'interior';
  }
  if (Math.abs(nny) > 0.75 && Math.abs(my - heightM / 2) <= yBoundary) return 'top';
  if (Math.abs(nny) > 0.75 && Math.abs(my + heightM / 2) <= yBoundary) return 'bottom';
  if (Math.abs(nnx) > 0.75 && Math.abs(Math.abs(mx) - lenM / 2) <= xBoundary) return 'side';
  return 'generatedCut';
}

export function applyCsgWallFaceMaterialGroups(
  geometry: THREE.BufferGeometry,
  options: { lenM: number; heightM: number; thickM: number },
): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!position) return;
  geometry.clearGroups();

  const index = geometry.index;
  const readVertex = (vertexIndex: number): [number, number, number] => [
    position.getX(vertexIndex),
    position.getY(vertexIndex),
    position.getZ(vertexIndex),
  ];
  const triangleCount = index ? index.count / 3 : position.count / 3;
  let activeMaterialIndex: number | null = null;
  let activeStart = 0;
  let activeCount = 0;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const aIndex = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
    const bIndex = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
    const cIndex = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
    const [ax, ay, az] = readVertex(aIndex);
    const [bx, by, bz] = readVertex(bIndex);
    const [cx, cy, cz] = readVertex(cIndex);
    const role = csgWallFaceRoleForTriangle(
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      cx,
      cy,
      cz,
      options.lenM,
      options.heightM,
      options.thickM,
    );
    const materialIndex = CSG_WALL_FACE_MATERIAL_INDEX[role];
    const triangleStart = triangleIndex * 3;
    if (activeMaterialIndex === null) {
      activeMaterialIndex = materialIndex;
      activeStart = triangleStart;
      activeCount = 3;
    } else if (activeMaterialIndex === materialIndex) {
      activeCount += 3;
    } else {
      geometry.addGroup(activeStart, activeCount, activeMaterialIndex);
      activeMaterialIndex = materialIndex;
      activeStart = triangleStart;
      activeCount = 3;
    }
  }

  if (activeMaterialIndex !== null) {
    geometry.addGroup(activeStart, activeCount, activeMaterialIndex);
  }
}

export function summarizeCsgWallMaterialGoldenStatus(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
): CsgWallMaterialGoldenStatus {
  const materialGroupTriangleCounts: Record<CsgWallFaceRole, number> = {
    exterior: 0,
    interior: 0,
    side: 0,
    top: 0,
    bottom: 0,
    generatedCut: 0,
  };
  for (const group of geometry.groups) {
    const role =
      typeof group.materialIndex === 'number'
        ? CSG_WALL_FACE_ROLE_BY_MATERIAL_INDEX[group.materialIndex]
        : undefined;
    if (role) materialGroupTriangleCounts[role] += group.count / 3;
  }

  const materials = Array.isArray(material) ? material : [material];
  const materialKeysByRole = Object.fromEntries(
    Object.entries(CSG_WALL_FACE_MATERIAL_INDEX).map(([role, materialIndex]) => [
      role,
      (materials[materialIndex]?.userData.materialKey as string | null | undefined) ?? null,
    ]),
  ) as Record<CsgWallFaceRole, string | null>;

  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const triangleCount = geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;
  const diagnostics: CsgWallMaterialGoldenStatus['diagnostics'] = [];
  const trackerItems = ['BIR-J01', 'BIR-J05', 'BIR-J07', 'BIR-J09', 'BIR-C04', 'BIR-C08'];

  if (triangleCount <= 0) {
    diagnostics.push({
      code: 'renderer.wall_cut.mesh.blank',
      message: 'CSG wall replacement mesh has no triangles.',
      trackerItems,
    });
  }
  const groupedTriangles = Object.values(materialGroupTriangleCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (triangleCount > 0 && groupedTriangles !== triangleCount) {
    diagnostics.push({
      code: 'renderer.wall_cut.material_groups.missing',
      message: 'CSG wall replacement mesh has triangles without face material groups.',
      trackerItems,
    });
  }
  if (triangleCount > 0 && materialGroupTriangleCounts.generatedCut <= 0) {
    diagnostics.push({
      code: 'renderer.wall_cut.generated_cut.material_group_missing',
      message: 'CSG wall replacement mesh lacks generated cut-face material groups.',
      trackerItems,
    });
  }
  const unresolvedRoles = (Object.keys(CSG_WALL_FACE_MATERIAL_INDEX) as CsgWallFaceRole[]).filter(
    (role) => !materialKeysByRole[role],
  );
  if (Array.isArray(material) && unresolvedRoles.length > 0) {
    diagnostics.push({
      code: 'renderer.material.csg_wall.unresolved',
      message: `CSG wall replacement mesh has unresolved material roles: ${unresolvedRoles.join(', ')}.`,
      trackerItems,
    });
  }

  return {
    format: 'csgWallMaterialGoldenStatus_v1',
    ok: diagnostics.length === 0,
    triangleCount,
    materialGroupTriangleCounts,
    materialKeysByRole,
    diagnostics,
  };
}
