import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { spotElevationThree } from './meshBuilders';

type SpotEl = Extract<Element, { kind: 'spot_elevation' }>;

const baseEl: SpotEl = {
  kind: 'spot_elevation',
  id: 'se-1',
  hostViewId: 'view-1',
  positionMm: { xMm: 2000, yMm: 3000 },
  elevationMm: 4500,
};

describe('spotElevationThree — §4.7', () => {
  it('returns a THREE.Group', () => {
    const result = spotElevationThree(baseEl, 0);
    expect(result).toBeInstanceOf(THREE.Group);
  });

  it('positions the group at (positionMm.xMm/1000, elevationMm/1000, -positionMm.yMm/1000)', () => {
    const result = spotElevationThree(baseEl, 0);
    expect(result.position.x).toBeCloseTo(2);
    expect(result.position.y).toBeCloseTo(4.5);
    expect(result.position.z).toBeCloseTo(-3);
  });

  it('includes a sprite child with elevation text as userData', () => {
    const result = spotElevationThree(baseEl, 0);
    const sprite = result.children.find(
      (c): c is THREE.Sprite => c instanceof THREE.Sprite && c.userData.spotElevationLabel === true,
    );
    expect(sprite).toBeTruthy();
    expect(sprite!.userData.spotElevationText).toContain('4.500 m');
  });

  it('uses textOverride when set instead of computed elevation', () => {
    const el: SpotEl = { ...baseEl, textOverride: 'DATUM' };
    const result = spotElevationThree(el, 0);
    const sprite = result.children.find(
      (c): c is THREE.Sprite => c instanceof THREE.Sprite && c.userData.spotElevationLabel === true,
    );
    expect(sprite!.userData.spotElevationText).toBe('DATUM');
  });

  it('formats elevation as metres with 3 decimal places', () => {
    const el: SpotEl = { ...baseEl, elevationMm: 1234 };
    const result = spotElevationThree(el, 0);
    const sprite = result.children.find(
      (c): c is THREE.Sprite => c instanceof THREE.Sprite && c.userData.spotElevationLabel === true,
    );
    expect(sprite!.userData.spotElevationText).toContain('1.234 m');
  });

  it('applies prefix and suffix around elevation value', () => {
    const el: SpotEl = { ...baseEl, prefix: 'EL:', suffix: ' AHD', elevationMm: 5000 };
    const result = spotElevationThree(el, 0);
    const sprite = result.children.find(
      (c): c is THREE.Sprite => c instanceof THREE.Sprite && c.userData.spotElevationLabel === true,
    );
    expect(sprite!.userData.spotElevationText).toBe('EL:5.000 m AHD');
  });

  it('uses relative elevation when elevationMode is relative-to-level', () => {
    const el: SpotEl = { ...baseEl, elevationMm: 4500, elevationMode: 'relative-to-level' };
    const result = spotElevationThree(el, 1500);
    const sprite = result.children.find(
      (c): c is THREE.Sprite => c instanceof THREE.Sprite && c.userData.spotElevationLabel === true,
    );
    // (4500 - 1500) / 1000 = 3.000
    expect(sprite!.userData.spotElevationText).toContain('3.000 m');
  });

  it('includes a diamond Mesh child', () => {
    const result = spotElevationThree(baseEl, 0);
    const diamond = result.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(diamond).toBeTruthy();
  });
});
