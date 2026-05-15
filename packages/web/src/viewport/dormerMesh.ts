import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { resolveMaterial, type ViewportPaintBundle } from './materials';
import { addEdges, categoryColorOr } from './sceneHelpers';
import { roofHeightAtPoint } from './roofHeightSampler';

function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lvl = elementsById[levelId];
  if (!lvl || lvl.kind !== 'level') return 0;
  return lvl.elevationMm / 1000;
}

type DormerElem = Extract<Element, { kind: 'dormer' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;

/**
 * KRN-14 — compute the dormer footprint (axis-aligned rectangle) in plan
 * coordinates (mm), given the host roof's footprint and the dormer's
 * positionOnRoof. Convention:
 *   - the longer span axis of the host footprint is taken as the ridge axis
 *     (matching `makeRoofMassMesh`)
 *   - `alongRidgeMm` is a signed offset of the dormer centre along the ridge
 *     direction from the footprint centre
 *   - `acrossRidgeMm` is a signed offset perpendicular to the ridge from the
 *     footprint centre (positive = +plan-X for ridges along plan-Y, or
 *     +plan-Y for ridges along plan-X)
 */
export function dormerFootprintMm(
  dormer: DormerElem,
  hostRoof: RoofElem,
): { minX: number; maxX: number; minY: number; maxY: number; ridgeAlongX: boolean } {
  const xs = hostRoof.footprintMm.map((p) => p.xMm);
  const ys = hostRoof.footprintMm.map((p) => p.yMm);
  const minRx = Math.min(...xs);
  const maxRx = Math.max(...xs);
  const minRy = Math.min(...ys);
  const maxRy = Math.max(...ys);
  const cx = (minRx + maxRx) / 2;
  const cy = (minRy + maxRy) / 2;
  const spanX = maxRx - minRx;
  const spanY = maxRy - minRy;
  // Match makeRoofMassMesh's heuristic when ridgeAxis is unset: longer plan
  // axis becomes the ridge.
  const ridgeAlongX =
    hostRoof.ridgeAxis === 'x' ? true : hostRoof.ridgeAxis === 'z' ? false : spanX >= spanY;

  const dx = ridgeAlongX ? dormer.positionOnRoof.alongRidgeMm : dormer.positionOnRoof.acrossRidgeMm;
  const dy = ridgeAlongX ? dormer.positionOnRoof.acrossRidgeMm : dormer.positionOnRoof.alongRidgeMm;
  const centreX = cx + dx;
  const centreY = cy + dy;

  const halfWidth = dormer.widthMm / 2;
  const halfDepth = dormer.depthMm / 2;

  // Width runs along the ridge; depth runs across.
  if (ridgeAlongX) {
    return {
      minX: centreX - halfWidth,
      maxX: centreX + halfWidth,
      minY: centreY - halfDepth,
      maxY: centreY + halfDepth,
      ridgeAlongX,
    };
  }
  return {
    minX: centreX - halfDepth,
    maxX: centreX + halfDepth,
    minY: centreY - halfWidth,
    maxY: centreY + halfWidth,
    ridgeAlongX,
  };
}

/**
 * Build a dormer Group: cheek walls + back wall + flat dormer roof. The
 * "front" face of the dormer is left open (this is where hosted glass doors
 * go; in the demo seed they sit on the upper-volume east wall, which serves
 * as the dormer's interior back wall, with the open side pointing toward
 * the deck).
 */
export function makeDormerMesh(
  dormer: DormerElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = dormer.id;

  const hostRoof = elementsById[dormer.hostRoofId];
  if (!hostRoof || hostRoof.kind !== 'roof') return group;

  const fp = dormerFootprintMm(dormer, hostRoof);

  // Reference elevation: top of upper-floor walls (eave plate) at host roof's
  // reference level. Use the same heuristic as makeRoofMassMesh.
  const refElev = elevationMForLevel(hostRoof.referenceLevelId, elementsById);
  const wallsAtRef = Object.values(elementsById).filter(
    (e): e is WallElem =>
      e.kind === 'wall' && (e as WallElem).levelId === hostRoof.referenceLevelId,
  );
  const centreXmm = (fp.minX + fp.maxX) / 2;
  const centreYmm = (fp.minY + fp.maxY) / 2;
  const wallTopM =
    wallsAtRef.length > 0 ? Math.max(...wallsAtRef.map((w) => (w.heightMm ?? 0) / 1000)) : 0;
  const roofPlaneY = roofHeightAtPoint(hostRoof, elementsById, centreXmm, centreYmm);
  const baseY = Math.max(refElev + wallTopM, roofPlaneY - 0.05);
  const wallHeightM = THREE.MathUtils.clamp(dormer.wallHeightMm / 1000, 0.5, 8);
  const topY = baseY + wallHeightM;

  // World coords: plan-X → world-X, plan-Y → world-Z (no negation,
  // matching the wall + roof builders elsewhere in viewport/meshBuilders.ts).
  // The earlier negated convention placed dormer geometry ~plan-depth metres
  // away from the host building in world Z, rendering it invisible.
  const xMin = fp.minX / 1000;
  const xMax = fp.maxX / 1000;
  const zMin = fp.minY / 1000;
  const zMax = fp.maxY / 1000;
  const widthM = xMax - xMin;
  const depthM = zMax - zMin;
  const cheekThickM = 0.18;
  const roofThickM = 0.12;
  const openTowardPositiveAcross = (dormer.positionOnRoof.acrossRidgeMm ?? 0) >= 0;

  const wallSpec = resolveMaterial(dormer.wallMaterialKey ?? null);
  const wallColor = wallSpec?.baseColor ?? '#f4f4f0';
  const wallIsRender = wallSpec?.category === 'render' || wallSpec?.category === 'cladding';
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wallColor),
    roughness: wallSpec?.roughness ?? 0.92,
    metalness: wallSpec?.metalness ?? 0,
    envMapIntensity: wallIsRender ? 0.15 : 1.0,
  });

  const roofSpec = resolveMaterial(dormer.roofMaterialKey ?? null);
  const roofColor = roofSpec?.baseColor ?? wallColor;
  const roofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(roofColor),
    roughness: roofSpec?.roughness ?? 0.85,
    metalness: roofSpec?.metalness ?? 0,
    envMapIntensity: roofSpec?.category === 'metal_roof' ? 0.4 : 0.15,
  });
  void categoryColorOr;

  // Two cheek walls running along the depth direction (across ridge for
  // ridgeAlongX=false). For our target house ridge is along plan-Y, so the
  // dormer width axis = plan-Y = world-Z, depth axis = plan-X = world-X.
  // Cheek walls are perpendicular to the ridge i.e. in the X-Y world plane.
  if (fp.ridgeAlongX) {
    // Cheeks are walls of constant X (one at xMin, one at xMax), running
    // along world-Z for the dormer depth.
    for (const xWorld of [xMin + cheekThickM / 2, xMax - cheekThickM / 2]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(cheekThickM, wallHeightM, depthM),
        wallMat,
      );
      cheek.position.set(xWorld, baseY + wallHeightM / 2, (zMin + zMax) / 2);
      addEdges(cheek);
      group.add(cheek);
    }
    // Back wall faces the ridge; the open glazed face points down the roof
    // slope toward the eave side where the dormer was placed.
    const backWallZ = openTowardPositiveAcross ? zMin + cheekThickM / 2 : zMax - cheekThickM / 2;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(widthM, wallHeightM, cheekThickM),
      wallMat,
    );
    backWall.position.set((xMin + xMax) / 2, baseY + wallHeightM / 2, backWallZ);
    addEdges(backWall);
    group.add(backWall);
    addDormerFaceWindow(group, {
      ridgeAlongX: true,
      openTowardPositiveAcross,
      xMin,
      xMax,
      zMin,
      zMax,
      baseY,
      wallHeightM,
      cheekThickM,
    });
  } else {
    // Ridge along plan-Y → ridge along world-Z. Cheek walls are at zMin,zMax
    // running along world-X.
    for (const zWorld of [zMin + cheekThickM / 2, zMax - cheekThickM / 2]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(widthM, wallHeightM, cheekThickM),
        wallMat,
      );
      cheek.position.set((xMin + xMax) / 2, baseY + wallHeightM / 2, zWorld);
      addEdges(cheek);
      group.add(cheek);
    }
    // Back wall faces the ridge; the open glazed face points down the roof
    // slope toward the eave side where the dormer was placed.
    const backWallX = openTowardPositiveAcross ? xMin + cheekThickM / 2 : xMax - cheekThickM / 2;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(cheekThickM, wallHeightM, depthM),
      wallMat,
    );
    backWall.position.set(backWallX, baseY + wallHeightM / 2, (zMin + zMax) / 2);
    addEdges(backWall);
    group.add(backWall);
    addDormerFaceWindow(group, {
      ridgeAlongX: false,
      openTowardPositiveAcross,
      xMin,
      xMax,
      zMin,
      zMax,
      baseY,
      wallHeightM,
      cheekThickM,
    });
  }

  const roofKind = dormer.dormerRoofKind ?? 'flat';
  const ridgeHeightM =
    dormer.ridgeHeightMm != null ? Math.max(0.1, dormer.ridgeHeightMm / 1000) : 1.2;
  const eaveCenterX = (xMin + xMax) / 2;
  const eaveCenterZ = (zMin + zMax) / 2;

  if (roofKind === 'gable') {
    const roof = buildGableDormerRoof(
      widthM,
      depthM,
      roofThickM,
      ridgeHeightM,
      fp.ridgeAlongX,
      roofMat,
    );
    roof.position.set(eaveCenterX, topY, eaveCenterZ);
    addEdges(roof);
    group.add(roof);
  } else if (roofKind === 'hipped') {
    const roof = buildHippedDormerRoof(
      widthM,
      depthM,
      roofThickM,
      ridgeHeightM,
      fp.ridgeAlongX,
      roofMat,
    );
    roof.position.set(eaveCenterX, topY, eaveCenterZ);
    addEdges(roof);
    group.add(roof);
  } else {
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(widthM, roofThickM, depthM), roofMat);
    roofSlab.position.set(eaveCenterX, topY + roofThickM / 2, eaveCenterZ);
    addEdges(roofSlab);
    group.add(roofSlab);
  }

  void paint;
  return group;
}

