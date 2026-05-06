import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, beforeAll } from 'vitest';
import * as THREE from 'three';
import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';
import type { Element } from '@bim-ai/core';

import { makeText3dMesh, _setText3dFontForTesting } from './text3dGeometry';

type Text3dElem = Extract<Element, { kind: 'text_3d' }>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(__dirname, '../../public/fonts/helvetiker_regular.typeface.json');

let helveticaFont: Font;

beforeAll(() => {
  const json = JSON.parse(readFileSync(FONT_PATH, 'utf8')) as FontData;
  helveticaFont = new Font(json);
  _setText3dFontForTesting('helvetiker', helveticaFont);
});

const baseText: Text3dElem = {
  kind: 'text_3d',
  id: 't1',
  text: 'BIM AI',
  fontFamily: 'helvetiker',
  fontSizeMm: 200,
  depthMm: 50,
  positionMm: { xMm: 0, yMm: 0, zMm: 0 },
  rotationDeg: 0,
};

describe('makeText3dMesh', () => {
  it('produces a Three.js Mesh with non-empty geometry', () => {
    const mesh = makeText3dMesh(baseText, helveticaFont, null);
    expect(mesh.isMesh).toBe(true);
    const pos = mesh.geometry.getAttribute('position');
    expect(pos).toBeDefined();
    expect(pos.count).toBeGreaterThan(0);
  });

  it('records the element id on userData.bimPickId for picking', () => {
    const mesh = makeText3dMesh(baseText, helveticaFont, null);
    expect(mesh.userData.bimPickId).toBe('t1');
  });

  it('positions the mesh with model XY → world XZ and Z → world Y (mm → m)', () => {
    const positioned: Text3dElem = {
      ...baseText,
      positionMm: { xMm: 1500, yMm: 2500, zMm: 3000 },
    };
    const mesh = makeText3dMesh(positioned, helveticaFont, null);
    expect(mesh.position.x).toBeCloseTo(1.5, 5);
    expect(mesh.position.y).toBeCloseTo(3.0, 5);
    expect(mesh.position.z).toBeCloseTo(2.5, 5);
  });

  it('honors rotationDeg (around Y axis)', () => {
    const rotated: Text3dElem = { ...baseText, rotationDeg: 90 };
    const mesh = makeText3dMesh(rotated, helveticaFont, null);
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });

  it('produces a bounding box scaled by fontSizeMm and depthMm', () => {
    const small: Text3dElem = { ...baseText, fontSizeMm: 100, depthMm: 25 };
    const big: Text3dElem = { ...baseText, fontSizeMm: 400, depthMm: 100 };
    const meshSmall = makeText3dMesh(small, helveticaFont, null);
    const meshBig = makeText3dMesh(big, helveticaFont, null);

    const bbSmall = meshSmall.geometry.boundingBox;
    const bbBig = meshBig.geometry.boundingBox;
    expect(bbSmall).toBeDefined();
    expect(bbBig).toBeDefined();

    if (bbSmall && bbBig) {
      const widthSmall = bbSmall.max.x - bbSmall.min.x;
      const widthBig = bbBig.max.x - bbBig.min.x;
      // 4× font size → ~4× horizontal extent
      expect(widthBig / widthSmall).toBeCloseTo(4, 0);

      const depthSmall = bbSmall.max.z - bbSmall.min.z;
      const depthBig = bbBig.max.z - bbBig.min.z;
      // depth multiplier 4× → 4× depth-axis extent
      expect(depthBig / depthSmall).toBeCloseTo(4, 0);
    }
  });

  it('handles single-character strings', () => {
    const single: Text3dElem = { ...baseText, text: 'A' };
    const mesh = makeText3dMesh(single, helveticaFont, null);
    expect(mesh.isMesh).toBe(true);
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('uses a MeshStandardMaterial (responds to lighting)', () => {
    const mesh = makeText3dMesh(baseText, helveticaFont, null);
    const mat = mesh.material as THREE.Material;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
});
