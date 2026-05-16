import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { permanentDimensionThree } from './planElementMeshBuilders';

type PermanentDim = Extract<Element, { kind: 'permanent_dimension' }>;

const baseDim: PermanentDim = {
  kind: 'permanent_dimension',
  id: 'dim-style-1',
  levelId: 'lvl-0',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 2500, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: -500 },
};

function getLabelSprites(grp: THREE.Group): THREE.Sprite[] {
  return grp.children.filter(
    (c) => c instanceof THREE.Sprite && !(c.userData as { eqToggle?: boolean }).eqToggle,
  ) as THREE.Sprite[];
}

describe('permanentDimensionThree with dimStyle — §4.2.4', () => {
  it('uses default textHeightMm=2.5 when no style set', () => {
    const grp = permanentDimensionThree(baseDim);
    const sprites = getLabelSprites(grp);
    expect(sprites.length).toBeGreaterThan(0);
    for (const s of sprites) {
      expect((s.userData as { textHeightMm?: number }).textHeightMm).toBe(2.5);
    }
  });

  it('uses custom textHeightMm from dimStyle', () => {
    const grp = permanentDimensionThree(baseDim, { textHeightMm: 5 });
    const sprites = getLabelSprites(grp);
    expect(sprites.length).toBeGreaterThan(0);
    for (const s of sprites) {
      expect((s.userData as { textHeightMm?: number }).textHeightMm).toBe(5);
    }
  });

  it('showUnit=true appends " mm" to segment label', () => {
    const grp = permanentDimensionThree(baseDim, { showUnit: true });
    const sprites = getLabelSprites(grp);
    expect(sprites.length).toBeGreaterThan(0);
    for (const s of sprites) {
      const text = (s.userData as { labelText?: string }).labelText ?? '';
      expect(text).toMatch(/ mm$/);
    }
  });

  it('showUnit=false (default) omits unit suffix', () => {
    const grp = permanentDimensionThree(baseDim, { showUnit: false });
    const sprites = getLabelSprites(grp);
    expect(sprites.length).toBeGreaterThan(0);
    for (const s of sprites) {
      const text = (s.userData as { labelText?: string }).labelText ?? '';
      expect(text).not.toMatch(/[a-z]/);
    }
  });
});
