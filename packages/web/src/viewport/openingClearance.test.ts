import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { windowCutterGeometry } from './csgCutterGeometry';
import {
  frontBackWallFaceTrianglesInsideOpening,
  openingSpanFromBoxCutter,
  type OpeningClearanceSpan,
} from './openingClearance';

function translatedBox(width: number, height: number, depth: number, x: number, y: number) {
  const geom = new THREE.BoxGeometry(width, height, depth);
  geom.translate(x, y, 0);
  return geom;
}

function cutWallPanels(
  wallLenM: number,
  wallHeightM: number,
  wallThickM: number,
  span: OpeningClearanceSpan,
): THREE.BufferGeometry[] {
  const wallLeft = -wallLenM / 2;
  const wallRight = wallLenM / 2;
  const wallBottom = -wallHeightM / 2;
  const wallTop = wallHeightM / 2;
  const panels: THREE.BufferGeometry[] = [];

  const leftW = span.xMin - wallLeft;
  if (leftW > 0.001) {
    panels.push(translatedBox(leftW, wallHeightM, wallThickM, wallLeft + leftW / 2, 0));
  }
  const rightW = wallRight - span.xMax;
  if (rightW > 0.001) {
    panels.push(translatedBox(rightW, wallHeightM, wallThickM, span.xMax + rightW / 2, 0));
  }
  const bottomH = span.yMin - wallBottom;
  if (bottomH > 0.001) {
    panels.push(
      translatedBox(span.xMax - span.xMin, bottomH, wallThickM, 0, wallBottom + bottomH / 2),
    );
  }
  const topH = wallTop - span.yMax;
  if (topH > 0.001) {
    panels.push(translatedBox(span.xMax - span.xMin, topH, wallThickM, 0, span.yMax + topH / 2));
  }

  return panels;
}

describe('opening clearance checks', () => {
  it('detects wall face triangles that would be visible behind hosted window glass', () => {
    const wallLenM = 6;
    const wallHeightM = 2.8;
    const wallThickM = 0.25;
    const cutter = windowCutterGeometry(
      {
        widthMm: 1600,
        heightMm: 1200,
        sillHeightMm: 900,
        alongT: 0.5,
        wallHeightMm: wallHeightM * 1000,
      },
      wallLenM,
      wallHeightM,
      wallThickM,
    );
    const span = openingSpanFromBoxCutter(cutter);
    const uncutWall = new THREE.BoxGeometry(wallLenM, wallHeightM, wallThickM);

    expect(frontBackWallFaceTrianglesInsideOpening(uncutWall, wallThickM, span)).toBeGreaterThan(0);
  });

  it('passes when wall panels are split around the hosted window aperture', () => {
    const wallLenM = 6;
    const wallHeightM = 2.8;
    const wallThickM = 0.25;
    const cutter = windowCutterGeometry(
      {
        widthMm: 1600,
        heightMm: 1200,
        sillHeightMm: 900,
        alongT: 0.5,
        wallHeightMm: wallHeightM * 1000,
      },
      wallLenM,
      wallHeightM,
      wallThickM,
    );
    const span = openingSpanFromBoxCutter(cutter);
    const panels = cutWallPanels(wallLenM, wallHeightM, wallThickM, span);

    for (const panel of panels) {
      expect(frontBackWallFaceTrianglesInsideOpening(panel, wallThickM, span)).toBe(0);
    }
  });
});
