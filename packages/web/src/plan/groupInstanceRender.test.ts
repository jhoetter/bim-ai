import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import { buildGroupInstancePlanMesh } from './groupInstanceRender';
import type { GroupDefinition, GroupInstance } from '../groups/groupTypes';
import type { Element } from '@bim-ai/core';

const DEF: GroupDefinition = {
  id: 'def-1',
  name: 'Wall Cluster',
  elementIds: ['wall-1', 'wall-2'],
  originXMm: 0,
  originYMm: 0,
};

const WALL_1 = {
  kind: 'wall' as const,
  id: 'wall-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 3000, yMm: 0 },
  thicknessMm: 200,
  levelId: 'lvl-1',
  name: 'Wall 1',
};

const WALL_2 = {
  kind: 'wall' as const,
  id: 'wall-2',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 0, yMm: 4000 },
  thicknessMm: 200,
  levelId: 'lvl-1',
  name: 'Wall 2',
};

const ELEMENTS_BY_ID = {
  'wall-1': WALL_1 as unknown as Element,
  'wall-2': WALL_2 as unknown as Element,
};

const INSTANCE: GroupInstance = {
  id: 'inst-1',
  groupDefinitionId: 'def-1',
  insertionXMm: 1000,
  insertionYMm: 2000,
  rotationDeg: 0,
};

describe('buildGroupInstancePlanMesh', () => {
  it('returns a THREE.Object3D with the instance id as bimPickId', () => {
    const obj = buildGroupInstancePlanMesh(INSTANCE, DEF, ELEMENTS_BY_ID, undefined);
    expect(obj).toBeDefined();
    expect(obj.userData.bimPickId).toBe('inst-1');
  });

  it('contains a dashed line child', () => {
    const obj = buildGroupInstancePlanMesh(INSTANCE, DEF, ELEMENTS_BY_ID, undefined);
    const lines = obj.children.filter((c) => c instanceof THREE.Line);
    expect(lines.length).toBeGreaterThan(0);
    const line = lines[0] as THREE.Line;
    expect(line.material).toBeInstanceOf(THREE.LineDashedMaterial);
  });

  it('falls back to a 1000mm box at insertion point when no member elements resolve', () => {
    const obj = buildGroupInstancePlanMesh(INSTANCE, { ...DEF, elementIds: [] }, {}, undefined);
    expect(obj).toBeDefined();
    const lines = obj.children.filter((c) => c instanceof THREE.Line);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('applies selection color when instanceId matches selectedId', () => {
    const obj = buildGroupInstancePlanMesh(INSTANCE, DEF, ELEMENTS_BY_ID, 'inst-1');
    const line = obj.children.find((c) => c instanceof THREE.Line) as THREE.Line;
    const mat = line.material as THREE.LineDashedMaterial;
    // Selected uses GROUP_SELECTED_COLOR = 0xf59e0b
    expect(mat.color.getHex()).toBe(0xf59e0b);
  });
});
