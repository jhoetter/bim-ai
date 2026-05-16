import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { modelLinePlanThree } from './planElementMeshBuilders';

type ModelLine = Extract<Element, { kind: 'model_line' }>;

const baseLine: ModelLine = {
  kind: 'model_line',
  id: 'ml-1',
  levelId: 'lvl-1',
  pointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
  ],
};

describe('modelLinePlanThree — §7.1.1', () => {
  it('returns a THREE.Object3D', () => {
    const obj = modelLinePlanThree(baseLine);
    expect(obj).toBeInstanceOf(THREE.Object3D);
  });

  it('has userData.kind = model_line on the inner line', () => {
    const grp = modelLinePlanThree(baseLine) as THREE.Group;
    const line = grp.children.find((c) => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    expect(line!.userData.kind).toBe('model_line');
  });

  it('uses custom colourHex when set', () => {
    const coloured: ModelLine = { ...baseLine, colourHex: '#ff0000' };
    const grp = modelLinePlanThree(coloured) as THREE.Group;
    const line = grp.children.find((c) => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    const mat = line!.material as THREE.LineBasicMaterial;
    expect(mat.color.getHexString()).toBe('ff0000');
  });

  it('uses default colour when colourHex is not set', () => {
    const grp = modelLinePlanThree(baseLine) as THREE.Group;
    const line = grp.children.find((c) => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    const mat = line!.material as THREE.LineBasicMaterial;
    expect(mat.color.getHexString()).toBe('333333');
  });

  it('uses LineDashedMaterial for dashed line style', () => {
    const dashed: ModelLine = { ...baseLine, lineStyle: 'dashed' };
    const grp = modelLinePlanThree(dashed) as THREE.Group;
    const line = grp.children.find((c) => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    expect(line!.material).toBeInstanceOf(THREE.LineDashedMaterial);
  });

  it('returns empty group for fewer than 2 points', () => {
    const short: ModelLine = { ...baseLine, pointsMm: [{ xMm: 0, yMm: 0 }] };
    const grp = modelLinePlanThree(short) as THREE.Group;
    expect(grp.children).toHaveLength(0);
  });
});
