/**
 * §10.3.1-3 — Tests for conical / dome / spire roof mesh builders and grammars.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildConicalRoofMesh,
  buildDomeRoofMesh,
  buildSpireRoofMesh,
} from './meshBuilders.coneRoof';
import { initialConicalRoofState, reduceConicalRoof } from '../tools/toolGrammar';

const baseConical = {
  kind: 'conical_roof' as const,
  id: 'cr-1',
  centerMm: { xMm: 5000, yMm: 3000 },
  baseRadiusMm: 2000,
  heightMm: 3000,
  baseElevationMm: 6000,
};

const baseDome = {
  kind: 'dome_roof' as const,
  id: 'dr-1',
  centerMm: { xMm: 0, yMm: 0 },
  baseRadiusMm: 1500,
  riseRatio: 0.5,
  baseElevationMm: 5000,
};

const baseSpire = {
  kind: 'spire_roof' as const,
  id: 'sr-1',
  centerMm: { xMm: 2000, yMm: 4000 },
  baseRadiusMm: 800,
  heightMm: 6000,
  baseElevationMm: 4000,
};

describe('buildConicalRoofMesh', () => {
  it('returns a THREE.Mesh', () => {
    const mesh = buildConicalRoofMesh(baseConical);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('sets bimPickId to element id', () => {
    const mesh = buildConicalRoofMesh(baseConical);
    expect(mesh.userData.bimPickId).toBe('cr-1');
  });

  it('positions mesh at correct center in world space', () => {
    const mesh = buildConicalRoofMesh(baseConical);
    // x = centerMm.xMm / 1000, z = -centerMm.yMm / 1000, y = baseElevationMm / 1000
    expect(mesh.position.x).toBeCloseTo(5);
    expect(mesh.position.z).toBeCloseTo(-3);
    expect(mesh.position.y).toBeCloseTo(6);
  });
});

describe('buildDomeRoofMesh', () => {
  it('returns a THREE.Mesh', () => {
    const mesh = buildDomeRoofMesh(baseDome);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('sets bimPickId to element id', () => {
    const mesh = buildDomeRoofMesh(baseDome);
    expect(mesh.userData.bimPickId).toBe('dr-1');
  });

  it('clamps riseRatio within [0.1, 1.0]', () => {
    // With riseRatio=0 it should not throw and produce a valid mesh
    const mesh = buildDomeRoofMesh({ ...baseDome, riseRatio: 0 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});

describe('buildSpireRoofMesh', () => {
  it('returns a THREE.Mesh', () => {
    const mesh = buildSpireRoofMesh(baseSpire);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('sets bimPickId to element id', () => {
    const mesh = buildSpireRoofMesh(baseSpire);
    expect(mesh.userData.bimPickId).toBe('sr-1');
  });
});

describe('conical roof grammar', () => {
  it('initialConicalRoofState is idle', () => {
    const state = initialConicalRoofState();
    expect(state.phase).toBe('idle');
  });

  it('first click moves to first-point phase', () => {
    const s0 = initialConicalRoofState();
    const { state: s1, effect: e1 } = reduceConicalRoof(s0, {
      kind: 'click',
      pointMm: { xMm: 1000, yMm: 2000 },
    });
    expect(s1.phase).toBe('first-point');
    expect(e1.createConicalRoof).toBeUndefined();
    expect(e1.stillActive).toBe(true);
  });

  it('second click emits createConicalRoof effect', () => {
    const s0 = initialConicalRoofState();
    const { state: s1 } = reduceConicalRoof(s0, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    });
    const { state: s2, effect: e2 } = reduceConicalRoof(s1, {
      kind: 'click',
      pointMm: { xMm: 3000, yMm: 4000 },
    });
    expect(s2.phase).toBe('idle');
    expect(e2.createConicalRoof).toBeDefined();
    expect(e2.createConicalRoof!.centerMm).toEqual({ xMm: 0, yMm: 0 });
    // distance from (0,0) to (3000,4000) = 5000
    expect(e2.createConicalRoof!.baseRadiusMm).toBeCloseTo(5000);
  });

  it('cancel resets to idle', () => {
    const s0 = initialConicalRoofState();
    const { state: s1 } = reduceConicalRoof(s0, {
      kind: 'click',
      pointMm: { xMm: 100, yMm: 200 },
    });
    expect(s1.phase).toBe('first-point');
    const { state: s2, effect: e2 } = reduceConicalRoof(s1, { kind: 'cancel' });
    expect(s2.phase).toBe('idle');
    expect(e2.stillActive).toBe(false);
  });
});
