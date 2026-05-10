import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBimStore } from '../state/store';

vi.mock('../Viewport', () => ({
  Viewport: ({ wsConnected }: { wsConnected: boolean }) => (
    <div data-testid="mock-viewport" data-ws-connected={String(wsConnected)} />
  ),
}));

import { PresentationViewer } from './PresentationViewer';

describe('<PresentationViewer />', () => {
  beforeEach(() => {
    useBimStore.getState().hydrateFromSnapshot({
      modelId: 'empty',
      revision: 0,
      elements: {},
      violations: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('hydrates the shared snapshot and renders the viewport instead of placeholder text', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          modelId: 'shared-model',
          revision: 7,
          elements: {
            'lvl-0': { kind: 'level', name: 'Ground', elevationMm: 0 },
            'wall-1': {
              kind: 'wall',
              name: 'W1',
              levelId: 'lvl-0',
              start: { xMm: 0, yMm: 0 },
              end: { xMm: 5000, yMm: 0 },
              thicknessMm: 200,
              heightMm: 2800,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { findByTestId, queryByText } = render(<PresentationViewer token="shared-token" />);

    expect(await findByTestId('mock-viewport')).toBeTruthy();
    await waitFor(() => expect(useBimStore.getState().modelId).toBe('shared-model'));
    expect(useBimStore.getState().revision).toBe(7);
    expect(useBimStore.getState().elementsById['wall-1']?.kind).toBe('wall');
    expect(queryByText(/Viewing model/)).toBeNull();
  });
});
