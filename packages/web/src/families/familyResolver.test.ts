/**
 * FAM-01 — nested family resolver tests.
 *
 * Exercises:
 *   - 2-level nested family expansion with formula bindings
 *   - host_param + literal binding resolution
 *   - cycle detection (BFS) at save time
 *   - depth-limit guard at resolution time
 *   - visibility binding short-circuit
 *   - parameter defaults flow through to nested families
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  detectFamilyCycle,
  MAX_NESTED_FAMILY_DEPTH,
  resolveFamilyGeometry,
  resolveNestedFamilyInstance,
  resolveParameterBinding,
  type FamilyCatalogLookup,
} from './familyResolver';
import type {
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

/** Swing-arc family — geometry: a single sweep with a tiny rectangular
 *  cross-section along a path whose length is the swing radius. */
function swingArcFamily(): FamilyDefinition {
  const sweep: SweepGeometryNode = {
    kind: 'sweep',
    pathLines: straightPath(500),
    profile: rectProfile(20, 20),
    profilePlane: 'normal_to_path_start',
  };
  return {
    id: 'builtin:family:swing-arc',
    name: 'Swing Arc',
    discipline: 'door' as FamilyDefinition['discipline'],
    params: [
      {
        key: 'radiusMm',
        label: 'Radius',
        type: 'length_mm',
        default: 500,
        instanceOverridable: true,
      },
    ],
    defaultTypes: [],
    geometry: [sweep],
  };
}

/** A door family that nests a swing-arc and binds the arc's radius
 *  via the formula `roughWidthMm - 2 * frameSectMm`. */
function doorWithSwingFamily(): FamilyDefinition {
  const archRef: FamilyInstanceRefNode = {
    kind: 'family_instance_ref',
    familyId: 'builtin:family:swing-arc',
    positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    rotationDeg: 0,
    parameterBindings: {
      radiusMm: { kind: 'formula', expression: 'roughWidthMm - 2 * frameSectMm' },
    },
  };
  return {
    id: 'builtin:family:door-with-swing',
    name: 'DoorWithSwing',
    discipline: 'door',
    params: [
      {
        key: 'roughWidthMm',
        label: 'Rough Width',
        type: 'length_mm',
        default: 900,
        instanceOverridable: true,
      },
      {
        key: 'frameSectMm',
        label: 'Frame Width',
        type: 'length_mm',
        default: 50,
        instanceOverridable: false,
      },
    ],
    defaultTypes: [],
    geometry: [archRef],
  };
}

function meshGeometryBboxes(group: THREE.Group): THREE.Box3[] {
  const out: THREE.Box3[] = [];
  group.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.geometry.computeBoundingBox();
      if (n.geometry.boundingBox) out.push(n.geometry.boundingBox.clone());
    }
  });
  return out;
}

describe('resolveParameterBinding', () => {
  it('literal returns its value', () => {
    expect(resolveParameterBinding({ kind: 'literal', value: 42 }, {})).toBe(42);
    expect(resolveParameterBinding({ kind: 'literal', value: 'hello' }, {})).toBe('hello');
    expect(resolveParameterBinding({ kind: 'literal', value: true }, {})).toBe(true);
  });

  it('host_param looks up the named host param', () => {
    expect(
      resolveParameterBinding({ kind: 'host_param', paramName: 'widthMm' }, { widthMm: 1200 }),
    ).toBe(1200);
  });

  it('host_param throws when the param is missing', () => {
    expect(() =>
      resolveParameterBinding({ kind: 'host_param', paramName: 'missing' }, {}),
    ).toThrow();
  });

  it('formula evaluates against host params via FAM-04', () => {
    const v = resolveParameterBinding(
      { kind: 'formula', expression: 'roughWidthMm - 2 * frameSectMm' },
      { roughWidthMm: 900, frameSectMm: 50 },
    );
    expect(v).toBe(800);
  });

  it('formula with conditional (if) works via FAM-04 grammar', () => {
    const v = resolveParameterBinding(
      { kind: 'formula', expression: 'if(w > 1000, w / 2, w)' },
      { w: 1200 },
    );
    expect(v).toBe(600);
  });
});

