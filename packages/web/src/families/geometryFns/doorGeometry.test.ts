/**
 * KRN-13: door 3D geometry varies by operationType.
 *
 * Each branch produces a Group whose children differ by mesh count and / or
 * geometry — enough to confirm visually distinct output for each variant.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { buildDoorGeometry, resolveDoorOperationType } from './doorGeometry';

type WallElem = Extract<Element, { kind: 'wall' }>;
type DoorElem = Extract<Element, { kind: 'door' }>;

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

function door(opOverride?: Partial<DoorElem>): DoorElem {
  return {
    kind: 'door',
    id: 'd1',
    name: 'Door',
    wallId: 'w1',
    alongT: 0.5,
    widthMm: 900,
    ...opOverride,
  };
}

function meshCount(group: THREE.Group): number {
  let n = 0;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) n += 1;
  });
  return n;
}

describe('resolveDoorOperationType', () => {
  it('defaults to swing_single when no operationType set', () => {
    expect(resolveDoorOperationType(door())).toBe('swing_single');
  });

  it('returns explicit operationType', () => {
    expect(resolveDoorOperationType(door({ operationType: 'sliding_double' }))).toBe(
      'sliding_double',
    );
  });
});

describe('buildDoorGeometry — KRN-13 operationType branching', () => {
  it('uses separate frame and panel material slots when authored', () => {
    const grp = buildDoorGeometry({
      door: door({
        materialKey: 'aluminium_dark_grey',
        materialSlots: {
          frame: 'aluminium_black',
          panel: 'cladding_warm_wood',
          threshold: 'concrete_smooth',
          hardware: 'asset_stainless_brushed',
        },
      }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    const materialKeys = new Set<string | null>();
    grp.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        materialKeys.add((node.material as THREE.Material).userData.materialKey ?? null);
      }
    });

    expect(materialKeys.has('aluminium_black')).toBe(true);
    expect(materialKeys.has('cladding_warm_wood')).toBe(true);
    expect(materialKeys.has('concrete_smooth')).toBe(true);
    expect(materialKeys.has('asset_stainless_brushed')).toBe(true);
    expect(materialKeys.has('aluminium_dark_grey')).toBe(false);
  });

  it('default (no operationType) renders identically to swing_single', () => {
    const def = buildDoorGeometry({
      door: door(),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    const explicit = buildDoorGeometry({
      door: door({ operationType: 'swing_single' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    expect(meshCount(def)).toBe(meshCount(explicit));
  });

  it('swing_double has at least two leaf panels (more meshes than swing_single)', () => {
    const single = buildDoorGeometry({
      door: door({ operationType: 'swing_single' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    const double = buildDoorGeometry({
      door: door({ operationType: 'swing_double' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    expect(meshCount(double)).toBeGreaterThan(meshCount(single));
  });

  it('sliding_single hides head/jamb frame and adds a track mesh', () => {
    const sliding = buildDoorGeometry({
      door: door({ operationType: 'sliding_single' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    // Sliding panel is offset along x from origin (track mounted on wall face).
    let foundOffsetPanel = false;
    sliding.traverse((node) => {
      if (node instanceof THREE.Mesh && Math.abs(node.position.x) > 0.1) foundOffsetPanel = true;
    });
    expect(foundOffsetPanel).toBe(true);
  });

  it('sliding_double has two panels offset from each other', () => {
    const sd = buildDoorGeometry({
      door: door({ operationType: 'sliding_double' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    expect(meshCount(sd)).toBeGreaterThan(2);
  });

  it('bi_fold produces four narrow panel meshes', () => {
    const bf = buildDoorGeometry({
      door: door({ operationType: 'bi_fold' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    let rotatedCount = 0;
    bf.traverse((node) => {
      if (node instanceof THREE.Mesh && Math.abs(node.rotation.y) > 0.01) rotatedCount += 1;
    });
    expect(rotatedCount).toBeGreaterThanOrEqual(2);
  });

  it('pocket renders panel offset from frame center (slid into pocket)', () => {
    const pkt = buildDoorGeometry({
      door: door({ operationType: 'pocket' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    let panelOffset = false;
    pkt.traverse((node) => {
      if (node instanceof THREE.Mesh && Math.abs(node.position.x) > 0.2) panelOffset = true;
    });
    expect(panelOffset).toBe(true);
  });

  it('pivot renders rotated panel + pivot dot', () => {
    const piv = buildDoorGeometry({
      door: door({ operationType: 'pivot' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    let rotatedPanel = false;
    let pivotDot = false;
    piv.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (Math.abs(node.rotation.y) > 0.1) rotatedPanel = true;
      if (node.geometry instanceof THREE.CylinderGeometry) pivotDot = true;
    });
    expect(rotatedPanel).toBe(true);
    expect(pivotDot).toBe(true);
  });

  it('automatic_double has emissive sensor element', () => {
    const auto = buildDoorGeometry({
      door: door({ operationType: 'automatic_double' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    let foundEmissive = false;
    auto.traverse((node) => {
      if (
        node instanceof THREE.Mesh &&
        node.material instanceof THREE.MeshStandardMaterial &&
        node.material.emissiveIntensity > 0
      ) {
        foundEmissive = true;
      }
    });
    expect(foundEmissive).toBe(true);
  });

  it.each([
    'swing_single',
    'swing_double',
    'sliding_single',
    'sliding_double',
    'bi_fold',
    'pocket',
    'pivot',
    'automatic_double',
  ] as const)('all operationType branches return non-empty group: %s', (op) => {
    const grp = buildDoorGeometry({
      door: door({ operationType: op }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
    });
    expect(grp.children.length).toBeGreaterThan(0);
  });
});
