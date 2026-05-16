import * as THREE from 'three';

import type { Element } from '@bim-ai/core';
import { PLAN_Y } from './symbology';

type CeilingElem = Extract<Element, { kind: 'ceiling' }>;

function pointInPolygon(
  px: number,
  py: number,
  poly: Array<{ xMm: number; yMm: number }>,
): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.xMm;
    const yi = poly[i]!.yMm;
    const xj = poly[j]!.xMm;
    const yj = poly[j]!.yMm;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function ceilingGridPlanThree(ceiling: CeilingElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = ceiling.id;

  if (!ceiling.gridPatternMm || ceiling.gridPatternMm <= 0) return group;

  const poly = ceiling.boundaryMm;
  if (!poly || poly.length < 3) return group;

  const step = ceiling.gridPatternMm;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.xMm < minX) minX = p.xMm;
    if (p.xMm > maxX) maxX = p.xMm;
    if (p.yMm < minY) minY = p.yMm;
    if (p.yMm > maxY) maxY = p.yMm;
  }

  const positions: number[] = [];

  // Vertical lines (constant x)
  const xStart = Math.ceil(minX / step) * step;
  for (let x = xStart; x <= maxX; x += step) {
    const midY = (minY + maxY) / 2;
    if (pointInPolygon(x, midY, poly)) {
      positions.push(x / 1000, PLAN_Y + 0.002, minY / 1000);
      positions.push(x / 1000, PLAN_Y + 0.002, maxY / 1000);
    }
  }

  // Horizontal lines (constant y)
  const yStart = Math.ceil(minY / step) * step;
  for (let y = yStart; y <= maxY; y += step) {
    const midX = (minX + maxX) / 2;
    if (pointInPolygon(midX, y, poly)) {
      positions.push(minX / 1000, PLAN_Y + 0.002, y / 1000);
      positions.push(maxX / 1000, PLAN_Y + 0.002, y / 1000);
    }
  }

  if (positions.length === 0) return group;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({ color: '#999999', opacity: 0.6, transparent: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.userData.bimPickId = ceiling.id;

  group.add(lines);
  return group;
}
