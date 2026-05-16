import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { useBimStore } from '../state/store';
import { applyCreateGroup } from './groupCommands';
import { GroupEditModeBar } from './GroupEditModeBar';

afterEach(() => {
  cleanup();
  useBimStore.setState({
    groupEditModeDefinitionId: null,
    groupRegistry: { definitions: {}, instances: {} },
  });
});

function seedGroupInStore(name = 'My Group', elementIds = ['wall-1', 'wall-2']): string {
  let counter = 0;
  const { registry, definitionId } = applyCreateGroup(
    { definitions: {}, instances: {} },
    { type: 'createGroup', name, elementIds, originXMm: 0, originYMm: 0 },
    () => `seed-${++counter}`,
  );
  useBimStore.getState().setGroupRegistry(registry);
  return definitionId;
}

describe('GroupEditModeBar — §8.9.3', () => {
  it('renders group-edit-mode-bar when groupEditModeDefinitionId is set', () => {
    const defId = seedGroupInStore('Kitchen');
    useBimStore.getState().setGroupEditModeDefinitionId(defId);

    const { getByTestId, getByText } = render(<GroupEditModeBar />);

    expect(getByTestId('group-edit-mode-bar')).toBeTruthy();
    expect(getByText(/Editing group: Kitchen/)).toBeTruthy();
    expect(getByTestId('finish-edit-group-btn')).toBeTruthy();
  });

  it('does not render when groupEditModeDefinitionId is null', () => {
    const { queryByTestId } = render(<GroupEditModeBar />);
    expect(queryByTestId('group-edit-mode-bar')).toBeNull();
  });

  it('finish-edit-group-btn clears edit mode', () => {
    const defId = seedGroupInStore();
    useBimStore.getState().setGroupEditModeDefinitionId(defId);

    const { getByTestId } = render(<GroupEditModeBar />);
    const btn = getByTestId('finish-edit-group-btn');

    fireEvent.click(btn);

    expect(useBimStore.getState().groupEditModeDefinitionId).toBeNull();
  });
});
