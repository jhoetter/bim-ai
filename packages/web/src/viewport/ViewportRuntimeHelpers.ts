import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import type { CsgBaseFootprintPoint } from './csgWorker';
import { SectionBox } from './sectionBox';
import {
  type WallElem,
  resolveFaceMaterialOverride,
  resolveWallTypeAssembly,
} from './meshBuilders';
import { resolveWallAssemblyExposedLayers } from '../families/wallTypeCatalog';
import { wall3dCleanupFootprintMm, wall3dXJoinCleanupFootprintsMm } from './wallJoinDisplay';

export type ViewerEdgeWidth = 1 | 2 | 3 | 4;
export type ViewerGdoRuntimeState = {
  viewerShadowsEnabled?: boolean;
  viewerAmbientOcclusionEnabled?: boolean;
  viewerDepthCueEnabled?: boolean;
  viewerSilhouetteEdgeWidth?: ViewerEdgeWidth;
  viewerPhotographicExposureEv?: number;
};

export type ViewportRenderRole =
  | 'model'
  | 'materializedCutSurface'
  | 'helper'
  | 'overlay'
  | 'hitTarget'
  | 'annotation'
  | 'debug';

export function applyRenderRole(obj: THREE.Object3D, role: ViewportRenderRole): void {
  obj.userData.renderRole = obj.userData.renderRole ?? role;
  obj.traverse((node) => {
    node.userData.renderRole = node.userData.renderRole ?? role;
  });
}

export const GDO_STORAGE_KEYS = {
  shadows: 'bim.viewer.shadowsEnabled',
  ambientOcclusion: 'bim.viewer.ambientOcclusionEnabled',
  depthCue: 'bim.viewer.depthCueEnabled',
  silhouetteEdgeWidth: 'bim.viewer.silhouetteEdgeWidth',
  photographicExposureEv: 'bim.viewer.photographicExposureEv',
} as const;

const PHOTOGRAPHIC_EXPOSURE_EV_MIN = -2;
const PHOTOGRAPHIC_EXPOSURE_EV_MAX = 2;
const PHOTOGRAPHIC_EXPOSURE_EV_STEP = 0.25;

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* noop */
  }
  return fallback;
}

export function readStoredEdgeWidth(): ViewerEdgeWidth {
  try {
    const raw = Number(localStorage.getItem(GDO_STORAGE_KEYS.silhouetteEdgeWidth));
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) return raw;
  } catch {
    /* noop */
  }
  return 1;
}

export function normalizeExposureEv(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / PHOTOGRAPHIC_EXPOSURE_EV_STEP) * PHOTOGRAPHIC_EXPOSURE_EV_STEP;
  return Math.min(PHOTOGRAPHIC_EXPOSURE_EV_MAX, Math.max(PHOTOGRAPHIC_EXPOSURE_EV_MIN, stepped));
}

export function readStoredExposureEv(): number {
  try {
    const raw = localStorage.getItem(GDO_STORAGE_KEYS.photographicExposureEv);
    if (raw != null) return normalizeExposureEv(raw);
  } catch {
    /* noop */
  }
  return 0;
}

export function applyModelEdgeDisplay(
  root: THREE.Object3D,
  edgeMode: 'normal' | 'none',
  width: ViewerEdgeWidth,
): void {
  const visible = edgeMode === 'normal' && width > 0;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.LineSegments) || !(obj.parent instanceof THREE.Mesh)) return;
    obj.visible = visible;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!(material instanceof THREE.LineBasicMaterial)) continue;
      material.linewidth = width;
      material.opacity = visible ? Math.min(0.7, 0.3 + width * 0.1) : 0;
      material.needsUpdate = true;
    }
  });
}

export function sectionBoxFaceAxisNormal(face: string): THREE.Vector3 {
  if (face === 'maxX' || face === 'minX') return new THREE.Vector3(1, 0, 0);
  if (face === 'maxY' || face === 'minY') return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

export function sectionBoxFaceAxisKey(face: string): 'x' | 'y' | 'z' {
  if (face === 'maxX' || face === 'minX') return 'x';
  if (face === 'maxY' || face === 'minY') return 'y';
  return 'z';
}

export function updateSectionBoxHandles(group: THREE.Group, sb: SectionBox): void {
  const ext = sb.getExtent();
  const midX = (ext.minX + ext.maxX) / 2;
  const midY = (ext.minY + ext.maxY) / 2;
  const midZ = (ext.minZ + ext.maxZ) / 2;
  const positions: Record<string, [number, number, number]> = {
    maxX: [ext.maxX, midY, midZ],
    minX: [ext.minX, midY, midZ],
    maxY: [midX, ext.maxY, midZ],
    minY: [midX, ext.minY, midZ],
    maxZ: [midX, midY, ext.maxZ],
    minZ: [midX, midY, ext.minZ],
  };
  for (const child of group.children) {
    const face = child.userData.sectionBoxHandle as string | undefined;
    if (face && face in positions) {
      const [x, y, z] = positions[face];
      child.position.set(x, y, z);
    }
  }
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (
      node instanceof THREE.Mesh ||
      node instanceof THREE.Line ||
      node instanceof THREE.LineSegments ||
      node instanceof THREE.Sprite
    ) {
      node.geometry?.dispose();
      const material = node.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        const spriteMap =
          mat instanceof THREE.SpriteMaterial && mat.map instanceof THREE.Texture ? mat.map : null;
        spriteMap?.dispose();
        mat.dispose();
      }
    }
  });
}

export function csgWallSurfaceMaterialKey(
  wall: WallElem,
  elementsById: Record<string, Element>,
): string | null | undefined {
  const exteriorOverride = resolveFaceMaterialOverride(wall.faceMaterialOverrides, 'exterior');
  if (exteriorOverride?.materialKey) return exteriorOverride.materialKey;
  if (!wall.wallTypeId) return wall.materialKey;
  const assembly = resolveWallTypeAssembly(wall.wallTypeId, elementsById);
  if (!assembly) return wall.materialKey;
  return resolveWallAssemblyExposedLayers(assembly).exterior?.materialKey ?? wall.materialKey;
}

export function csgBaseFootprintsForWall(
  wall: WallElem,
  elementsById: Record<string, Element>,
  originXM: number,
  originZM: number,
  dxM: number,
  dzM: number,
  lenM: number,
): CsgBaseFootprintPoint[][] | undefined {
  const xCleanup = wall3dXJoinCleanupFootprintsMm(wall, elementsById);
  const endpointCleanup = xCleanup ? null : wall3dCleanupFootprintMm(wall, elementsById);
  const footprints = xCleanup ?? (endpointCleanup ? [endpointCleanup] : null);
  if (!footprints || lenM <= 1e-6) return undefined;

  const ux = dxM / lenM;
  const uz = dzM / lenM;
  const nx = -uz;
  const nz = ux;
  return footprints
    .map((footprint) =>
      footprint.map((point) => {
        const wx = point.xMm / 1000 - originXM;
        const wz = point.yMm / 1000 - originZM;
        return {
          xM: wx * ux + wz * uz,
          zM: wx * nx + wz * nz,
        };
      }),
    )
    .filter((footprint) => footprint.length >= 3);
}
