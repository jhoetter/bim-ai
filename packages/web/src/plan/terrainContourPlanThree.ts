import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y } from './symbology';
import { terrainContourLinesMm } from './terrainContourLines';

type ToposolidElem = Extract<Element, { kind: 'toposolid' }>;

const CONTOUR_COLOR = '#6b5c3e';
const MAJOR_CONTOUR_COLOR = '#4a3f2b';

export function terrainContourPlanThree(topo: ToposolidElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = topo.id;

  if (!topo.contourIntervalMm || topo.contourIntervalMm <= 0) return group;

  const polylines = terrainContourLinesMm(
    topo.heightSamples ?? [],
    topo.boundaryMm,
    topo.contourIntervalMm,
  );

  const minZ = Math.min(...(topo.heightSamples ?? []).map((s) => s.zMm));
  const interval = topo.contourIntervalMm;

  polylines.forEach((pts) => {
    if (pts.length < 2) return;

    // Determine which contour level this polyline represents (approximate from first midpoint)
    const midX = pts.reduce((s, p) => s + p.xMm, 0) / pts.length;
    const midY = pts.reduce((s, p) => s + p.yMm, 0) / pts.length;
    // Use nearest height sample to estimate the contour level index
    const samples = topo.heightSamples ?? [];
    let bestDist = Infinity;
    let approxZ = minZ;
    for (const s of samples) {
      const dx = s.xMm - midX;
      const dy = s.yMm - midY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        approxZ = s.zMm;
      }
    }
    const levelIndex = Math.round(approxZ / interval);
    const isMajor = levelIndex % 5 === 0;

    const positions: number[] = [];
    for (const p of pts) {
      positions.push(p.xMm / 1000, PLAN_Y + 0.004, p.yMm / 1000);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: isMajor ? MAJOR_CONTOUR_COLOR : CONTOUR_COLOR,
      opacity: 0.8,
      transparent: true,
    });

    const line = new THREE.Line(geo, mat);
    line.userData.bimPickId = topo.id;
    group.add(line);
  });

  return group;
}
