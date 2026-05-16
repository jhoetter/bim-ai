import { describe, it, expect } from 'vitest';

import {
  applyCreateGroup,
  applyPlaceGroup,
  applyRenameGroup,
  applyUngroupElements,
  getInstancesForDefinition,
  validateCreateGroup,
} from './groupCommands';
import { emptyGroupRegistry } from './groupTypes';

// Counter-based ID generator for deterministic tests
function makeIdGen() {
  let n = 0;
  return () => `id-${n++}`;
}

describe('applyCreateGroup', () => {
  it('creates a definition and a first instance', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const cmd = {
      type: 'createGroup' as const,
      name: 'Staircase Group',
      elementIds: ['wall-1', 'wall-2', 'floor-1'],
      originXMm: 1000,
      originYMm: 2000,
    };

    const result = applyCreateGroup(registry, cmd, gen);

    expect(result.definitionId).toBe('id-0');
    expect(result.instanceId).toBe('id-1');
    expect(result.registry.definitions['id-0']).toBeDefined();
    expect(result.registry.instances['id-1']).toBeDefined();
  });

  it('definition has the correct elementIds and name', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const cmd = {
      type: 'createGroup' as const,
      name: 'Bay Window',
      elementIds: ['win-1', 'win-2'],
      originXMm: 500,
      originYMm: 500,
    };

    const { registry: newReg, definitionId } = applyCreateGroup(registry, cmd, gen);
    const def = newReg.definitions[definitionId];

    expect(def.name).toBe('Bay Window');
    expect(def.elementIds).toEqual(['win-1', 'win-2']);
    expect(def.originXMm).toBe(500);
    expect(def.originYMm).toBe(500);
  });

  it('first instance is placed at the group origin', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const cmd = {
      type: 'createGroup' as const,
      name: 'Entrance',
      elementIds: ['door-1', 'column-1'],
      originXMm: 3000,
      originYMm: 4000,
    };

    const { registry: newReg, definitionId, instanceId } = applyCreateGroup(registry, cmd, gen);
    const inst = newReg.instances[instanceId];

    expect(inst.insertionXMm).toBe(3000);
    expect(inst.insertionYMm).toBe(4000);
    expect(inst.rotationDeg).toBe(0);
    expect(inst.groupDefinitionId).toBe(definitionId);
  });

  it('does not mutate the original registry', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const original = { ...registry };
    applyCreateGroup(
      registry,
      {
        type: 'createGroup',
        name: 'Test',
        elementIds: ['a', 'b'],
        originXMm: 0,
        originYMm: 0,
      },
      gen,
    );
    expect(registry.definitions).toEqual(original.definitions);
    expect(registry.instances).toEqual(original.instances);
  });
});

describe('applyPlaceGroup', () => {
  it('adds a second instance; getInstancesForDefinition returns 2', () => {
    let n = 0;
    const gen = () => `id-${n++}`;

    const registry = emptyGroupRegistry();
    const createCmd = {
      type: 'createGroup' as const,
      name: 'Column Pair',
      elementIds: ['col-1', 'col-2'],
      originXMm: 0,
      originYMm: 0,
    };
    const { registry: reg1, definitionId } = applyCreateGroup(registry, createCmd, gen);

    const placeCmd = {
      type: 'placeGroup' as const,
      groupDefinitionId: definitionId,
      insertionXMm: 5000,
      insertionYMm: 0,
      rotationDeg: 0,
    };
    const { registry: reg2, instanceId } = applyPlaceGroup(reg1, placeCmd, gen);

    const instances = getInstancesForDefinition(reg2, definitionId);
    expect(instances).toHaveLength(2);
    expect(reg2.instances[instanceId].insertionXMm).toBe(5000);
  });

  it('stores the rotation correctly on the new instance', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const { registry: reg1, definitionId } = applyCreateGroup(
      registry,
      { type: 'createGroup', name: 'G', elementIds: ['a', 'b'], originXMm: 0, originYMm: 0 },
      gen,
    );

    const { registry: reg2, instanceId } = applyPlaceGroup(
      reg1,
      {
        type: 'placeGroup',
        groupDefinitionId: definitionId,
        insertionXMm: 0,
        insertionYMm: 0,
        rotationDeg: 90,
      },
      gen,
    );

    expect(reg2.instances[instanceId].rotationDeg).toBe(90);
  });
});

describe('applyUngroupElements', () => {
  it('removes the instance; definition stays', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const {
      registry: reg1,
      definitionId,
      instanceId,
    } = applyCreateGroup(
      registry,
      { type: 'createGroup', name: 'G', elementIds: ['a', 'b'], originXMm: 0, originYMm: 0 },
      gen,
    );

    const reg2 = applyUngroupElements(reg1, {
      type: 'ungroupElements',
      groupInstanceId: instanceId,
    });

    expect(reg2.instances[instanceId]).toBeUndefined();
    expect(reg2.definitions[definitionId]).toBeDefined();
  });

  it('leaves other instances untouched', () => {
    let n = 0;
    const gen = () => `id-${n++}`;

    const registry = emptyGroupRegistry();
    const {
      registry: reg1,
      definitionId,
      instanceId: inst1,
    } = applyCreateGroup(
      registry,
      { type: 'createGroup', name: 'G', elementIds: ['a', 'b'], originXMm: 0, originYMm: 0 },
      gen,
    );
    const { registry: reg2, instanceId: inst2 } = applyPlaceGroup(
      reg1,
      {
        type: 'placeGroup',
        groupDefinitionId: definitionId,
        insertionXMm: 1000,
        insertionYMm: 0,
        rotationDeg: 0,
      },
      gen,
    );

    const reg3 = applyUngroupElements(reg2, {
      type: 'ungroupElements',
      groupInstanceId: inst1,
    });

    expect(reg3.instances[inst1]).toBeUndefined();
    expect(reg3.instances[inst2]).toBeDefined();
  });
});

describe('applyRenameGroup', () => {
  it('updates the definition name', () => {
    const gen = makeIdGen();
    const registry = emptyGroupRegistry();
    const { registry: reg1, definitionId } = applyCreateGroup(
      registry,
      { type: 'createGroup', name: 'Old Name', elementIds: ['x', 'y'], originXMm: 0, originYMm: 0 },
      gen,
    );

    const reg2 = applyRenameGroup(reg1, {
      type: 'renameGroup',
      groupDefinitionId: definitionId,
      name: 'New Name',
    });

    expect(reg2.definitions[definitionId].name).toBe('New Name');
  });

  it('returns the registry unchanged if the definition does not exist', () => {
    const registry = emptyGroupRegistry();
    const result = applyRenameGroup(registry, {
      type: 'renameGroup',
      groupDefinitionId: 'nonexistent',
      name: 'Whatever',
    });
    expect(result).toEqual(registry);
  });
});

describe('validateCreateGroup', () => {
  it('rejects an empty name', () => {
    const result = validateCreateGroup('', ['a', 'b']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a whitespace-only name', () => {
    const result = validateCreateGroup('   ', ['a', 'b']);
    expect(result.valid).toBe(false);
  });

  it('rejects a single element', () => {
    const result = validateCreateGroup('Group', ['a']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects an empty element list', () => {
    const result = validateCreateGroup('Group', []);
    expect(result.valid).toBe(false);
  });

  it('accepts 2 elements and a valid name', () => {
    const result = validateCreateGroup('My Group', ['a', 'b']);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts 3+ elements', () => {
    const result = validateCreateGroup('Large Group', ['a', 'b', 'c', 'd']);
    expect(result.valid).toBe(true);
  });
});
