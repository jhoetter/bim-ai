/**
 * VIE-02 — per-detail-level visibility for family geometry nodes.
 *
 * Covers:
 *   - sweep nodes hidden at coarse remain hidden at coarse but render at fine
 *   - nested-family-instance nodes hidden at coarse skip the entire subtree
 *   - omitting `detailLevel` leaves all nodes visible (regression guard)
 *   - detailLevel propagates through nested family instances
 *   - resolveNestedFamilyInstance honours detailLevel directly
 *   - array nodes (FAM-05) honour visibilityByDetailLevel and propagate
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  resolveFamilyGeometry,
  resolveNestedFamilyInstance,
  type FamilyCatalogLookup,
} from './familyResolver';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyInstanceRefNode,
  SketchLine,
  SweepGeometryNode,
} from './types';

function rectProfile(widthMm: number, heightMm: number): SketchLine[] {
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  return [
    { startMm: { xMm: -hw, yMm: hh }, endMm: { xMm: hw, yMm: hh } },
    { startMm: { xMm: hw, yMm: hh }, endMm: { xMm: hw, yMm: -hh } },
    { startMm: { xMm: hw, yMm: -hh }, endMm: { xMm: -hw, yMm: -hh } },
    { startMm: { xMm: -hw, yMm: -hh }, endMm: { xMm: -hw, yMm: hh } },
  ];
}

function straightPath(lengthMm: number): SketchLine[] {
  return [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: lengthMm, yMm: 0 } }];
}

function meshCount(group: THREE.Group): number {
  let count = 0;
  group.traverse((n) => {
    if (n instanceof THREE.Mesh) count += 1;
  });
  return count;
}

/** Door family with two sweeps: a 3D panel hidden at coarse and a swing arc
 *  visible at every level. Mirrors the VIE-02 acceptance scenario. */
function doorWithCoarseHiddenPanelFamily(): FamilyDefinition {
  const panel: SweepGeometryNode = {
    kind: 'sweep',
    pathLines: straightPath(800),
    profile: rectProfile(40, 2100),
    profilePlane: 'normal_to_path_start',
    visibilityByDetailLevel: { coarse: false, medium: true, fine: true },
  };
  const swingArc: SweepGeometryNode = {
    kind: 'sweep',
    pathLines: straightPath(800),
    profile: rectProfile(20, 20),
    profilePlane: 'normal_to_path_start',
  };
  return {
    id: 'door:vie02',
    name: 'Door (VIE-02)',
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: [panel, swingArc],
  };
}

describe('VIE-02 — sweep visibilityByDetailLevel', () => {
  it('coarse hides the 3D panel sweep but keeps the swing arc', () => {
    const fam = doorWithCoarseHiddenPanelFamily();
    const catalog: FamilyCatalogLookup = { [fam.id]: fam };
    const coarse = resolveFamilyGeometry(fam.id, {}, catalog, 'coarse');
    expect(meshCount(coarse)).toBe(1);
  });

  it('medium and fine show every sweep on the door', () => {
    const fam = doorWithCoarseHiddenPanelFamily();
    const catalog: FamilyCatalogLookup = { [fam.id]: fam };
    const medium = resolveFamilyGeometry(fam.id, {}, catalog, 'medium');
    const fine = resolveFamilyGeometry(fam.id, {}, catalog, 'fine');
    expect(meshCount(medium)).toBe(2);
    expect(meshCount(fine)).toBe(2);
  });

  it('omitting detailLevel leaves every sweep visible (back-compat)', () => {
    const fam = doorWithCoarseHiddenPanelFamily();
    const catalog: FamilyCatalogLookup = { [fam.id]: fam };
    const all = resolveFamilyGeometry(fam.id, {}, catalog);
    expect(meshCount(all)).toBe(2);
  });
});