function addDormerFaceWindow(
  group: THREE.Group,
  spec: {
    ridgeAlongX: boolean;
    openTowardPositiveAcross: boolean;
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
    baseY: number;
    wallHeightM: number;
    cheekThickM: number;
  },
): void {
  const glassSpec = resolveMaterial('glass_clear');
  const frameSpec = resolveMaterial('aluminium_dark_grey');
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glassSpec?.baseColor ?? '#b8d6e6'),
    roughness: glassSpec?.roughness ?? 0.05,
    metalness: glassSpec?.metalness ?? 0,
    transparent: true,
    opacity: 0.62,
    envMapIntensity: 0.9,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(frameSpec?.baseColor ?? '#343638'),
    roughness: frameSpec?.roughness ?? 0.35,
    metalness: frameSpec?.metalness ?? 0.4,
  });

  const widthM = spec.xMax - spec.xMin;
  const depthM = spec.zMax - spec.zMin;
  const glassHeight = Math.max(0.65, spec.wallHeightM * 0.52);
  const y = spec.baseY + spec.wallHeightM * 0.48;
  const frame = 0.045;
  const thin = 0.04;

  if (spec.ridgeAlongX) {
    const glassWidth = Math.max(0.7, widthM * 0.72);
    const z = spec.openTowardPositiveAcross
      ? spec.zMax - spec.cheekThickM / 2
      : spec.zMin + spec.cheekThickM / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassWidth, glassHeight, thin), glassMat);
    glass.position.set((spec.xMin + spec.xMax) / 2, y, z);
    group.add(glass);
    for (const x of [
      (spec.xMin + spec.xMax) / 2 - glassWidth / 2,
      (spec.xMin + spec.xMax) / 2,
      (spec.xMin + spec.xMax) / 2 + glassWidth / 2,
    ]) {
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(frame, glassHeight + frame, thin * 1.4),
        frameMat,
      );
      mullion.position.set(x, y, z);
      group.add(mullion);
    }
    for (const yy of [y - glassHeight / 2, y + glassHeight / 2]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(glassWidth + frame, frame, thin * 1.4),
        frameMat,
      );
      rail.position.set((spec.xMin + spec.xMax) / 2, yy, z);
      group.add(rail);
    }
    return;
  }

  const glassWidth = Math.max(0.7, depthM * 0.72);
  const x = spec.openTowardPositiveAcross
    ? spec.xMax - spec.cheekThickM / 2
    : spec.xMin + spec.cheekThickM / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(thin, glassHeight, glassWidth), glassMat);
  glass.position.set(x, y, (spec.zMin + spec.zMax) / 2);
  group.add(glass);
  for (const z of [
    (spec.zMin + spec.zMax) / 2 - glassWidth / 2,
    (spec.zMin + spec.zMax) / 2,
    (spec.zMin + spec.zMax) / 2 + glassWidth / 2,
  ]) {
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(thin * 1.4, glassHeight + frame, frame),
      frameMat,
    );
    mullion.position.set(x, y, z);
    group.add(mullion);
  }
  for (const yy of [y - glassHeight / 2, y + glassHeight / 2]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(thin * 1.4, frame, glassWidth + frame),
      frameMat,
    );
    rail.position.set(x, yy, (spec.zMin + spec.zMax) / 2);
    group.add(rail);
  }
}

