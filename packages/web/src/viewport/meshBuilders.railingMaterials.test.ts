import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRailingMesh } from './meshBuilders';

type RailingElem = Extract<Element, { kind: 'railing' }>;

describe('makeRailingMesh — material slots', () => {
  it('applies post, rail, and baluster material slots independently', () => {
    const railing: RailingElem = {
      kind: 'railing',
      id: 'rail-slots',
      name: 'Slot rail',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
      ],
      materialSlots: {
        post: 'aluminium_dark_grey',
        topRail: 'aluminium_black',
        baluster: 'asset_stainless_brushed',
      },
    };

    const group = makeRailingMesh(railing, {}, null);
    const post = group.children.find((child) => child.userData.materialSlot === 'post') as
      | THREE.Mesh
      | undefined;
    const rail = group.children.find((child) => child.userData.materialSlot === 'topRail') as
      | THREE.Mesh
      | undefined;
    const baluster = group.children.find(
      (child) => child.userData.materialSlot === 'baluster',
    ) as THREE.Mesh | undefined;

    expect((post?.material as THREE.Material).userData.materialKey).toBe('aluminium_dark_grey');
    expect((rail?.material as THREE.Material).userData.materialKey).toBe('aluminium_black');
    expect((baluster?.material as THREE.Material).userData.materialKey).toBe('asset_stainless_brushed');
  });

  it('uses the panel material slot for glass-panel railings', () => {
    const railing: RailingElem = {
      kind: 'railing',
      id: 'rail-glass',
      name: 'Glass guard',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
      ],
      balusterPattern: { rule: 'glass_panel' },
      materialSlots: {
        panel: 'asset_clear_glass_double',
      },
    };

    const group = makeRailingMesh(railing, {}, null);
    const panel = group.children.find((child) => child.userData.materialSlot === 'panel') as
      | THREE.Mesh
      | undefined;

    expect((panel?.material as THREE.Material).userData.materialKey).toBe(
      'asset_clear_glass_double',
    );
    expect((panel?.material as THREE.Material).transparent).toBe(true);
  });

  it('uses the cable material slot for cable railings', () => {
    const railing: RailingElem = {
      kind: 'railing',
      id: 'rail-cable',
      name: 'Cable guard',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
      ],
      balusterPattern: { rule: 'cable' },
      materialSlots: {
        cable: 'asset_stainless_brushed',
      },
    };

    const group = makeRailingMesh(railing, {}, null);
    const cable = group.children.find((child) => child.userData.materialSlot === 'cable') as
      | THREE.Mesh
      | undefined;

    expect((cable?.material as THREE.Material).userData.materialKey).toBe('asset_stainless_brushed');
  });
});
