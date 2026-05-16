import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { categoryColorOr, addEdges } from './sceneHelpers';
import type { ViewportPaintBundle } from './materials';
import { elevationMForLevel } from './meshBuilders';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

type StairElem = Extract<Element, { kind: 'stair' }>;
type Vec2Mm = { xMm: number; yMm: number };

const TREAD_THICK = 0.04;

function materialSlot(
  slots: Record<string, string | null> | null | undefined,
  slot: string,
): string | null | undefined {
  const value = slots?.[slot];
  if (typeof value === 'string') return value.trim() ? value : null;
  return value;
}

function stairMaterialKey(stair: StairElem, slot: string): string | null | undefined {
  return (
    materialSlot(stair.materialSlots, slot) ??
    (stair.subKind === 'monolithic' ? stair.monolithicMaterial : null)
  );
}

function makeStairSubcomponentMaterial(
  stair: StairElem,
  slot: string,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Material {
  return makeThreeMaterialForKey(stairMaterialKey(stair, slot), {
    elementsById,
    usage: 'generic',
    fallbackColor: categoryColorOr(paint, 'stair'),
    fallbackRoughness: paint?.categories.stair.roughness ?? 0.85,
    fallbackMetalness: paint?.categories.stair.metalness ?? 0,
  });
}

/**
 * WP-C C2: Collect all floor boundary elevations (in metres) between
 * baseLevelId and topLevelId, sorted ascending. The returned array includes
 * the base elevation as first element and the top elevation as last.
 */
export function collectFloorElevations(
  baseLevelId: string,
  topLevelId: string,
  elementsById: Record<string, Element>,
): number[] {
  const baseElev = elevationMForLevel(baseLevelId, elementsById);
  const topElev = elevationMForLevel(topLevelId, elementsById);

  const intermediate: number[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'level') continue;
    if (el.id === baseLevelId || el.id === topLevelId) continue;
    const elev = el.elevationMm / 1000;
    if (elev > baseElev && elev < topElev) {
      intermediate.push(elev);
    }
  }
  intermediate.sort((a, b) => a - b);
  return [baseElev, ...intermediate, topElev];
}

/**
 * Build one floor-segment worth of stair geometry and append the resulting
 * meshes to `group`. `baseElev` and `topElev` are in metres.
 */
