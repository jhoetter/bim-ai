import { beforeEach, describe, expect, it } from 'vitest';

import { useBimStore } from '../state/store';
import { applyCreateGroup } from './groupCommands';

beforeEach(() => {
  useBimStore.setState({
    groupRegistry: { definitions: {}, instances: {} },
    groupEditModeDefinitionId: null,
    selectedId: undefined,
    selectedIds: [],
  });
});

describe('group edit mode — §8.9.3', () => {
  it('setGroupEditModeDefinitionId sets groupEditModeDefinitionId in store', () => {
    useBimStore.getState().setGroupEditModeDefinitionId('def-1');
    expect(useBimStore.getState().groupEditModeDefinitionId).toBe('def-1');
  });

  it('finishEditGroup clears groupEditModeDefinitionId', () => {
    useBimStore.getState().setGroupEditModeDefinitionId('def-1');
    expect(useBimStore.getState().groupEditModeDefinitionId).toBe('def-1');

    useBimStore.getState().setGroupEditModeDefinitionId(null);
    expect(useBimStore.getState().groupEditModeDefinitionId).toBeNull();
  });

  it('editGroup with unknown id does not crash', () => {
    expect(() => {
      useBimStore.getState().setGroupEditModeDefinitionId('nonexistent-def');
    }).not.toThrow();
    expect(useBimStore.getState().groupEditModeDefinitionId).toBe('nonexistent-def');
  });

  it('group definition elementIds are accessible for filtering', () => {
    const { registry } = applyCreateGroup(
      { definitions: {}, instances: {} },
      {
        type: 'createGroup',
        name: 'Test Group',
        elementIds: ['wall-1', 'wall-2'],
        originXMm: 0,
        originYMm: 0,
      },
      () => 'test-def-id',
    );
    useBimStore.getState().setGroupRegistry(registry);
    useBimStore.getState().setGroupEditModeDefinitionId('test-def-id');

    const def = useBimStore.getState().groupRegistry.definitions['test-def-id'];
    expect(def).toBeDefined();
    expect(def?.elementIds).toContain('wall-1');
    expect(def?.elementIds).toContain('wall-2');
  });

  it('select is restricted to group members in edit mode', () => {
    let idCounter = 0;
    const { registry, definitionId } = applyCreateGroup(
      { definitions: {}, instances: {} },
      {
        type: 'createGroup',
        name: 'Restricted Group',
        elementIds: ['wall-a', 'wall-b'],
        originXMm: 0,
        originYMm: 0,
      },
      () => `id-${++idCounter}`,
    );
    useBimStore.getState().setGroupRegistry(registry);
    useBimStore.getState().setGroupEditModeDefinitionId(definitionId);

    // Selecting a member should work
    useBimStore.getState().select('wall-a');
    expect(useBimStore.getState().selectedId).toBe('wall-a');

    // Selecting a non-member should be blocked
    useBimStore.getState().select('door-99');
    expect(useBimStore.getState().selectedId).toBe('wall-a');
  });

  it('select is unrestricted when not in edit mode', () => {
    useBimStore.getState().select('any-element');
    expect(useBimStore.getState().selectedId).toBe('any-element');
  });
});
