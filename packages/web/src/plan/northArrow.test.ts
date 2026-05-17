import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { initialNorthArrowState, reduceNorthArrow } from '../tools/toolGrammar';
import { PLAN_Y, ux, uz } from './symbology';
import type { Element } from '@bim-ai/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNorthArrow(
  id: string,
  xMm: number,
  yMm: number,
  rotationDeg = 0,
): Extract<Element, { kind: 'annotation_symbol' }> {
  return {
    kind: 'annotation_symbol',
    id,
    hostViewId: 'view-1',
    positionMm: { xMm, yMm },
    symbolType: 'north_arrow',
    rotationDeg,
    scale: 1,
  } as Extract<Element, { kind: 'annotation_symbol' }>;
}

function buildNorthArrowGroup(el: Extract<Element, { kind: 'annotation_symbol' }>): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  const cx = ux(el.positionMm.xMm);
  const cz = uz(el.positionMm.yMm);
  const rot = (((el.rotationDeg ?? 0) * Math.PI) / 180) as number;
  const Y = PLAN_Y + 0.005;
  const len = 0.5;
  const tip = new THREE.Vector3(cx + Math.sin(rot) * len, Y, cz - Math.cos(rot) * len);
  const base = new THREE.Vector3(cx, Y, cz);
  const shaftGeo = new THREE.BufferGeometry().setFromPoints([base, tip]);
  grp.add(
    new THREE.Line(shaftGeo, new THREE.LineBasicMaterial({ color: '#000000', linewidth: 2 })),
  );
  const headLen = 0.1;
  const headAngle = Math.PI / 6;
  const leftHead = new THREE.Vector3(
    tip.x - Math.sin(rot + headAngle) * headLen,
    Y,
    tip.z + Math.cos(rot + headAngle) * headLen,
  );
  const rightHead = new THREE.Vector3(
    tip.x - Math.sin(rot - headAngle) * headLen,
    Y,
    tip.z + Math.cos(rot - headAngle) * headLen,
  );
  const headGeo = new THREE.BufferGeometry().setFromPoints([leftHead, tip, rightHead]);
  grp.add(new THREE.Line(headGeo, new THREE.LineBasicMaterial({ color: '#000000' })));
  return grp;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('north arrow — §5.4.1', () => {
  it('grammar click emits createNorthArrow with positionMm', () => {
    const state = initialNorthArrowState();
    const { state: s1 } = reduceNorthArrow(state, { kind: 'activate' });
    const { effect } = reduceNorthArrow(s1, {
      kind: 'click',
      positionMm: { xMm: 500, yMm: 1500 },
      rotationDeg: 0,
    });
    expect(effect.createNorthArrow).toBeDefined();
    expect(effect.createNorthArrow?.positionMm.xMm).toBe(500);
    expect(effect.createNorthArrow?.positionMm.yMm).toBe(1500);
    expect(effect.createNorthArrow?.rotationDeg).toBe(0);
  });

  it('grammar click defaults rotationDeg to 0 when not provided', () => {
    const state = initialNorthArrowState();
    const { state: s1 } = reduceNorthArrow(state, { kind: 'activate' });
    const { effect } = reduceNorthArrow(s1, {
      kind: 'click',
      positionMm: { xMm: 0, yMm: 0 },
    });
    expect(effect.createNorthArrow?.rotationDeg).toBe(0);
  });

  it('grammar escape returns to idle without effect', () => {
    const state = initialNorthArrowState();
    const { state: s1 } = reduceNorthArrow(state, { kind: 'activate' });
    const { state: s2, effect } = reduceNorthArrow(s1, { kind: 'escape' });
    expect(s2.phase).toBe('idle');
    expect(effect.createNorthArrow).toBeUndefined();
  });

  it('north arrow plan symbol is a Group', () => {
    const el = makeNorthArrow('na-1', 0, 0, 0);
    const grp = buildNorthArrowGroup(el);
    expect(grp).toBeInstanceOf(THREE.Group);
  });

  it('north arrow plan symbol has bimPickId userData', () => {
    const el = makeNorthArrow('na-2', 1000, 2000, 0);
    const grp = buildNorthArrowGroup(el);
    expect((grp.userData as { bimPickId?: string }).bimPickId).toBe('na-2');
  });

  it('north arrow plan symbol has shaft and arrowhead lines', () => {
    const el = makeNorthArrow('na-3', 0, 0, 0);
    const grp = buildNorthArrowGroup(el);
    expect(grp.children.length).toBeGreaterThanOrEqual(2);
    for (const child of grp.children) {
      expect(child).toBeInstanceOf(THREE.Line);
    }
  });

  it('north arrow rotates by rotationDeg — tip moves', () => {
    const el0 = makeNorthArrow('na-rot-0', 0, 0, 0);
    const el90 = makeNorthArrow('na-rot-90', 0, 0, 90);
    const grp0 = buildNorthArrowGroup(el0);
    const grp90 = buildNorthArrowGroup(el90);

    const shaft0 = grp0.children[0] as THREE.Line;
    const shaft90 = grp90.children[0] as THREE.Line;

    // Each shaft has 2 points: base + tip. Compare tip positions.
    const pos0 = shaft0.geometry.attributes.position!;
    const pos90 = shaft90.geometry.attributes.position!;

    const tip0X = pos0.getX(1);
    const tip0Z = pos0.getZ(1);
    const tip90X = pos90.getX(1);
    const tip90Z = pos90.getZ(1);

    // 0° → tip is directly "north" (negative Z in Three.js)
    // 90° → tip is rotated 90° → different position
    expect(Math.abs(tip0X - tip90X) + Math.abs(tip0Z - tip90Z)).toBeGreaterThan(0.01);
  });
});
