import * as THREE from 'three';
import type { Element, XY } from '@bim-ai/core';
import { type ViewportPaintBundle } from '../../viewport/materials';
import { resolveWindowCutDimensions } from '../../viewport/hostedOpeningDimensions';
import { makeThreeMaterialForKey } from '../../viewport/threeMaterialFactory';
import { meshFromSweep } from '../sweepGeometry';
import { resolveParam, type FamilyDefinition, type SketchLine } from '../types';
import { resolveWindowOutline, resolveWindowOutlineKind } from './windowOutline';

export type WindowGeomInput = {
  win: Extract<Element, { kind: 'window' }>;
  wall: Extract<Element, { kind: 'wall' }>;
  elevM: number;
  paint: ViewportPaintBundle | null;
  familyDef: FamilyDefinition | undefined;
  /** Required for `outlineKind: 'gable_trapezoid'` to look up `attachedRoofId`. */
  elementsById?: Record<string, Element>;
};

const FALLBACK_COLOR = '#cbd5e1';
const FALLBACK_GLAZING = '#9fcbe2';

function materialSlot(
  slots: Record<string, string | null> | null | undefined,
  slot: string,
): string | null | undefined {
  const value = slots?.[slot];
  if (typeof value === 'string') return value.trim() ? value : null;
  return value;
}

function readGlazingColor(): string {
  if (typeof document === 'undefined') return FALLBACK_GLAZING;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--cat-glazing').trim();
    return v || FALLBACK_GLAZING;
  } catch {
    return FALLBACK_GLAZING;
  }
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

export function buildWindowGeometry(input: WindowGeomInput): THREE.Group {
  const { win, wall, paint, familyDef, elementsById } = input;

  const ip = win.overrideParams;
  const typeEntry = win.familyTypeId
    ? familyDef?.defaultTypes.find((t) => t.id === win.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;
  const resolvedDims = resolveWindowCutDimensions(win, elementsById ?? {});

  // Resolve sillMm first so it can inform heightMm clamp
  const rawSillMm = Number(resolveParam('sillMm', ip, tp, familyDef, resolvedDims.sillHeightMm));
  const sillMm = THREE.MathUtils.clamp(rawSillMm, 60, wall.heightMm - 80);

  const rawWidthMm = Number(resolveParam('widthMm', ip, tp, familyDef, resolvedDims.widthMm));
  const rawHeightMm = Number(resolveParam('heightMm', ip, tp, familyDef, resolvedDims.heightMm));
  const rawDepthMm = Number(resolveParam('frameDepthMm', ip, tp, familyDef, wall.thicknessMm + 20));
  const frameSectMm = Number(resolveParam('frameSectMm', ip, tp, familyDef, 60));
  const glazingAlpha = Number(resolveParam('glazingAlpha', ip, tp, familyDef, 0.72));

  const outerW = THREE.MathUtils.clamp(rawWidthMm / 1000, 0.14, 4.0);
  const outerH = THREE.MathUtils.clamp(
    rawHeightMm / 1000,
    0.05,
    (wall.heightMm - sillMm - 60) / 1000,
  );
  const depth = THREE.MathUtils.clamp(rawDepthMm / 1000, 0.06, 0.5);
  const frameSect = frameSectMm / 1000;

  const frameMaterialKey = materialSlot(win.materialSlots, 'frame') ?? win.materialKey;
  const glassMaterialKey = materialSlot(win.materialSlots, 'glass') ?? 'asset_clear_glass_double';

  const frameMat = makeThreeMaterialForKey(frameMaterialKey, {
    elementsById,
    usage: 'openingFrame',
    fallbackColor: paint?.categories.window.color ?? FALLBACK_COLOR,
    fallbackRoughness: paint?.categories.window.roughness ?? 0.6,
    fallbackMetalness: paint?.categories.window.metalness ?? 0.05,
  });

  const group = new THREE.Group();
  group.userData.bimPickId = win.id;

  const glazingMat = makeThreeMaterialForKey(glassMaterialKey, {
    elementsById,
    usage: 'generic',
    fallbackColor: readGlazingColor(),
    fallbackRoughness: 0.05,
    fallbackMetalness: 0.0,
    opacity: glazingAlpha,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  glazingMat.opacity = Math.max(glazingMat.opacity, 0.68);
  glazingMat.transparent = true;
  glazingMat.depthWrite = false;
  if (glazingMat instanceof THREE.MeshPhysicalMaterial) {
    glazingMat.transmission = Math.min(glazingMat.transmission, 0.18);
    glazingMat.thickness = Math.max(glazingMat.thickness, 0.02);
  }

  const outlineKind = resolveWindowOutlineKind(win);
  const outlinePoly =
    outlineKind === 'rectangle'
      ? null
      : elementsById
        ? resolveWindowOutline(win, wall, elementsById)
        : null;

  if (outlinePoly && outlinePoly.length >= 3) {
    // KRN-12: variable-shape outline. Glass pane = polygon-shaped extruded
    // sliver (a thin extrusion through wall thickness gives the glass body).
    // outline coords are in mm with origin at sill-centre; group origin sits
    // at sill-centre (caller positions accordingly).
    const shape = new THREE.Shape();
    shape.moveTo(outlinePoly[0].xMm / 1000, outlinePoly[0].yMm / 1000);
    for (let i = 1; i < outlinePoly.length; i++) {
      shape.lineTo(outlinePoly[i].xMm / 1000, outlinePoly[i].yMm / 1000);
    }
    shape.lineTo(outlinePoly[0].xMm / 1000, outlinePoly[0].yMm / 1000);
    const glassGeom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: false,
    });
    glassGeom.translate(0, 0, -0.006);
    const glazing = new THREE.Mesh(glassGeom, glazingMat);
    glazing.castShadow = false;
    glazing.userData.bimPickId = win.id;
    addEdges(glazing);
    group.add(glazing);

    // KRN-12 + FAM-02: sweep a small rectangular cross-section profile around
    // the polygon perimeter so the frame follows the outline shape.
    const frameMesh = buildPerimeterFrame(outlinePoly, frameSect, depth, frameMat, win.id);
    if (frameMesh) group.add(frameMesh);
    return group;
  }

  // Rectangular path — original frame + glass + optional mullion render.
  const glazingW = Math.max(outerW - 2 * frameSect, 0.01);
  const glazingH = Math.max(outerH - 2 * frameSect, 0.01);

  const frameGroup = new THREE.Group();

  function frameMesh(w: number, h: number, d: number, x: number, y: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    m.userData.bimPickId = win.id;
    addEdges(m);
    return m;
  }

  // head
  frameGroup.add(frameMesh(outerW, frameSect, depth, 0, outerH / 2 - frameSect / 2));
  // sill
  frameGroup.add(frameMesh(outerW, frameSect, depth, 0, -(outerH / 2 - frameSect / 2)));
  // jamb-L
  frameGroup.add(frameMesh(frameSect, outerH, depth, -(outerW / 2 - frameSect / 2), 0));
  // jamb-R
  frameGroup.add(frameMesh(frameSect, outerH, depth, outerW / 2 - frameSect / 2, 0));

  group.add(frameGroup);

  const glazing = new THREE.Mesh(new THREE.BoxGeometry(glazingW, glazingH, 0.006), glazingMat);
  glazing.castShadow = false;
  glazing.userData.bimPickId = win.id;
  addEdges(glazing);
  group.add(glazing);

  if (outerW > 1.2) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(frameSect, glazingH, 0.012), frameMat);
    mullion.castShadow = mullion.receiveShadow = true;
    mullion.userData.bimPickId = win.id;
    addEdges(mullion);
    group.add(mullion);
  }

  return group;
}

