import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import type { ViewportPaintBundle } from '../../viewport/materials';
import { resolveParam, type FamilyDefinition } from '../types';

export type RailingGeomInput = {
  railing: Extract<Element, { kind: 'railing' }>;
  baseElevM: number;
  topElevM: number;
  paint: ViewportPaintBundle | null;
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

export function buildRailingGeometry(input: RailingGeomInput): THREE.Group {
  const { railing, baseElevM, topElevM, paint, familyDef } = input;

  const group = new THREE.Group();
  group.userData.bimPickId = railing.id;

  const ip = railing.overrideParams;
  const typeEntry = railing.overrideParams?.familyTypeId
    ? familyDef?.defaultTypes.find((t) => t.id === railing.overrideParams?.familyTypeId)
    : undefined;
  const tp = typeEntry?.parameters;

  const guardH = THREE.MathUtils.clamp(
    Number(resolveParam('guardHeightMm', ip, tp, familyDef, railing.guardHeightMm ?? 1050)) / 1000,
    0.5,
    2.2,
  );
  const postSect = Number(resolveParam('postSectMm', ip, tp, familyDef, 50)) / 1000;
  const balSpacing = Number(resolveParam('balSpacingMm', ip, tp, familyDef, 115)) / 1000;

  const pts = railing.pathMm ?? [];
  if (pts.length < 2) return group;

  const baseElev = baseElevM;
  const topElev = topElevM;

  let totalPlanLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalPlanLen += Math.hypot(
      (pts[i]!.xMm - pts[i - 1]!.xMm) / 1000,
      (pts[i]!.yMm - pts[i - 1]!.yMm) / 1000,
    );
  }

  const mat = new THREE.MeshStandardMaterial({
    color: paint?.categories.railing.color ?? FALLBACK_COLOR,
    roughness: 0.35,
    metalness: 0.65,
  });

  const vertexT: number[] = [0];
  let cumForT = 0;
  for (let i = 1; i < pts.length; i++) {
    cumForT += Math.hypot(
      (pts[i]!.xMm - pts[i - 1]!.xMm) / 1000,
      (pts[i]!.yMm - pts[i - 1]!.yMm) / 1000,
    );
    vertexT.push(totalPlanLen > 0 ? cumForT / totalPlanLen : 1);
  }

  const postGeom = new THREE.BoxGeometry(postSect, guardH, postSect);
  for (let i = 0; i < pts.length; i++) {
    const t = vertexT[i]!;
    const floorY = baseElev + t * (topElev - baseElev);
    const post = new THREE.Mesh(postGeom, mat);
    post.position.set(pts[i]!.xMm / 1000, floorY + guardH / 2, pts[i]!.yMm / 1000);
    post.castShadow = post.receiveShadow = true;
    post.userData.bimPickId = railing.id;
    addEdges(post);
    group.add(post);
  }

  const capSect = 0.045;
  const balW = 0.012;
  const balGeom = new THREE.BoxGeometry(balW, guardH, balW);

  let cumLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ax = a.xMm / 1000,
      az = a.yMm / 1000;
    const bx = b.xMm / 1000,
      bz = b.yMm / 1000;
    const planSeg = Math.max(0.001, Math.hypot(bx - ax, bz - az));
    const tA = totalPlanLen > 0 ? cumLen / totalPlanLen : 0;
    cumLen += planSeg;
    const tB = totalPlanLen > 0 ? cumLen / totalPlanLen : 1;
    const floorA = baseElev + tA * (topElev - baseElev);
    const floorB = baseElev + tB * (topElev - baseElev);
    const elevA = floorA + guardH;
    const elevB = floorB + guardH;
    const riseY = elevB - elevA;

    const railLen = Math.sqrt(planSeg * planSeg + riseY * riseY);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, capSect, capSect), mat);
    rail.position.set((ax + bx) / 2, (elevA + elevB) / 2, (az + bz) / 2);
    const dir = new THREE.Vector3(bx - ax, riseY, bz - az).normalize();
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    rail.castShadow = rail.receiveShadow = true;
    rail.userData.bimPickId = railing.id;
    addEdges(rail);
    group.add(rail);

    const balCount = Math.max(0, Math.floor(planSeg / balSpacing));
    for (let j = 0; j < balCount; j++) {
      const tLocal = (j + 0.5) / balCount;
      const bxj = ax + tLocal * (bx - ax);
      const bzj = az + tLocal * (bz - az);
      const floorYj = floorA + tLocal * (floorB - floorA);
      const bal = new THREE.Mesh(balGeom, mat);
      bal.position.set(bxj, floorYj + guardH / 2, bzj);
      bal.castShadow = bal.receiveShadow = true;
      bal.userData.bimPickId = railing.id;
      addEdges(bal);
      group.add(bal);
    }
  }

  return group;
}