describe('resolveNestedFamilyInstance — 2-level expansion', () => {
  it('door-with-swing expands the nested swing-arc into the host group', () => {
    const catalog: FamilyCatalogLookup = {
      'builtin:family:swing-arc': swingArcFamily(),
      'builtin:family:door-with-swing': doorWithSwingFamily(),
    };
    const group = resolveFamilyGeometry(
      'builtin:family:door-with-swing',
      { roughWidthMm: 900, frameSectMm: 50 },
      catalog,
    );
    // The door's geometry is a single nested-instance node; the
    // resolver should produce a group with at least one Mesh
    // descendant (the swept arc geometry).
    const bboxes = meshGeometryBboxes(group);
    expect(bboxes.length).toBeGreaterThanOrEqual(1);
    // Walk the children: the host group should contain a sub-group
    // whose userData carries the nested familyId — proving the
    // family_instance_ref expansion happened.
    let foundNested = false;
    group.traverse((n) => {
      if (n instanceof THREE.Group && n.userData.familyId === 'builtin:family:swing-arc') {
        foundNested = true;
      }
    });
    expect(foundNested).toBe(true);
  });

  it('formula bindings produce the expected effective param values', () => {
    // Direct check at the binding layer that the formula
    // `roughWidthMm - 2 * frameSectMm` resolves with host params
    // 900 + 50 → 800, and with 1500 + 50 → 1400.
    const formula = { kind: 'formula' as const, expression: 'roughWidthMm - 2 * frameSectMm' };
    expect(resolveParameterBinding(formula, { roughWidthMm: 900, frameSectMm: 50 })).toBe(800);
    expect(resolveParameterBinding(formula, { roughWidthMm: 1500, frameSectMm: 50 })).toBe(1400);
  });

  it('uses family-default param value when binding is absent', () => {
    // A door family with no bindings — the swing-arc should fall
    // back to its declared default radius (500mm).
    const noBindingDoor: FamilyDefinition = {
      ...doorWithSwingFamily(),
      id: 'door-no-binding',
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'builtin:family:swing-arc',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = {
      'builtin:family:swing-arc': swingArcFamily(),
      'door-no-binding': noBindingDoor,
    };
    const group = resolveFamilyGeometry('door-no-binding', {}, catalog);
    const bboxes = meshGeometryBboxes(group);
    expect(bboxes.length).toBeGreaterThanOrEqual(1);
    // Swing arc default radius is 500mm; sweep path is the literal
    // 500 in the family's `straightPath` — independent of param
    // for now, but the resolver did not throw on missing host
    // param, which is the property under test.
    const span = bboxes[0].max.x - bboxes[0].min.x;
    expect(span).toBeCloseTo(500, 0);
  });

  it('positionMm + rotationDeg apply to the resolved group', () => {
    const ref: FamilyInstanceRefNode = {
      kind: 'family_instance_ref',
      familyId: 'builtin:family:swing-arc',
      positionMm: { xMm: 1234, yMm: 567, zMm: 89 },
      rotationDeg: 45,
      parameterBindings: {},
    };
    const catalog: FamilyCatalogLookup = {
      'builtin:family:swing-arc': swingArcFamily(),
    };
    const group = resolveNestedFamilyInstance(ref, {}, catalog);
    expect(group.position.x).toBeCloseTo(1234, 5);
    expect(group.position.y).toBeCloseTo(567, 5);
    expect(group.position.z).toBeCloseTo(89, 5);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 4, 5);
  });
});

describe('FAM-082/FAM-083 — parameter-driven furniture extrusions', () => {
  it('uses a length parameter to drive straight sweep extrusion height', () => {
    const seat: SweepGeometryNode = {
      kind: 'sweep',
      pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 0, yMm: 100 } }],
      profile: rectProfile(600, 600),
      profilePlane: 'work_plane',
      pathLengthParam: 'Seat_Height',
    };
    const family: FamilyDefinition = {
      id: 'parametric-chair',
      name: 'Parametric Chair',
      discipline: 'generic',
      params: [
        {
          key: 'Seat_Height',
          label: 'Seat Height',
          type: 'length_mm',
          default: 450,
          instanceOverridable: true,
        },
      ],
      defaultTypes: [],
      geometry: [seat],
    };
    const group = resolveFamilyGeometry(family.id, { Seat_Height: 720 }, { [family.id]: family });
    const bboxes = meshGeometryBboxes(group);

    expect(bboxes).toHaveLength(1);
    expect(bboxes[0]!.max.z - bboxes[0]!.min.z).toBeCloseTo(720, 0);
  });
});

