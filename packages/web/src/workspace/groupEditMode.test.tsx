import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { GroupEditModeBar } from '../groups/GroupEditModeBar';
import { InspectorPropertiesFor } from './inspector/InspectorContent';
import i18n from '../i18n';

const t = i18n.t.bind(i18n);

beforeEach(() => {
  useBimStore.setState({
    groupEditModeDefinitionId: null,
    activeGroupEditId: null,
    groupRegistry: { definitions: {}, instances: {} },
  });
});

afterEach(() => {
  cleanup();
});

describe('group edit mode — §8.9.3', () => {
  it('editGroup command sets activeGroupEditId', () => {
    useBimStore.getState().setActiveGroupEditId('def-1');
    expect(useBimStore.getState().activeGroupEditId).toBe('def-1');
  });

  it('finishEditGroup command clears activeGroupEditId', () => {
    useBimStore.getState().setActiveGroupEditId('def-1');
    useBimStore.getState().setActiveGroupEditId(null);
    expect(useBimStore.getState().activeGroupEditId).toBeNull();
  });

  it('finish-group-edit button dispatches finishEditGroup', () => {
    useBimStore.getState().setGroupEditModeDefinitionId('def-1');
    useBimStore.getState().setActiveGroupEditId('def-1');

    const { getByTestId } = render(<GroupEditModeBar />);
    fireEvent.click(getByTestId('finish-group-edit'));

    expect(useBimStore.getState().groupEditModeDefinitionId).toBeNull();
    expect(useBimStore.getState().activeGroupEditId).toBeNull();
  });

  it('inspector-group-edit button dispatches editGroup', () => {
    const detailGroup: Extract<Element, { kind: 'detail_group' }> = {
      kind: 'detail_group',
      id: 'grp-1',
      name: 'My Group',
      hostViewId: 'view-1',
      memberIds: ['wall-1', 'wall-2'],
    };

    const dispatched: Record<string, unknown>[] = [];
    const { getByTestId } = render(
      InspectorPropertiesFor(detailGroup, t, {
        onDispatchCommand: (cmd) => dispatched.push(cmd),
      }),
    );

    fireEvent.click(getByTestId('inspector-group-edit'));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({ type: 'editGroup', groupDefinitionId: 'grp-1' });
  });
});
