/**
 * FAM-05 — array geometry node tests.
 *
 * Linear and radial modes; param-driven count; spacing modes.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildFamilyParamMap,
  resolveArrayNode,
  resolveFamilyGeometry,
  type FamilyCatalogLookup,
} from './familyResolver';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyInstanceRefNode,
  SketchLine,
  SweepGeometryNode,
} from './types';

function chairFamily(): FamilyDefinition {
  // A unit-cube chair so each placement carries one Mesh descendant.
  const profile: SketchLine[] = [
    { startMm: { xMm: -100, yMm: 100 }, endMm: { xMm: 100, yMm: 100 } },
    { startMm: { xMm: 100, yMm: 100 }, endMm: { xMm: 100, yMm: -100 } },
    { startMm: { xMm: 100, yMm: -100 }, endMm: { xMm: -100, yMm: -100 } },
    { startMm: { xMm: -100, yMm: -100 }, endMm: { xMm: -100, yMm: 100 } },
  ];
  const sweep: SweepGeometryNode = {
    kind: 'sweep',
    pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 200, yMm: 0 } }],
    profile,
    profilePlane: 'normal_to_path_start',
  };
  return {
    id: 'fam:chair',
    name: 'Chair',
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: [sweep],
  };
}

function chairTarget(positionMm = { xMm: 0, yMm: 0, zMm: 0 }): FamilyInstanceRefNode {
  return {
    kind: 'family_instance_ref',
    familyId: 'fam:chair',
    positionMm,
    rotationDeg: 0,
    parameterBindings: {},
  };
}

function chairCount(group: THREE.Group): number {
  let n = 0;
  group.traverse((c) => {
    if (c instanceof THREE.Group && c.userData.familyId === 'fam:chair') n++;
  });
  return n;
}

describe('FAM-05 linear array', () => {
  it('count = 6 produces 6 chair instances', () => {
    const node: ArrayGeometryNode = {
      kind: 'array',
      target: chairTarget(),
      mode: 'linear',
      countParam: 'chairCount',
      spacing: { kind: 'fixed_mm', mm: 400 },
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 4000, yMm: 0, zMm: 0 },
    };
    const catalog: FamilyCatalogLookup = { 'fam:chair': chairFamily() };
    const group = resolveArrayNode(node, { chairCount: 6 }, catalog);
    expect(chairCount(group)).toBe(6);
  });

  it('count = 8 with fit_total spacing distributes evenly along the segment', () => {
    const node: ArrayGeometryNode = {
      kind: 'array',
      target: chairTarget(),
      mode: 'linear',
      countParam: 'chairCount',
      spacing: { kind: 'fit_total', totalLengthParam: 'totalLen' },
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 2400, yMm: 0, zMm: 0 },
    };
    const catalog: FamilyCatalogLookup = { 'fam:chair': chairFamily() };
    const group = resolveArrayNode(node, { chairCount: 8, totalLen: 2400 }, catalog);
    expect(chairCount(group)).toBe(8);
    // First chair sits at x = 0, last at x = totalLen, equal gaps.
    const chairs: number[] = [];
    group.traverse((c) => {
      if (c instanceof THREE.Group && c.userData.familyId === 'fam:chair') {
        chairs.push(c.position.x);
      }
    });
    chairs.sort((a, b) => a - b);
    expect(chairs[0]).toBeCloseTo(0, 5);
    expect(chairs[chairs.length - 1]).toBeCloseTo(2400, 5);
  });

  it('count clamps to >= 1 and floors fractional values', () => {
    const node: ArrayGeometryNode = {
      kind: 'array',
      target: chairTarget(),
      mode: 'linear',
      countParam: 'n',
      spacing: { kind: 'fixed_mm', mm: 100 },
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
    };
    const catalog: FamilyCatalogLookup = { 'fam:chair': chairFamily() };
    expect(chairCount(resolveArrayNode(node, { n: 0 }, catalog))).toBe(1);
    expect(chairCount(resolveArrayNode(node, { n: -2 }, catalog))).toBe(1);
    expect(chairCount(resolveArrayNode(node, { n: 3.7 }, catalog))).toBe(3);
  });
});

describe('FAM-05 radial array', () => {
  it('count = 4 produces 90° spacing', () => {
    const node: ArrayGeometryNode = {
      kind: 'array',
      // Place the target offset so rotation is observable.
      target: chairTarget({ xMm: 1000, yMm: 0, zMm: 0 }),
      mode: 'radial',
      countParam: 'count',
      spacing: { kind: 'fixed_mm', mm: 0 },
      // Y axis through the origin → radial in the X/Z plane.
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 0, yMm: 1, zMm: 0 },
    };
    const catalog: FamilyCatalogLookup = { 'fam:chair': chairFamily() };
    const group = resolveArrayNode(node, { count: 4 }, catalog);
    expect(chairCount(group)).toBe(4);

    const positions: { x: number; z: number }[] = [];
    group.traverse((c) => {
      if (c instanceof THREE.Group && c.userData.familyId === 'fam:chair') {
        positions.push({ x: c.position.x, z: c.position.z });
      }
    });
    // Radius is the original X offset (1000mm).
    for (const p of positions) {
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeCloseTo(1000, 5);
    }
    // 4-way symmetry — angles cover {0°, 90°, 180°, 270°}.
    const anglesDeg = positions
      .map((p) => (Math.atan2(p.z, p.x) * 180) / Math.PI)
      .map((a) => (a + 360) % 360)
      .sort((a, b) => a - b);
    expect(anglesDeg).toEqual([0, 90, 180, 270].sort((a, b) => a - b));
  });
});

describe('FAM-05 array center copy', () => {
  it('emits a center copy when centerVisibilityBinding is true', () => {
    const node: ArrayGeometryNode = {
      kind: 'array',
      target: chairTarget(),
      mode: 'linear',
      countParam: 'n',
      spacing: { kind: 'fixed_mm', mm: 200 },
      axisStart: { xMm: 0, yMm: 0, zMm: 0 },
      axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
      centerVisibilityBinding: { paramName: 'headOfTable', whenTrue: true },
    };
    const catalog: FamilyCatalogLookup = { 'fam:chair': chairFamily() };
    const off = resolveArrayNode(node, { n: 4, headOfTable: false }, catalog);
    expect(chairCount(off)).toBe(4);
    const on = resolveArrayNode(node, { n: 4, headOfTable: true }, catalog);
    expect(chairCount(on)).toBe(5);
  });
});

describe('FAM-05 — array node embedded in a family + acceptance scenario', () => {
  it('changing Width = 2400 produces 8 chairs at correct spacing', () => {
    const tableFamily: FamilyDefinition = {
      id: 'fam:dining-table',
      name: 'DiningTable',
      discipline: 'door',
      params: [
        {
          key: 'Width',
          label: 'Width',
          type: 'length_mm',
          default: 1800,
          instanceOverridable: true,
        },
        {
          key: 'chairCount',
          label: 'Chair Count',
          type: 'length_mm',
          default: 6,
          instanceOverridable: true,
        },
      ],
      defaultTypes: [],
      geometry: [
        {
          kind: 'array',
          target: chairTarget(),
          mode: 'linear',
          countParam: 'chairCount',
          spacing: { kind: 'fit_total', totalLengthParam: 'Width' },
          axisStart: { xMm: 0, yMm: 0, zMm: 0 },
          axisEnd: { xMm: 0, yMm: 0, zMm: 0 }, // Width param drives spacing in fit_total mode.
        },
      ],
    };
    const catalog: FamilyCatalogLookup = {
      'fam:chair': chairFamily(),
      [tableFamily.id]: tableFamily,
    };
    const group = resolveFamilyGeometry(tableFamily.id, { Width: 2400, chairCount: 8 }, catalog);
    let chairs = 0;
    group.traverse((c) => {
      if (c instanceof THREE.Group && c.userData.familyId === 'fam:chair') chairs++;
    });
    expect(chairs).toBe(8);
  });
});

describe('F-089 — furniture Array_Length_Width parameter', () => {
  function parametricDiningTable(): FamilyDefinition {
    const chairArray = (yMm: number): ArrayGeometryNode => ({
      kind: 'array',
      target: chairTarget({ xMm: 0, yMm, zMm: 0 }),
      mode: 'linear',
      countParam: 'Array_Length_Width',
      spacing: { kind: 'fit_total', totalLengthParam: 'Width' },
      axisStart: { xMm: 0, yMm, zMm: 0 },
      axisEnd: { xMm: 0, yMm, zMm: 0 },
    });

    return {
      id: 'catalog:furniture:dining-table-array-length-width',
      name: 'Dining Table - Parametric Chair Arrays',
      discipline: 'generic',
      params: [
        {
          key: 'Width',
          label: 'Table Width',
          type: 'length_mm',
          default: 2400,
          instanceOverridable: true,
        },
        {
          key: 'ChairSlotPitch',
          label: 'Chair Slot Pitch',
          type: 'length_mm',
          default: 600,
          instanceOverridable: false,
        },
        {
          key: 'Array_Length_Width',
          label: 'Array Length Width',
          type: 'length_mm',
          default: 4,
          formula: 'max(1, rounddown(Width / ChairSlotPitch))',
          instanceOverridable: false,
        },
      ],
      defaultTypes: [],
      geometry: [chairArray(-450), chairArray(450)],
    };
  }

  it('derives the Array_Length_Width count from table Width before resolving chair arrays', () => {
    const tableFamily = parametricDiningTable();
    const catalog: FamilyCatalogLookup = {
      'fam:chair': chairFamily(),
      [tableFamily.id]: tableFamily,
    };

    expect(buildFamilyParamMap(tableFamily, { Width: 2400 }).Array_Length_Width).toBe(4);
    expect(buildFamilyParamMap(tableFamily, { Width: 3000 }).Array_Length_Width).toBe(5);

    const standard = resolveFamilyGeometry(tableFamily.id, { Width: 2400 }, catalog);
    expect(chairCount(standard)).toBe(8);

    const wide = resolveFamilyGeometry(tableFamily.id, { Width: 3000 }, catalog);
    expect(chairCount(wide)).toBe(10);
  });
});
