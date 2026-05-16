import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { steelConnectionPlanThree } from './symbology';
import type { Element } from '@bim-ai/core';

type SteelConn = Extract<Element, { kind: 'steel_connection' }>;
type BeamElem = Extract<Element, { kind: 'beam' }>;

function makeBeam(): BeamElem {
  return {
    kind: 'beam',
    id: 'beam-1',
    name: 'B1',
    levelId: 'lvl-1',
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 5000, yMm: 0 },
    widthMm: 200,
    heightMm: 400,
  };
}

function makeConn(overrides: Partial<SteelConn> = {}): SteelConn {
  return {
    kind: 'steel_connection',
    id: 'conn-1',
    connectionType: 'end_plate',
    hostElementId: 'beam-1',
    positionT: 1.0,
    plateSizeMm: { width: 150, height: 200, thickness: 10 },
    boltRows: 2,
    boltCols: 2,
    boltDiameterMm: 20,
    ...overrides,
  };
}

describe('steelConnectionPlanThree', () => {
  it('returns object with userData.elementId === conn.id', () => {
    const beam = makeBeam();
    const conn = makeConn();
    const grp = steelConnectionPlanThree(conn, { [beam.id]: beam });
    expect((grp.userData as { elementId?: string }).elementId).toBe('conn-1');
  });

  it('plan symbol is positioned near the beam end when positionT=1', () => {
    const beam = makeBeam();
    const conn = makeConn({ positionT: 1.0 });
    const grp = steelConnectionPlanThree(conn, { [beam.id]: beam });
    const child = grp.children[0] as THREE.Object3D;
    expect(child).toBeDefined();
    expect(child.position.x).toBeCloseTo(5000 / 1000, 1);
  });

  it('plan symbol positioned at mid-beam when positionT=0.5', () => {
    const beam = makeBeam();
    const conn = makeConn({ positionT: 0.5 });
    const grp = steelConnectionPlanThree(conn, { [beam.id]: beam });
    const child = grp.children[0] as THREE.Object3D;
    expect(child).toBeDefined();
    expect(child.position.x).toBeCloseTo(2500 / 1000, 1);
  });
});
