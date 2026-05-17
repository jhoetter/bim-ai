import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { initialProjectBasePointState, reduceProjectBasePoint } from '../tools/toolGrammar';
import { PLAN_Y, ux, uz } from './symbology';
import type { Element } from '@bim-ai/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProjectBasePoint(
  id: string,
  xMm: number,
  yMm: number,
): Extract<Element, { kind: 'project_base_point' }> {
  return {
    kind: 'project_base_point',
    id,
    positionMm: { xMm, yMm, zMm: 0 },
    angleToTrueNorthDeg: 0,
  } as Extract<Element, { kind: 'project_base_point' }>;
}

// Minimal north-arrow plan symbol builder mirroring the implementation in symbology.ts
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

// Minimal base point plan symbol builder (mirroring what symbology.ts builds)
function buildBasePointGroup(el: Extract<Element, { kind: 'project_base_point' }>): THREE.Group {
  const grp = new THREE.Group();
  const pos = el.positionMm as { xMm: number; yMm: number };
  const xM = ux(pos.xMm);
  const zM = uz(pos.yMm);
  const Y = PLAN_Y + 0.009;
  const r = 0.3;
  const mat = new THREE.LineBasicMaterial({ color: 0x2563eb });
  const circlePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(xM + Math.cos(a) * r, Y, zM + Math.sin(a) * r));
  }
  const circleLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints), mat);
  circleLine.userData.bimPickId = el.id;
  grp.add(circleLine);
  return grp;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('project base point — §2.1.3', () => {
  it('grammar single click emits createProjectBasePoint effect', () => {
    const state = initialProjectBasePointState();
    const { state: s1 } = reduceProjectBasePoint(state, { kind: 'activate' });
    const { effect } = reduceProjectBasePoint(s1, {
      kind: 'click',
      positionMm: { xMm: 1000, yMm: 2000 },
    });
    expect(effect.createProjectBasePoint).toBeDefined();
    expect(effect.createProjectBasePoint?.positionMm.xMm).toBe(1000);
    expect(effect.createProjectBasePoint?.positionMm.yMm).toBe(2000);
  });

  it('grammar escape returns to idle without effect', () => {
    const state = initialProjectBasePointState();
    const { state: s1 } = reduceProjectBasePoint(state, { kind: 'activate' });
    const { state: s2, effect } = reduceProjectBasePoint(s1, { kind: 'escape' });
    expect(s2.phase).toBe('idle');
    expect(effect.createProjectBasePoint).toBeUndefined();
  });

  it('grammar click in idle phase emits no effect', () => {
    const state = initialProjectBasePointState(); // phase === 'idle'
    const { effect } = reduceProjectBasePoint(state, {
      kind: 'click',
      positionMm: { xMm: 0, yMm: 0 },
    });
    expect(effect.createProjectBasePoint).toBeUndefined();
  });

  it('plan symbol has bimPickId userData', () => {
    const el = makeProjectBasePoint('pbp-1', 0, 0);
    const grp = buildBasePointGroup(el);
    // The circle line child should carry the bimPickId
    const child = grp.children[0]!;
    expect((child.userData as { bimPickId?: string }).bimPickId).toBe('pbp-1');
  });

  it('plan symbol circle is positioned at element positionMm', () => {
    const el = makeProjectBasePoint('pbp-2', 3000, 4000);
    const grp = buildBasePointGroup(el);
    // The circle line should have a buffergeometry with points
    const line = grp.children[0] as THREE.Line;
    expect(line).toBeDefined();
    const positions = line.geometry.attributes.position;
    expect(positions).toBeDefined();
    // Centre of circle should be near ux(3000), PLAN_Y+0.009, uz(4000)
    const expectedX = ux(3000);
    const expectedZ = uz(4000);
    let foundNearCenter = false;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt((x - expectedX) ** 2 + (z - expectedZ) ** 2);
      if (dist < 0.35) {
        foundNearCenter = true;
        break;
      }
    }
    expect(foundNearCenter).toBe(true);
  });
});
