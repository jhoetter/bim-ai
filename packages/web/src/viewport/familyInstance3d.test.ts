import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { FAMILY_EDITOR_DEFINITION_PARAM } from '../familyEditor/familyEditorPersistence';
import type { FamilyDefinition, SketchLine } from '../families/types';
import { makeFamilyInstanceMesh } from './familyInstance3d';

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

function simpleFamilyDefinition(): FamilyDefinition {
  return {
    id: 'test:hosted-door-family',
    name: 'Hosted door family',
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: [
      {
        kind: 'sweep',
        pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 100, yMm: 0 } }],
        profile: rectProfile(40, 100),
        profilePlane: 'normal_to_path_start',
      },
    ],
  };
}

function glassFamilyDefinition(): FamilyDefinition {
  const def = simpleFamilyDefinition();
  return {
    ...def,
    id: 'test:hosted-glass-window-family',
    geometry: def.geometry?.map((node) =>
      node.kind === 'sweep' ? { ...node, materialKey: 'glass_clear' } : node,
    ),
  };
}

function baseElements(): Record<string, Element> {
  const def = simpleFamilyDefinition();
  return {
    lvl: { kind: 'level', id: 'lvl', name: 'Level', elevationMm: 0 },
    ft: {
      kind: 'family_type',
      id: 'ft',
      name: 'Hosted Door Type',
      familyId: def.id,
      discipline: 'door',
      parameters: { [FAMILY_EDITOR_DEFINITION_PARAM]: def },
    },
  };
}

describe('makeFamilyInstanceMesh', () => {
  it('aligns hosted family instances to the rendered host wall offset and base elevation', () => {
    const elementsById: Record<string, Element> = {
      ...baseElements(),
      wall: {
        kind: 'wall',
        id: 'wall',
        name: 'Offset wall',
        levelId: 'lvl',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
        thicknessMm: 300,
        heightMm: 2800,
        locationLine: 'finish-face-exterior',
        baseConstraintOffsetMm: 500,
      },
      fi: {
        kind: 'family_instance',
        id: 'fi',
        name: 'Hosted door',
        familyTypeId: 'ft',
        levelId: 'lvl',
        positionMm: { xMm: 0, yMm: 0 },
        hostElementId: 'wall',
        hostAlongT: 0.5,
      },
    };

    const mesh = makeFamilyInstanceMesh(
      elementsById.fi as Extract<Element, { kind: 'family_instance' }>,
      elementsById,
    );

    expect(mesh).not.toBeNull();
    expect(mesh!.position.x).toBeCloseTo(0.5, 5);
    expect(mesh!.position.y).toBeCloseTo(0.5, 5);
    expect(mesh!.position.z).toBeCloseTo(0.15, 5);
    expect(mesh!.rotation.y).toBeCloseTo(0, 5);
  });

  it('applies glass material semantics from authored family sweep material keys', () => {
    const def = glassFamilyDefinition();
    const elementsById: Record<string, Element> = {
      lvl: { kind: 'level', id: 'lvl', name: 'Level', elevationMm: 0 },
      ft: {
        kind: 'family_type',
        id: 'ft',
        name: 'Hosted Glass Window Type',
        familyId: def.id,
        discipline: 'window',
        parameters: { [FAMILY_EDITOR_DEFINITION_PARAM]: def },
      },
      fi: {
        kind: 'family_instance',
        id: 'fi',
        name: 'Hosted glass',
        familyTypeId: 'ft',
        levelId: 'lvl',
        positionMm: { xMm: 0, yMm: 0 },
      },
    };

    const mesh = makeFamilyInstanceMesh(
      elementsById.fi as Extract<Element, { kind: 'family_instance' }>,
      elementsById,
    );
    let glass: THREE.MeshPhysicalMaterial | null = null;
    mesh?.traverse((node) => {
      if (glass || !(node instanceof THREE.Mesh)) return;
      if (node.material instanceof THREE.MeshPhysicalMaterial) glass = node.material;
    });

    expect(glass).not.toBeNull();
    expect(glass!.transparent).toBe(true);
    expect(glass!.depthWrite).toBe(false);
    expect(glass!.transmission).toBeGreaterThanOrEqual(0.85);
  });
});
