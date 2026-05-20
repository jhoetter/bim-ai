import * as THREE from 'three';

import { SLICE_Y } from './interaction/planCameraMath';
import { readPlanToken } from './planCanvasHelpers';

export type MarqueePreview = {
  line: THREE.Line;
  fill: THREE.Mesh;
};

export function disposeMarqueePreview(
  group: THREE.Group,
  preview: { line?: THREE.Line | null; fill?: THREE.Mesh | null },
): void {
  if (preview.line) {
    group.remove(preview.line);
    preview.line.geometry.dispose();
  }
  if (preview.fill) {
    group.remove(preview.fill);
    preview.fill.geometry.dispose();
  }
}

export function buildMarqueePreview(
  x0Mm: number,
  y0Mm: number,
  x1Mm: number,
  y1Mm: number,
  crossing: boolean,
): MarqueePreview {
  const xMinM = Math.min(x0Mm, x1Mm) / 1000;
  const xMaxM = Math.max(x0Mm, x1Mm) / 1000;
  const zMinM = Math.min(y0Mm, y1Mm) / 1000;
  const zMaxM = Math.max(y0Mm, y1Mm) / 1000;
  const points = [
    new THREE.Vector3(xMinM, SLICE_Y, zMinM),
    new THREE.Vector3(xMaxM, SLICE_Y, zMinM),
    new THREE.Vector3(xMaxM, SLICE_Y, zMaxM),
    new THREE.Vector3(xMinM, SLICE_Y, zMaxM),
    new THREE.Vector3(xMinM, SLICE_Y, zMinM),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const borderColor = readPlanToken('--draft-construction-blue', '#2563eb');
  const material = crossing
    ? new THREE.LineDashedMaterial({ color: borderColor, dashSize: 0.3, gapSize: 0.15 })
    : new THREE.LineBasicMaterial({ color: borderColor });
  const line = new THREE.Line(geometry, material);
  if (crossing) line.computeLineDistances();

  const fillGeometry = new THREE.PlaneGeometry(xMaxM - xMinM, zMaxM - zMinM);
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: crossing ? 0x22c55e : 0x2563eb,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.rotation.x = -Math.PI / 2;
  fill.position.set((xMinM + xMaxM) / 2, SLICE_Y - 0.001, (zMinM + zMaxM) / 2);

  return { line, fill };
}
