import * as THREE from 'three';
import type { Element, DoorOperationType } from '@bim-ai/core';
import { type ViewportPaintBundle } from '../../viewport/materials';
import { resolveDoorCutDimensions } from '../../viewport/hostedOpeningDimensions';
import { makeThreeMaterialForKey } from '../../viewport/threeMaterialFactory';
import { resolveParam, type FamilyDefinition } from '../types';

export type DoorGeomInput = {
  door: Extract<Element, { kind: 'door' }>;
  wall: Extract<Element, { kind: 'wall' }>;
  elevM: number;
  paint: ViewportPaintBundle | null;
  familyDef: FamilyDefinition | undefined;
  elementsById?: Record<string, Element>;
};

const FALLBACK_COLOR = '#cbd5e1';

function materialSlot(
  slots: Record<string, string | null> | null | undefined,
  slot: string,
): string | null | undefined {
  const value = slots?.[slot];
  if (typeof value === 'string') return value.trim() ? value : null;
  return value;
}

function addEdges(mesh: THREE.Mesh): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: '#1a1a1a', linewidth: 1 }),
  );
  lines.renderOrder = 1;
  mesh.add(lines);
}

/** Public so tests can verify the right branch is taken for a given operationType. */
export function resolveDoorOperationType(
  door: Extract<Element, { kind: 'door' }>,
): DoorOperationType {
  return door.operationType ?? 'swing_single';
}

type FrameMaterials = {
  frameMat: THREE.MeshStandardMaterial;
  panelMat: THREE.MeshStandardMaterial;
};

type DoorDims = {
  leafWidth: number;
  leafHeight: number;
  depth: number;
  frameSect: number;
  panelThick: number;
};

function buildHeadAndJambs(
  dims: DoorDims,
  frameMat: THREE.MeshStandardMaterial,
  pickId: string,
): THREE.Group {
  const { leafWidth, leafHeight, depth, frameSect } = dims;

  const member = (w: number, h: number, d: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    m.userData.bimPickId = pickId;
    addEdges(m);
    return m;
  };

  const frameGroup = new THREE.Group();
  frameGroup.add(
    member(leafWidth + 2 * frameSect, frameSect, depth, 0, leafHeight + frameSect / 2),
  );
  frameGroup.add(
    member(frameSect, leafHeight, depth, -(leafWidth / 2 + frameSect / 2), leafHeight / 2),
  );
  frameGroup.add(
    member(frameSect, leafHeight, depth, leafWidth / 2 + frameSect / 2, leafHeight / 2),
  );
  return frameGroup;
}

function makePanelMesh(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.MeshStandardMaterial,
  pickId: string,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  m.userData.bimPickId = pickId;
  addEdges(m);
  return m;
}

function makeTrack(
  width: number,
  depth: number,
  yTop: number,
  pickId: string,
  color: string,
): THREE.Mesh {
  const trackMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, depth * 0.3), trackMat);
  m.position.set(0, yTop, 0);
  m.userData.bimPickId = pickId;
  addEdges(m);
  return m;
}

/**
 * KRN-13: branch door 3D geometry on operationType. Each branch returns the
 * panel meshes for the door; the caller composes them with the head/jamb frame
 * (where applicable) and the threshold.
 *
 * Geometry is intentionally rough — the goal is for each operationType to
 * produce a *visibly distinct* mesh so a user can tell at a glance which
 * door variant is in place. Photoreal hardware comes later.
 */