function appendSingleStoreyStairMeshes(
  stair: StairElem,
  baseElev: number,
  topElev: number,
  treadMat: THREE.Material,
  landingMat: THREE.Material,
  group: THREE.Group,
): void {
  const totalRise = Math.max(Math.abs(topElev - baseElev), 0.1);

  if (
    stair.shape === 'spiral' &&
    stair.centerMm != null &&
    stair.innerRadiusMm != null &&
    stair.outerRadiusMm != null &&
    stair.totalRotationDeg != null
  ) {
    const riserCount = Math.max(1, stair.runs?.[0]?.riserCount ?? 12);
    const riserH = totalRise / riserCount;
    const flight = buildSpiralStairFlight(
      stair.centerMm,
      stair.innerRadiusMm,
      stair.outerRadiusMm,
      stair.totalRotationDeg,
      riserCount,
      baseElev,
      riserH,
      treadMat,
    );
    for (const tread of flight) {
      tread.userData.bimPickId = stair.id;
      tread.userData.materialSlot = 'tread';
      addEdges(tread);
      group.add(tread);
    }
    return;
  }

  if (stair.shape === 'sketch' && stair.sketchPathMm && stair.sketchPathMm.length >= 2) {
    const riserCount = Math.max(1, stair.runs?.[0]?.riserCount ?? stair.sketchPathMm.length - 1);
    const riserH = totalRise / riserCount;
    const widthM = THREE.MathUtils.clamp(stair.widthMm / 1000, 0.3, 4);
    const flight = buildSketchStairFlight(
      stair.sketchPathMm,
      riserCount,
      widthM,
      baseElev,
      riserH,
      treadMat,
    );
    for (const tread of flight) {
      tread.userData.bimPickId = stair.id;
      tread.userData.materialSlot = 'tread';
      addEdges(tread);
      group.add(tread);
    }
    return;
  }

  const runs = stair.runs ?? [];
  const landings = stair.landings ?? [];

  const totalRisers = Math.max(
    1,
    runs.reduce((s, r) => s + Math.max(1, r.riserCount), 0),
  );
  const riserH = totalRise / totalRisers;

  let risersConsumed = 0;
  for (const run of runs) {
    const sx = run.startMm.xMm / 1000;
    const sz = run.startMm.yMm / 1000;
    const ex = run.endMm.xMm / 1000;
    const ez = run.endMm.yMm / 1000;
    const dx = ex - sx;
    const dz = ez - sz;
    const runLen = Math.max(1e-3, Math.hypot(dx, dz));
    const runWidth = THREE.MathUtils.clamp(run.widthMm / 1000, 0.3, 4);
    const angle = Math.atan2(dz, dx);
    const riserCount = Math.max(1, run.riserCount);
    const treadDepth = runLen / riserCount;
    const runStartElev = baseElev + risersConsumed * riserH;

    const treadGeom = new THREE.BoxGeometry(treadDepth, TREAD_THICK, runWidth);
    for (let i = 0; i < riserCount; i++) {
      const treadMesh = new THREE.Mesh(treadGeom, treadMat);
      const cx = sx + ((i + 0.5) / riserCount) * dx;
      const cz = sz + ((i + 0.5) / riserCount) * dz;
      const cy = runStartElev + (i + 1) * riserH - TREAD_THICK / 2;
      treadMesh.position.set(cx, cy, cz);
      treadMesh.rotation.y = angle;
      treadMesh.castShadow = true;
      treadMesh.receiveShadow = true;
      treadMesh.userData.bimPickId = stair.id;
      treadMesh.userData.materialSlot = 'tread';
      addEdges(treadMesh);
      group.add(treadMesh);
    }

    risersConsumed += riserCount;
  }

  let landingRisersConsumed = 0;
  for (let li = 0; li < landings.length && li + 1 < runs.length; li++) {
    landingRisersConsumed += runs[li].riserCount;
    const landing = landings[li];
    if (landing.boundaryMm.length < 3) continue;
    const landingY = baseElev + landingRisersConsumed * riserH;
    const shape = new THREE.Shape(
      landing.boundaryMm.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)),
    );
    const geom = new THREE.ExtrudeGeometry(shape, { depth: TREAD_THICK, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, landingY, 0);
    const mesh = new THREE.Mesh(geom, landingMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bimPickId = stair.id;
    mesh.userData.materialSlot = 'landing';
    addEdges(mesh);
    group.add(mesh);
  }
}

/**
 * KRN-07 / WP-C C2 — render a multi-run stair as inclined flights with flat
 * polygon landings between them. When `stair.multiStorey === true` the
 * geometry is stacked once per floor-to-floor segment.
 */
export function makeMultiRunStairMesh(
  stair: StairElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();

  const treadMat = makeStairSubcomponentMaterial(stair, 'tread', elementsById, paint);
  const landingMat = makeStairSubcomponentMaterial(stair, 'landing', elementsById, paint);

  if (stair.multiStorey) {
    const elevations = collectFloorElevations(stair.baseLevelId, stair.topLevelId, elementsById);
    for (let i = 0; i < elevations.length - 1; i++) {
      appendSingleStoreyStairMeshes(
        stair,
        elevations[i],
        elevations[i + 1],
        treadMat,
        landingMat,
        group,
      );
    }
  } else {
    const baseLevelElev = elevationMForLevel(stair.baseLevelId, elementsById);
    const topLevelElev = elevationMForLevel(stair.topLevelId, elementsById);
    appendSingleStoreyStairMeshes(stair, baseLevelElev, topLevelElev, treadMat, landingMat, group);
  }

  group.userData.bimPickId = stair.id;
  return group;
}
/**
 * Build N annular-sector tread meshes around a centre. Each tread sweeps
 * `totalRotDeg / riserCount` of arc and rises one riser. Returned in order
 * from base to top.
 */
