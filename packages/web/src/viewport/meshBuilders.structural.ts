import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { buildBeamProfileGeometry } from './beamProfileMesh';
import { categoryColorOr, addEdges } from './sceneHelpers';
import { makeThreeMaterialForKey } from './threeMaterialFactory';
import type { ViewportPaintBundle } from './materials';
import { yawForPlanSegment } from './planSegmentOrientation';

export function makeColumnMesh(
  col: Extract<Element, { kind: 'column' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const bM = THREE.MathUtils.clamp((col.bMm ?? 300) / 1000, 0.05, 2);
  const hM = THREE.MathUtils.clamp((col.hMm ?? 300) / 1000, 0.05, 2);
  const baseOff = (col.baseConstraintOffsetMm ?? 0) / 1000;
  const topOff = col.topConstraintOffsetMm != null ? col.topConstraintOffsetMm / 1000 : 0;
  const heightM = col.heightMm != null ? THREE.MathUtils.clamp(col.heightMm / 1000, 0.25, 40) : 3.0;
  const yBase = elevM + baseOff;
  const geo = new THREE.BoxGeometry(bM, heightM, hM);
  const topOffsetXM = (col.topOffsetXMm ?? 0) / 1000;
  const topOffsetYM = (col.topOffsetYMm ?? 0) / 1000;
  if (topOffsetXM !== 0 || topOffsetYM !== 0) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        pos.setX(i, pos.getX(i) + topOffsetXM);
        pos.setZ(i, pos.getZ(i) + topOffsetYM);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  const isStructural = col.columnUsage === 'structural';
  const mat = makeThreeMaterialForKey(col.materialKey, {
    usage: 'structural',
    fallbackColor: isStructural ? '#708090' : categoryColorOr(paint, 'wall'),
    fallbackRoughness: isStructural ? 0.6 : (paint?.categories.wall.roughness ?? 0.8),
    fallbackMetalness: isStructural ? 0.4 : (paint?.categories.wall.metalness ?? 0),
  });
  if (col.graphicsOverride?.surfaceColorHex) {
    (mat as THREE.MeshStandardMaterial).color.set(col.graphicsOverride.surfaceColorHex);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    col.positionMm.xMm / 1000,
    yBase + heightM / 2 + topOff,
    col.positionMm.yMm / 1000,
  );
  mesh.rotation.y = THREE.MathUtils.degToRad(col.rotationDeg ?? 0);
  mesh.userData.columnUsage = col.columnUsage ?? 'architectural';
  addEdges(mesh);
  return mesh;
}

export function makeBeamMesh(
  beam: Extract<Element, { kind: 'beam' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const sx = beam.startMm.xMm / 1000;
  const sz = beam.startMm.yMm / 1000;
  const ex = beam.endMm.xMm / 1000;
  const ez = beam.endMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const hM = THREE.MathUtils.clamp((beam.heightMm ?? 400) / 1000, 0.05, 1);
  const geo = buildBeamProfileGeometry(beam);
  const mat = makeThreeMaterialForKey(beam.materialKey, {
    usage: 'structural',
    fallbackColor: categoryColorOr(paint, 'wall'),
    fallbackRoughness: paint?.categories.wall.roughness ?? 0.8,
    fallbackMetalness: paint?.categories.wall.metalness ?? 0,
  });
  if (beam.graphicsOverride?.surfaceColorHex) {
    (mat as THREE.MeshStandardMaterial).color.set(beam.graphicsOverride.surfaceColorHex);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx + dx / 2, elevM - hM / 2, sz + dz / 2);
  mesh.rotation.y = yawForPlanSegment(dx, dz);
  addEdges(mesh);
  return mesh;
}

export function buildSteelConnectionMesh(
  conn: Extract<Element, { kind: 'steel_connection' }>,
): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = conn.id;

  const plate = conn.plateSizeMm ?? { width: 150, height: 200, thickness: 10 };
  const wM = plate.width / 1000;
  const hM = plate.height / 1000;
  const tM = plate.thickness / 1000;
  const bRows = Math.max(0, conn.boltRows ?? 2);
  const bCols = Math.max(0, conn.boltCols ?? 2);
  const bDiam = (conn.boltDiameterMm ?? 20) / 1000;
  const mat = new THREE.MeshStandardMaterial({
    color: '#5a5a5a',
    roughness: 0.6,
    metalness: 0.5,
  });

  if (conn.connectionType === 'end_plate') {
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(wM, hM, tM), mat));
    addSteelBoltGrid(grp, mat, bRows, bCols, bDiam, wM, hM, tM);
  } else if (conn.connectionType === 'bolted_flange') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(wM, tM, hM / 2), mat.clone());
    top.position.set(0, hM / 4, 0);
    grp.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(wM, tM, hM / 2), mat.clone());
    bot.position.set(0, -hM / 4, 0);
    grp.add(bot);
    addSteelBoltGrid(grp, mat, bRows, bCols, bDiam, wM, tM, tM * 1.5, hM / 4);
    addSteelBoltGrid(grp, mat, bRows, bCols, bDiam, wM, tM, tM * 1.5, -hM / 4);
  } else {
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(tM, hM, wM / 4), mat));
    if (bRows > 0) {
      addSteelBoltGrid(grp, mat, bRows, 1, bDiam, tM, hM, tM * 1.5);
    }
  }

  return grp;
}

function addSteelBoltGrid(
  grp: THREE.Group,
  mat: THREE.Material,
  rows: number,
  cols: number,
  diam: number,
  plateW: number,
  plateH: number,
  boltH: number,
  yOffset = 0,
): void {
  if (rows === 0 || cols === 0) return;
  const xStep = cols > 1 ? (plateW * 0.6) / (cols - 1) : 0;
  const yStep = rows > 1 ? (plateH * 0.6) / (rows - 1) : 0;
  const xStart = cols > 1 ? -(plateW * 0.3) : 0;
  const yStart = rows > 1 ? -(plateH * 0.3) : 0;
  const boltGeo = new THREE.CylinderGeometry(diam / 2, diam / 2, boltH, 8);
  boltGeo.rotateX(Math.PI / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bolt = new THREE.Mesh(boltGeo, mat);
      bolt.position.set(xStart + c * xStep, yStart + r * yStep + yOffset, 0);
      grp.add(bolt);
    }
  }
}