/** KRN-14 — gable roof for a dormer. */
export function buildGableDormerRoof(
  widthM: number,
  depthM: number,
  roofThickM: number,
  ridgeHeightM: number,
  ridgeAlongX: boolean,
  material: THREE.Material,
): THREE.Mesh {
  const longAlongWorldX = ridgeAlongX ? widthM >= depthM : depthM >= widthM;
  const hxWorld = ridgeAlongX ? widthM / 2 : depthM / 2;
  const hzWorld = ridgeAlongX ? depthM / 2 : widthM / 2;
  const eaveY = roofThickM;
  const ridgeY = eaveY + ridgeHeightM;
  const positions: number[] = [];
  const indices: number[] = [];
  if (longAlongWorldX) {
    positions.push(-hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, hzWorld);
    positions.push(-hxWorld, eaveY, hzWorld);
    positions.push(-hxWorld, ridgeY, 0);
    positions.push(hxWorld, ridgeY, 0);
    indices.push(0, 1, 5, 0, 5, 4);
    indices.push(2, 3, 4, 2, 4, 5);
    indices.push(0, 4, 3);
    indices.push(1, 2, 5);
  } else {
    positions.push(-hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, hzWorld);
    positions.push(-hxWorld, eaveY, hzWorld);
    positions.push(0, ridgeY, -hzWorld);
    positions.push(0, ridgeY, hzWorld);
    indices.push(1, 2, 5, 1, 5, 4);
    indices.push(3, 0, 4, 3, 4, 5);
    indices.push(0, 1, 4);
    indices.push(2, 3, 5);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, material);
}