describe('VIE-02 — family_instance_ref visibilityByDetailLevel', () => {
  it('a nested instance hidden at coarse skips its entire subtree', () => {
    const swingArc: FamilyDefinition = {
      id: 'swing-arc',
      name: 'Swing Arc',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'sweep',
          pathLines: straightPath(500),
          profile: rectProfile(20, 20),
          profilePlane: 'normal_to_path_start',
        },
      ],
    };
    const nested: FamilyInstanceRefNode = {
      kind: 'family_instance_ref',
      familyId: 'swing-arc',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      rotationDeg: 0,
      parameterBindings: {},
      visibilityByDetailLevel: { coarse: false, medium: true, fine: true },
    };
    const door: FamilyDefinition = {
      id: 'door-with-nested',
      name: 'Door',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [nested],
    };
    const catalog: FamilyCatalogLookup = {
      'swing-arc': swingArc,
      'door-with-nested': door,
    };
    const coarse = resolveFamilyGeometry('door-with-nested', {}, catalog, 'coarse');
    expect(meshCount(coarse)).toBe(0);
    const fine = resolveFamilyGeometry('door-with-nested', {}, catalog, 'fine');
    expect(meshCount(fine)).toBe(1);
  });

  it('detailLevel propagates into nested family instances', () => {
    // Outer "door" nests a swing-arc family; the swing-arc family's only
    // sweep is hidden at coarse via visibilityByDetailLevel. Calling the
    // outer family with `coarse` must drop the inner sweep.
    const innerSweep: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: straightPath(500),
      profile: rectProfile(20, 20),
      profilePlane: 'normal_to_path_start',
      visibilityByDetailLevel: { coarse: false },
    };
    const swingArc: FamilyDefinition = {
      id: 'swing-arc-coarse-hidden',
      name: 'Swing Arc',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [innerSweep],
    };
    const door: FamilyDefinition = {
      id: 'door-prop-detail',
      name: 'Door',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'swing-arc-coarse-hidden',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = {
      'swing-arc-coarse-hidden': swingArc,
      'door-prop-detail': door,
    };
    const coarse = resolveFamilyGeometry('door-prop-detail', {}, catalog, 'coarse');
    const fine = resolveFamilyGeometry('door-prop-detail', {}, catalog, 'fine');
    expect(meshCount(coarse)).toBe(0);
    expect(meshCount(fine)).toBe(1);
  });

  it('resolveNestedFamilyInstance honours detailLevel directly', () => {
    const inner: FamilyDefinition = {
      id: 'inner',
      name: 'inner',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'sweep',
          pathLines: straightPath(100),
          profile: rectProfile(10, 10),
          profilePlane: 'normal_to_path_start',
          visibilityByDetailLevel: { coarse: false },
        },
      ],
    };
    const ref: FamilyInstanceRefNode = {
      kind: 'family_instance_ref',
      familyId: 'inner',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      rotationDeg: 0,
      parameterBindings: {},
    };
    const catalog: FamilyCatalogLookup = { inner };
    const coarse = resolveNestedFamilyInstance(ref, {}, catalog, 0, 'coarse');
    const fine = resolveNestedFamilyInstance(ref, {}, catalog, 0, 'fine');
    expect(meshCount(coarse)).toBe(0);
    expect(meshCount(fine)).toBe(1);
  });
});

describe('VIE-02 — array node visibilityByDetailLevel', () => {
  it('an array node hidden at coarse drops every copy', () => {
    const leaf: FamilyDefinition = {
      id: 'leaf',
      name: 'leaf',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'sweep',
          pathLines: straightPath(100),
          profile: rectProfile(10, 10),
          profilePlane: 'normal_to_path_start',
        },
      ],
    };
    const arrayNode: ArrayGeometryNode = {
      kind: 'array',
      target: {
        kind: 'family_instance_ref',
        familyId: 'leaf',
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        rotationDeg: 0,
        parameterBindings: {},
      },
      mode: 'linear',
      countParam: 'n',
      spacing: { kind: 'fixed_mm', mm: 200 },
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
      visibilityByDetailLevel: { coarse: false, medium: true, fine: true },
    };
    const host: FamilyDefinition = {
      id: 'host',
      name: 'host',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [arrayNode],
    };
    const catalog: FamilyCatalogLookup = { leaf, host };
    const coarse = resolveFamilyGeometry('host', { n: 4 }, catalog, 'coarse');
    const fine = resolveFamilyGeometry('host', { n: 4 }, catalog, 'fine');
    expect(meshCount(coarse)).toBe(0);
    expect(meshCount(fine)).toBe(4);
  });
});