function buildPanelsForOperationType(
  op: DoorOperationType,
  dims: DoorDims,
  mats: FrameMaterials,
  pickId: string,
  slidingTrackSide: 'wall_face' | 'in_pocket',
): { panels: THREE.Object3D[]; frameVisible: boolean } {
  const { leafWidth, leafHeight, depth, frameSect, panelThick } = dims;
  const { panelMat } = mats;
  const halfW = leafWidth / 2;
  const halfH = leafHeight / 2;

  switch (op) {
    case 'swing_single': {
      return {
        panels: [makePanelMesh(leafWidth, leafHeight, panelThick, 0, halfH, 0, panelMat, pickId)],
        frameVisible: true,
      };
    }

    case 'swing_double': {
      const halfLeaf = leafWidth / 2;
      const left = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        -halfLeaf / 2,
        halfH,
        0,
        panelMat,
        pickId,
      );
      const right = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        halfLeaf / 2,
        halfH,
        0,
        panelMat,
        pickId,
      );
      return { panels: [left, right], frameVisible: true };
    }

    case 'sliding_single': {
      // Single panel offset onto the wall face along the track at head height.
      const trackZ = slidingTrackSide === 'in_pocket' ? 0 : depth / 2 - panelThick / 2 - 0.005;
      const panel = makePanelMesh(
        leafWidth,
        leafHeight,
        panelThick,
        leafWidth * 0.4,
        halfH,
        trackZ,
        panelMat,
        pickId,
      );
      const track = makeTrack(
        leafWidth + 2 * frameSect,
        depth,
        leafHeight + frameSect,
        pickId,
        '#1f2937',
      );
      return { panels: [panel, track], frameVisible: false };
    }

    case 'sliding_double': {
      const halfLeaf = leafWidth / 2;
      const trackZA = depth / 2 - panelThick / 2 - 0.005;
      const trackZB = -trackZA;
      const left = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        -halfLeaf / 2,
        halfH,
        trackZA,
        panelMat,
        pickId,
      );
      const right = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        halfLeaf / 2,
        halfH,
        trackZB,
        panelMat,
        pickId,
      );
      const track = makeTrack(
        leafWidth + 2 * frameSect,
        depth,
        leafHeight + frameSect,
        pickId,
        '#1f2937',
      );
      return { panels: [left, right, track], frameVisible: false };
    }

    case 'bi_fold': {
      // Two folded pairs: each pair consists of two narrow panels at an angle.
      const quarterW = leafWidth / 4;
      const fold1a = makePanelMesh(
        quarterW,
        leafHeight,
        panelThick,
        (-3 * quarterW) / 2 + quarterW / 2,
        halfH,
        depth / 4,
        panelMat,
        pickId,
      );
      fold1a.rotation.y = Math.PI / 6;
      const fold1b = makePanelMesh(
        quarterW,
        leafHeight,
        panelThick,
        -quarterW / 2 - quarterW / 4,
        halfH,
        -depth / 4,
        panelMat,
        pickId,
      );
      fold1b.rotation.y = -Math.PI / 6;
      const fold2a = makePanelMesh(
        quarterW,
        leafHeight,
        panelThick,
        quarterW / 2 + quarterW / 4,
        halfH,
        -depth / 4,
        panelMat,
        pickId,
      );
      fold2a.rotation.y = Math.PI / 6;
      const fold2b = makePanelMesh(
        quarterW,
        leafHeight,
        panelThick,
        (3 * quarterW) / 2 - quarterW / 2,
        halfH,
        depth / 4,
        panelMat,
        pickId,
      );
      fold2b.rotation.y = -Math.PI / 6;
      return { panels: [fold1a, fold1b, fold2a, fold2b], frameVisible: true };
    }

    case 'pocket': {
      // Panel slides into a pocket inside the wall — render as a flat panel
      // pressed against the wall face inside the frame opening.
      const panel = makePanelMesh(
        leafWidth,
        leafHeight,
        panelThick,
        leafWidth * 0.45,
        halfH,
        0,
        panelMat,
        pickId,
      );
      return { panels: [panel], frameVisible: true };
    }

    case 'pivot': {
      // Pivot panel rotated 25° around the offset pivot point.
      const panel = makePanelMesh(
        leafWidth,
        leafHeight,
        panelThick,
        -halfW * 0.18,
        halfH,
        0,
        panelMat,
        pickId,
      );
      panel.rotation.y = -Math.PI / 7;
      // Pivot dot on the floor.
      const pivotMat = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.6 });
      const pivotDot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), pivotMat);
      pivotDot.position.set(-halfW + leafWidth * 0.18, 0.01, 0);
      pivotDot.userData.bimPickId = pickId;
      return { panels: [panel, pivotDot], frameVisible: true };
    }

    case 'automatic_double': {
      const halfLeaf = leafWidth / 2;
      const left = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        -halfLeaf / 2,
        halfH,
        0,
        panelMat,
        pickId,
      );
      const right = makePanelMesh(
        halfLeaf,
        leafHeight,
        panelThick,
        halfLeaf / 2,
        halfH,
        0,
        panelMat,
        pickId,
      );
      // Threshold marker indicating automatic.
      const sensorMat = new THREE.MeshStandardMaterial({
        color: '#10b981',
        emissive: '#10b981',
        emissiveIntensity: 0.5,
      });
      const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, depth * 0.6), sensorMat);
      sensor.position.set(0, leafHeight + frameSect / 2 + 0.04, 0);
      sensor.userData.bimPickId = pickId;
      return { panels: [left, right, sensor], frameVisible: true };
    }
  }
}

