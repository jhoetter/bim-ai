import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import type { ViewportPaintBundle } from '../../viewport/materials';
import { resolveParam, type FamilyDefinition } from '../types';

export type WindowGeomInput = {
  win:       Extract<Element, { kind: 'window' }>;
  wall:      Extract<Element, { kind: 'wall' }>;
  elevM:     number;
  paint:     ViewportPaintBundle | null;
  familyDef: FamilyDefinition | undefined;
};

const FALLBACK_COLOR   = '#cbd5e1';
const FALLBACK_GLAZING = '#c8d8ea';

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
  const { win, wall, paint, familyDef } = input;

  const ip = win.overrideParams;
  const typeEntry = win.familyTypeId
    ? familyDef?.defaultTypes.find(t => t.id === win.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;

  // Resolve sillMm first so it can inform heightMm clamp
  const rawSillMm = Number(resolveParam('sillMm', ip, tp, familyDef, win.sillHeightMm));
  const sillMm    = THREE.MathUtils.clamp(rawSillMm, 60, wall.heightMm - 80);

  const rawWidthMm  = Number(resolveParam('widthMm',  ip, tp, familyDef, win.widthMm));
  const rawHeightMm = Number(resolveParam('heightMm', ip, tp, familyDef, win.heightMm));
  const rawDepthMm  = Number(resolveParam('frameDepthMm', ip, tp, familyDef, wall.thicknessMm + 20));
  const frameSectMm = Number(resolveParam('frameSectMm',  ip, tp, familyDef, 60));
  const glazingAlpha = Number(resolveParam('glazingAlpha', ip, tp, familyDef, 0.35));

  const outerW    = THREE.MathUtils.clamp(rawWidthMm  / 1000, 0.14, 4.0);
  const outerH    = THREE.MathUtils.clamp(
    rawHeightMm / 1000,
    0.05,
    (wall.heightMm - sillMm - 60) / 1000,
  );
  const depth     = THREE.MathUtils.clamp(rawDepthMm  / 1000, 0.06, 0.5);
  const frameSect = frameSectMm / 1000;

  const glazingW = Math.max(outerW - 2 * frameSect, 0.01);
  const glazingH = Math.max(outerH - 2 * frameSect, 0.01);

  const frameColor = paint?.categories.window.color ?? FALLBACK_COLOR;
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: paint?.categories.window.roughness ?? 0.60,
    metalness: paint?.categories.window.metalness ?? 0.05,
  });

  const group = new THREE.Group();
  group.userData.bimPickId = win.id;

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
  frameGroup.add(frameMesh(outerW, frameSect, depth,  0,                    outerH / 2 - frameSect / 2));
  // sill
  frameGroup.add(frameMesh(outerW, frameSect, depth,  0,                   -(outerH / 2 - frameSect / 2)));
  // jamb-L
  frameGroup.add(frameMesh(frameSect, outerH, depth, -(outerW / 2 - frameSect / 2), 0));
  // jamb-R
  frameGroup.add(frameMesh(frameSect, outerH, depth,  (outerW / 2 - frameSect / 2), 0));

  group.add(frameGroup);

  const glazingMat = new THREE.MeshStandardMaterial({
    color: readGlazingColor(),
    roughness: 0.05,
    metalness: 0.0,
    opacity: glazingAlpha,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
  const glazing = new THREE.Mesh(new THREE.BoxGeometry(glazingW, glazingH, 0.006), glazingMat);
  glazing.castShadow = false;
  glazing.userData.bimPickId = win.id;
  group.add(glazing);

  if (outerW > 1.2) {
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(frameSect, glazingH, 0.012),
      frameMat,
    );
    mullion.castShadow = mullion.receiveShadow = true;
    mullion.userData.bimPickId = win.id;
    addEdges(mullion);
    group.add(mullion);
  }

  return group;
}
