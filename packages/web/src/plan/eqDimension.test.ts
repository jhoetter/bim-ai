import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { permanentDimensionThree, applyToggleDimEq } from './planElementMeshBuilders';

type PermanentDim = Extract<Element, { kind: 'permanent_dimension' }>;

const baseDim: PermanentDim = {
  kind: 'permanent_dimension',
  id: 'dim-1',
  levelId: 'lvl-0',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 3000, yMm: 0 },
    { xMm: 6000, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: -500 },
};

describe('EQ dimension symbol — §4.2.2', () => {
  it('eqEnabled=true replaces segment labels with "EQ" text userData', () => {
    const dim: PermanentDim = { ...baseDim, eqEnabled: true };
    const grp = permanentDimensionThree(dim);
    const labelSprites = grp.children.filter(
      (c) => c instanceof THREE.Sprite && !(c.userData as { eqToggle?: boolean }).eqToggle,
    ) as THREE.Sprite[];
    expect(labelSprites.length).toBe(2);
    for (const s of labelSprites) {
      expect((s.userData as { labelText?: string }).labelText).toBe('EQ');
    }
  });

  it('eqEnabled=false renders numeric segment labels', () => {
    const dim: PermanentDim = { ...baseDim, eqEnabled: false };
    const grp = permanentDimensionThree(dim);
    const labelSprites = grp.children.filter(
      (c) => c instanceof THREE.Sprite && !(c.userData as { eqToggle?: boolean }).eqToggle,
    ) as THREE.Sprite[];
    expect(labelSprites.length).toBe(2);
    for (const s of labelSprites) {
      const text = (s.userData as { labelText?: string }).labelText ?? '';
      expect(text).toMatch(/mm$|m$/);
      expect(text).not.toBe('EQ');
    }
  });

  it('EQ toggle button is always rendered with correct userData', () => {
    const dimEq: PermanentDim = { ...baseDim, eqEnabled: true };
    const dimNoEq: PermanentDim = { ...baseDim, eqEnabled: false };

    for (const dim of [dimEq, dimNoEq]) {
      const grp = permanentDimensionThree(dim);
      const btn = grp.children.find(
        (c) => (c.userData as { eqToggle?: boolean }).eqToggle === true,
      );
      expect(btn).toBeTruthy();
      expect((btn!.userData as { bimPickId?: string }).bimPickId).toBe(dim.id);
    }
  });

  it('EQ toggle button is blue when active, grey when inactive', () => {
    const dimEq: PermanentDim = { ...baseDim, eqEnabled: true };
    const dimNoEq: PermanentDim = { ...baseDim, eqEnabled: false };

    const btnEq = permanentDimensionThree(dimEq).children.find(
      (c) => (c.userData as { eqToggle?: boolean }).eqToggle === true,
    ) as THREE.Mesh;
    const btnNoEq = permanentDimensionThree(dimNoEq).children.find(
      (c) => (c.userData as { eqToggle?: boolean }).eqToggle === true,
    ) as THREE.Mesh;

    expect((btnEq.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x2563eb);
    expect((btnNoEq.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x9ca3af);
  });

  it('toggle_dim_eq command flips eqEnabled flag', () => {
    const dim: PermanentDim = { ...baseDim, eqEnabled: false };
    const toggled = applyToggleDimEq(dim);
    expect(toggled.eqEnabled).toBe(true);
    const toggledBack = applyToggleDimEq(toggled);
    expect(toggledBack.eqEnabled).toBe(false);
  });
});