describe('FAM-01 cycle detection', () => {
  it('detects a 2-cycle (A → B → A)', () => {
    const a: FamilyDefinition = {
      id: 'A',
      name: 'A',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'B',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const b: FamilyDefinition = {
      id: 'B',
      name: 'B',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'A',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = { A: a, B: b };
    const cycle = detectFamilyCycle('A', catalog);
    expect(cycle).not.toBeNull();
    expect(cycle![0]).toBe('A');
    expect(cycle![cycle!.length - 1]).toBe('A');
  });

  it('detects a self-loop (A → A)', () => {
    const a: FamilyDefinition = {
      id: 'A',
      name: 'A',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'A',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = { A: a };
    expect(detectFamilyCycle('A', catalog)).toEqual(['A', 'A']);
  });

  it('returns null on a DAG (A → B, A → C, B → C)', () => {
    const c: FamilyDefinition = {
      id: 'C',
      name: 'C',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [],
    };
    const b: FamilyDefinition = {
      id: 'B',
      name: 'B',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'C',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const a: FamilyDefinition = {
      id: 'A',
      name: 'A',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'B',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
        {
          kind: 'family_instance_ref',
          familyId: 'C',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = { A: a, B: b, C: c };
    expect(detectFamilyCycle('A', catalog)).toBeNull();
  });

  it('resolveFamilyGeometry throws on a cyclic catalog', () => {
    const a: FamilyDefinition = {
      id: 'A',
      name: 'A',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'B',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const b: FamilyDefinition = {
      id: 'B',
      name: 'B',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: 'A',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const catalog: FamilyCatalogLookup = { A: a, B: b };
    expect(() => resolveFamilyGeometry('A', {}, catalog)).toThrow(/cycle/i);
  });

  it('detectFamilyCycle throws when graph depth exceeds the limit', () => {
    // Build a chain A0 → A1 → A2 → … → A12 (length 13 > 10).
    const catalog: FamilyCatalogLookup = {};
    for (let i = 0; i <= 12; i++) {
      const id = `A${i}`;
      const geom =
        i < 12
          ? [
              {
                kind: 'family_instance_ref' as const,
                familyId: `A${i + 1}`,
                positionMm: { xMm: 0, yMm: 0, zMm: 0 },
                rotationDeg: 0,
                parameterBindings: {},
              },
            ]
          : [];
      catalog[id] = {
        id,
        name: id,
        discipline: 'door',
        params: [],
        defaultTypes: [],
        geometry: geom,
      };
    }
    expect(() => detectFamilyCycle('A0', catalog)).toThrow(
      new RegExp(`exceeds ${MAX_NESTED_FAMILY_DEPTH}`),
    );
  });
});

describe('FAM-01 visibility binding', () => {
  it('hides the subtree when host param does not match whenTrue', () => {
    const swing = swingArcFamily();
    const door: FamilyDefinition = {
      id: 'door-with-vis',
      name: 'D',
      discipline: 'door',
      params: [
        {
          key: 'showSwing',
          label: 'Show Swing',
          type: 'boolean',
          default: false,
          instanceOverridable: true,
        },
      ],
      defaultTypes: [],
      geometry: [
        {
          kind: 'family_instance_ref',
          familyId: swing.id,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
          visibilityBinding: { paramName: 'showSwing', whenTrue: true },
        },
      ],
    };
    const catalog: FamilyCatalogLookup = { [swing.id]: swing, [door.id]: door };
    const hidden = resolveFamilyGeometry(door.id, { showSwing: false }, catalog);
    expect(meshGeometryBboxes(hidden).length).toBe(0);
    const shown = resolveFamilyGeometry(door.id, { showSwing: true }, catalog);
    expect(meshGeometryBboxes(shown).length).toBeGreaterThanOrEqual(1);
  });
});