export function buildSpiralStairFlight(
  center: Vec2Mm,
  innerR: number,
  outerR: number,
  totalRotDeg: number,
  riserCount: number,
  baseElev: number,
  riserH: number,
  material: THREE.Material,
): THREE.Mesh[] {
  const cx = center.xMm / 1000;
  const cz = center.yMm / 1000;
  const innerR_m = innerR / 1000;
  const outerR_m = outerR / 1000;
  const totalRotRad = THREE.MathUtils.degToRad(totalRotDeg);
  const stepRad = totalRotRad / riserCount;
  const arcSegments = 8;

  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < riserCount; i++) {
    const theta0 = stepRad * i;
    const theta1 = stepRad * (i + 1);

    const shape = new THREE.Shape();
    for (let s = 0; s <= arcSegments; s++) {
      const t = theta0 + (theta1 - theta0) * (s / arcSegments);
      const x = innerR_m * Math.cos(t);
      const y = innerR_m * Math.sin(t);
      if (s === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    for (let s = arcSegments; s >= 0; s--) {
      const t = theta0 + (theta1 - theta0) * (s / arcSegments);
      shape.lineTo(outerR_m * Math.cos(t), outerR_m * Math.sin(t));
    }
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: TREAD_THICK,
      bevelEnabled: false,
    });
    geom.rotateX(-Math.PI / 2);
    const top = baseElev + (i + 1) * riserH;
    geom.translate(cx, top - TREAD_THICK, cz);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * Build N tread box meshes stepped along a polyline. Each tread is a perpendicular
 * slab of `widthM` centred on the polyline tangent and rising by one riser height.
 */
export function buildSketchStairFlight(
  pathMm: Vec2Mm[],
  riserCount: number,
  widthM: number,
  baseElev: number,
  riserH: number,
  material: THREE.Material,
): THREE.Mesh[] {
  const pts = pathMm.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000));
  const cumulative: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const totalLen = cumulative[cumulative.length - 1];
  const meshes: THREE.Mesh[] = [];
  if (totalLen < 1e-6) return meshes;

  function pointAt(arc: number): { p: THREE.Vector2; tx: number; tz: number } {
    if (arc <= 0) {
      const tan = pts[1].clone().sub(pts[0]).normalize();
      return { p: pts[0].clone(), tx: tan.x, tz: tan.y };
    }
    if (arc >= totalLen) {
      const last = pts.length - 1;
      const tan = pts[last]
        .clone()
        .sub(pts[last - 1])
        .normalize();
      return { p: pts[last].clone(), tx: tan.x, tz: tan.y };
    }
    for (let i = 1; i < pts.length; i++) {
      if (cumulative[i] >= arc) {
        const segStart = cumulative[i - 1];
        const segLen = cumulative[i] - segStart;
        const t = (arc - segStart) / segLen;
        const p = pts[i - 1].clone().lerp(pts[i], t);
        const tan = pts[i]
          .clone()
          .sub(pts[i - 1])
          .normalize();
        return { p, tx: tan.x, tz: tan.y };
      }
    }
    const last = pts.length - 1;
    const tan = pts[last]
      .clone()
      .sub(pts[last - 1])
      .normalize();
    return { p: pts[last].clone(), tx: tan.x, tz: tan.y };
  }

  const treadDepth = totalLen / riserCount;
  for (let i = 0; i < riserCount; i++) {
    const arc = ((i + 0.5) / riserCount) * totalLen;
    const { p, tx, tz } = pointAt(arc);
    const angle = Math.atan2(tz, tx);
    const top = baseElev + (i + 1) * riserH;
    const geom = new THREE.BoxGeometry(treadDepth, TREAD_THICK, widthM);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(p.x, top - TREAD_THICK / 2, p.y);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return meshes;
}