/**
 * Sweep a small rectangular cross-section (frame profile) around the
 * window outline polygon. The profile spans `depthM` along the wall
 * thickness (Z) and `frameSectM` radially in the wall-face plane,
 * giving the visual effect of a frame that wraps the perimeter.
 *
 * Outline coords are in mm with origin at sill-centre and CCW order.
 * Returns null when the polygon is degenerate.
 */
function buildPerimeterFrame(
  outlinePolyMm: XY[],
  frameSectM: number,
  depthM: number,
  frameMat: THREE.Material,
  bimPickId: string,
): THREE.Mesh | null {
  if (outlinePolyMm.length < 3) return null;

  // Closed perimeter path in metres. The closing segment loops back to
  // the start so the frame meets at the seam.
  const pathLines: SketchLine[] = [];
  const N = outlinePolyMm.length;
  for (let i = 0; i < N; i++) {
    const a = outlinePolyMm[i];
    const b = outlinePolyMm[(i + 1) % N];
    const startM = { xMm: a.xMm / 1000, yMm: a.yMm / 1000 };
    const endM = { xMm: b.xMm / 1000, yMm: b.yMm / 1000 };
    if (startM.xMm === endM.xMm && startM.yMm === endM.yMm) continue;
    pathLines.push({ startMm: startM, endMm: endM });
  }
  if (pathLines.length < 2) return null;

  // Profile rectangle centred on path. Three's ExtrudeGeometry with
  // extrudePath places shape-X along the curve binormal (≈ ±Z for a
  // planar curve in the X/Y plane) and shape-Y along the in-plane
  // normal — so width=depth maps to wall-thickness, height=frameSect
  // maps to radial frame thickness.
  const halfDepth = depthM / 2;
  const halfSect = frameSectM / 2;
  const profile: SketchLine[] = [
    {
      startMm: { xMm: -halfDepth, yMm: -halfSect },
      endMm: { xMm: halfDepth, yMm: -halfSect },
    },
    {
      startMm: { xMm: halfDepth, yMm: -halfSect },
      endMm: { xMm: halfDepth, yMm: halfSect },
    },
    {
      startMm: { xMm: halfDepth, yMm: halfSect },
      endMm: { xMm: -halfDepth, yMm: halfSect },
    },
    {
      startMm: { xMm: -halfDepth, yMm: halfSect },
      endMm: { xMm: -halfDepth, yMm: -halfSect },
    },
  ];

  let geom: THREE.BufferGeometry;
  try {
    geom = meshFromSweep({
      kind: 'sweep',
      pathLines,
      profile,
      profilePlane: 'normal_to_path_start',
    });
  } catch {
    return null;
  }
  const mesh = new THREE.Mesh(geom, frameMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.bimPickId = bimPickId;
  return mesh;
}