export function buildDoorGeometry(input: DoorGeomInput): THREE.Group {
  const { door, wall, paint, familyDef, elementsById } = input;

  const ip = door.overrideParams;
  const typeEntry = door.familyTypeId
    ? familyDef?.defaultTypes.find((t) => t.id === door.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;
  const resolvedDims = resolveDoorCutDimensions(door, elementsById ?? {}, wall.heightMm);

  const leafWidthMm = Number(resolveParam('leafWidthMm', ip, tp, familyDef, resolvedDims.widthMm));
  const leafHeightMm = Number(
    resolveParam('leafHeightMm', ip, tp, familyDef, resolvedDims.heightMm),
  );
  const frameDepthMm = Number(resolveParam('frameDepthMm', ip, tp, familyDef, wall.thicknessMm));
  const frameSectMm = Number(resolveParam('frameSectMm', ip, tp, familyDef, 70));
  const panelThickMm = Number(resolveParam('panelThickMm', ip, tp, familyDef, 45));

  const dims: DoorDims = {
    leafWidth: THREE.MathUtils.clamp(leafWidthMm / 1000, 0.35, 4.0),
    leafHeight: THREE.MathUtils.clamp(leafHeightMm / 1000, 0.6, 2.5),
    depth: THREE.MathUtils.clamp(frameDepthMm / 1000, 0.08, 0.5),
    frameSect: frameSectMm / 1000,
    panelThick: panelThickMm / 1000,
  };

  const frameMaterialKey = materialSlot(door.materialSlots, 'frame') ?? door.materialKey;
  const panelMaterialKey = materialSlot(door.materialSlots, 'panel') ?? door.materialKey;

  const frameMat = makeThreeMaterialForKey(frameMaterialKey, {
    elementsById,
    usage: 'openingFrame',
    fallbackColor: paint?.categories.door.color ?? FALLBACK_COLOR,
    fallbackRoughness: paint?.categories.door.roughness ?? 0.7,
    fallbackMetalness: paint?.categories.door.metalness ?? 0.0,
  }) as THREE.MeshStandardMaterial;
  const panelMat = makeThreeMaterialForKey(panelMaterialKey, {
    elementsById,
    usage: 'openingFrame',
    fallbackColor: paint?.categories.door.color ?? FALLBACK_COLOR,
    fallbackRoughness: paint?.categories.door.roughness ?? 0.7,
    fallbackMetalness: 0,
  }) as THREE.MeshStandardMaterial;

  const op = resolveDoorOperationType(door);
  const slidingSide = door.slidingTrackSide ?? 'wall_face';
  const { panels, frameVisible } = buildPanelsForOperationType(
    op,
    dims,
    { frameMat, panelMat },
    door.id,
    slidingSide,
  );

  const group = new THREE.Group();
  if (frameVisible) {
    group.add(buildHeadAndJambs(dims, frameMat, door.id));
  }
  for (const p of panels) group.add(p);
  // Threshold sits at floor level (matches existing 0.02m height baseline).
  group.add(makePanelMesh(dims.leafWidth, 0.02, dims.depth, 0, 0.01, 0, frameMat, door.id));
  group.userData.bimPickId = door.id;
  return group;
}
