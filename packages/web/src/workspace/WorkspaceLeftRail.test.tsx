import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { WorkspaceLeftRail } from './WorkspaceLeftRail';

afterEach(() => {
  cleanup();
  useBimStore.setState({ elementsById: {} });
});

const savedViewEl = {
  kind: 'saved_view',
  id: 'sv-01',
  baseViewId: 'vp-base',
  name: 'Kitchen Detail',
} as unknown as Element;

const sheetEl = {
  kind: 'sheet',
  id: 'sheet-a101',
  name: 'A101 — Floor Plan',
} as unknown as Element;

function renderRail(onSemanticCommand?: (cmd: Record<string, unknown>) => void) {
  return render(
    <WorkspaceLeftRail openTabFromElement={vi.fn()} onSemanticCommand={onSemanticCommand} />,
  );
}

describe('WorkspaceLeftRail — §14.5 Camera Views section', () => {
  it('perspective saved_view appears under Camera Views section', () => {
    useBimStore.setState({
      elementsById: {
        'sv-p': {
          kind: 'saved_view',
          id: 'sv-p',
          baseViewId: 'vp-base',
          name: 'My Camera',
          viewType: 'perspective',
        } as Element,
      },
    });
    const { getByTestId, getByText } = renderRail();
    expect(getByTestId('left-rail-camera-views-header')).toBeTruthy();
    expect(getByText('My Camera')).toBeTruthy();
  });

  it('orthographic saved_view appears in Saved Views — not Camera Views', () => {
    useBimStore.setState({
      elementsById: {
        'sv-o': {
          kind: 'saved_view',
          id: 'sv-o',
          baseViewId: 'vp-base',
          name: 'Ortho Snap',
          viewType: 'orthographic',
        } as Element,
      },
    });
    const { queryByTestId, getByText } = renderRail();
    expect(queryByTestId('left-rail-camera-views-header')).toBeNull();
    expect(getByText('Ortho Snap')).toBeTruthy();
  });

  it('Camera Views section absent when no perspective views exist', () => {
    useBimStore.setState({ elementsById: {} });
    const { queryByTestId } = renderRail();
    expect(queryByTestId('left-rail-camera-views-header')).toBeNull();
  });
});

describe('WorkspaceLeftRail — Place on Sheet (§6.1.3)', () => {
  it('"Place on Sheet…" appears in context menu for a saved_view row', () => {
    useBimStore.setState({
      elementsById: {
        [savedViewEl.id]: savedViewEl,
      },
    });
    const onCmd = vi.fn();
    const { getByTestId } = renderRail(onCmd);

    fireEvent.contextMenu(getByTestId('left-rail-row-sv-01'));
    expect(getByTestId('primary-nav-ctx-place-on-sheet')).toBeTruthy();
  });

  it('clicking a sheet in the picker dispatches update_sheet with viewRef starting with saved_view:', () => {
    useBimStore.setState({
      elementsById: {
        [savedViewEl.id]: savedViewEl,
        [sheetEl.id]: sheetEl,
      },
    });
    const onCmd = vi.fn();
    const { getByTestId } = renderRail(onCmd);

    fireEvent.contextMenu(getByTestId('left-rail-row-sv-01'));
    fireEvent.click(getByTestId('primary-nav-ctx-place-on-sheet'));

    const modal = getByTestId('sheet-picker-modal');
    expect(modal).toBeTruthy();
    fireEvent.click(within(modal).getByText('A101 — Floor Plan'));

    expect(onCmd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update_sheet',
        id: 'sheet-a101',
        viewportsMm: expect.arrayContaining([
          expect.objectContaining({ viewRef: 'saved_view:sv-01' }),
        ]),
      }),
    );
  });
});