/** KRN-14 — hipped roof for a dormer (ridge shorter than the eave). */
export function buildHippedDormerRoof(
  widthM: number,
  depthM: number,
  roofThickM: number,
  ridgeHeightM: number,
  ridgeAlongX: boolean,
  material: THREE.Material,
): THREE.Mesh {
  const longAlongWorldX = ridgeAlongX ? widthM >= depthM : depthM >= widthM;
  const hxWorld = ridgeAlongX ? widthM / 2 : depthM / 2;
  const hzWorld = ridgeAlongX ? depthM / 2 : widthM / 2;
  const eaveY = roofThickM;
  const ridgeY = eaveY + ridgeHeightM;
  const longHalf = longAlongWorldX ? hxWorld : hzWorld;
  const ridgeHalf = Math.max(0.05, longHalf * 0.5);
  const positions: number[] = [];
  const indices: number[] = [];
  if (longAlongWorldX) {
    positions.push(-hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, hzWorld);
    positions.push(-hxWorld, eaveY, hzWorld);
    positions.push(-ridgeHalf, ridgeY, 0);
    positions.push(ridgeHalf, ridgeY, 0);
    indices.push(0, 1, 5, 0, 5, 4);
    indices.push(2, 3, 4, 2, 4, 5);
    indices.push(3, 0, 4);
    indices.push(1, 2, 5);
  } else {
    positions.push(-hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, -hzWorld);
    positions.push(hxWorld, eaveY, hzWorld);
    positions.push(-hxWorld, eaveY, hzWorld);
    positions.push(0, ridgeY, -ridgeHalf);
    positions.push(0, ridgeY, ridgeHalf);
    indices.push(1, 2, 5, 1, 5, 4);
    indices.push(3, 0, 4, 3, 4, 5);
    indices.push(0, 1, 4);
    indices.push(2, 3, 5);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, material);
}
