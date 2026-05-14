import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Capture the prop the PlanCanvas mock receives so we can fire wall
// commands as the canvas would. Spec §32 V07 + T-01 — pins the wiring
// from PlanCanvas's onSemanticCommand to the real applyCommand path,
// closing the bug where walls were silently dropped on the floor.
type PlanCanvasProps = {
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
};
const planCanvasProps: { current: PlanCanvasProps | null } = { current: null };

vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));
vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: (p: PlanCanvasProps) => {
    planCanvasProps.current = p;
    return <div data-testid="stub-plan-canvas" />;
  },
}));

const mockApplyCommand = vi.fn();
const mockBootstrap = vi.fn();
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    applyCommand: (...args: unknown[]) => mockApplyCommand(...args),
    bootstrap: (...args: unknown[]) => mockBootstrap(...args),
  };
});

import { Workspace } from './Workspace';
import { useBimStore } from '../state/store';

const TABS_KEY = 'bim-ai:tabs-v1';
const PANE_LAYOUT_KEY = 'bim-ai:pane-layout-v1';
const COMPOSITIONS_KEY = 'bim-ai:workspace-compositions-v1';

function seedPlanCanvasTab(): void {
  localStorage.setItem(
    TABS_KEY,
    JSON.stringify({
      v: 1,
      tabs: [{ id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'Plan · Ground Floor' }],
      activeId: 'plan:l0',
    }),
  );
  localStorage.setItem(
    PANE_LAYOUT_KEY,
    JSON.stringify({
      v: 1,
      layout: {
        focusedLeafId: 'pane-root',
        root: { kind: 'leaf', id: 'pane-root', tabId: 'plan:l0' },
      },
    }),
  );
}

function seed3dTab(): void {
  localStorage.setItem(
    TABS_KEY,
    JSON.stringify({
      v: 1,
      tabs: [{ id: '3d:view-1', kind: '3d', targetId: 'view-1', label: '3D · View 1' }],
      activeId: '3d:view-1',
    }),
  );
  localStorage.setItem(
    PANE_LAYOUT_KEY,
    JSON.stringify({
      v: 1,
      layout: {
        focusedLeafId: 'pane-root',
        root: { kind: 'leaf', id: 'pane-root', tabId: '3d:view-1' },
      },
    }),
  );
}

beforeEach(() => {
  planCanvasProps.current = null;
  mockApplyCommand.mockReset();
  mockBootstrap.mockReset();
  localStorage.removeItem(TABS_KEY);
  localStorage.removeItem(PANE_LAYOUT_KEY);
  localStorage.removeItem(COMPOSITIONS_KEY);
  // Keep semantic-command tests deterministic by suppressing onboarding
  // overlay, which otherwise takes over initial canvas mount in jsdom.
  localStorage.setItem('bim.onboarding-completed', 'true');
  // Seed an explicit plan tab + pane assignment so Workspace mounts
  // PlanCanvas under the tab-aware empty-state contract.
  seedPlanCanvasTab();
  // Seed the store with a model id so onSemanticCommand can dispatch +
  // force plan_canvas viewer mode so the canvas mounts PlanCanvas (default
  // viewerMode in the store is 'orbit_3d', which would mount Viewport).
  useBimStore.setState({
    modelId: 'test-model',
    userId: 'user-1',
    viewerMode: 'plan_canvas',
  });
});

afterEach(() => {
  localStorage.removeItem('bim.onboarding-completed');
  localStorage.removeItem(TABS_KEY);
  localStorage.removeItem(PANE_LAYOUT_KEY);
  localStorage.removeItem(COMPOSITIONS_KEY);
  cleanup();
});

describe('<Workspace /> — semantic command wiring (T-01)', () => {
  it('passes a real callback (not the no-op) to PlanCanvas', async () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );
    expect(getByTestId('stub-plan-canvas')).toBeTruthy();
    await waitFor(() => expect(planCanvasProps.current).not.toBeNull());
    const fn = planCanvasProps.current?.onSemanticCommand;
    expect(typeof fn).toBe('function');
    // The no-op was an arrow that returned undefined unconditionally — the
    // real handler should at least *try* to fire applyCommand when called.
    fn?.({
      type: 'createWall',
      levelId: 'l0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
    });
    await waitFor(() => expect(mockApplyCommand).toHaveBeenCalledTimes(1));
  });

  it('forwards the command shape and the modelId from the store', async () => {
    mockApplyCommand.mockResolvedValue({ revision: 7, elements: {}, violations: [] });
    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );
    await waitFor(() => expect(planCanvasProps.current).not.toBeNull());
    planCanvasProps.current?.onSemanticCommand({
      type: 'createWall',
      levelId: 'l0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
    });
    await waitFor(() => {
      expect(mockApplyCommand).toHaveBeenCalledWith(
        'test-model',
        expect.objectContaining({ type: 'createWall' }),
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });

  it('hydrates the store from the apply response on success', async () => {
    mockApplyCommand.mockResolvedValue({
      revision: 12,
      elements: {
        'wall-new': {
          kind: 'wall',
          id: 'wall-new',
          name: 'wall-new',
          levelId: 'l0',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 1000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      },
      violations: [],
    });
    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );
    await waitFor(() => expect(planCanvasProps.current).not.toBeNull());
    planCanvasProps.current?.onSemanticCommand({ type: 'createWall' });
    await waitFor(() => {
      const els = useBimStore.getState().elementsById;
      expect(els['wall-new']).toBeDefined();
      expect(useBimStore.getState().revision).toBe(12);
    });
  });

  it('deletes the selected element with Backspace outside plan views', async () => {
    seed3dTab();
    mockApplyCommand.mockResolvedValue({ revision: 2, elements: {}, violations: [] });
    useBimStore.setState({
      viewerMode: 'orbit_3d',
      elementsById: {
        'wall-existing': {
          kind: 'wall',
          id: 'wall-existing',
          name: 'wall-existing',
          levelId: 'l0',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 1000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      } as never,
      selectedId: 'wall-existing',
      selectedIds: [],
    });
    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    await waitFor(() => {
      expect(mockApplyCommand).toHaveBeenCalledWith(
        'test-model',
        { type: 'deleteElement', elementId: 'wall-existing' },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
    expect(useBimStore.getState().selectedId).toBeUndefined();
  });

  it('applies response deltas without replacing unchanged element references', async () => {
    const existingWall = {
      kind: 'wall',
      id: 'wall-existing',
      name: 'wall-existing',
      levelId: 'l0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
    useBimStore.setState({
      revision: 1,
      elementsById: { 'wall-existing': existingWall } as never,
    });
    mockApplyCommand.mockResolvedValue({
      revision: 2,
      delta: {
        revision: 2,
        elements: {
          'wall-new': {
            kind: 'wall',
            id: 'wall-new',
            name: 'wall-new',
            levelId: 'l0',
            start: { xMm: 0, yMm: 1000 },
            end: { xMm: 1000, yMm: 1000 },
            thicknessMm: 200,
            heightMm: 2800,
          },
        },
        violations: [],
        removedIds: [],
        clientOpId: 'local-test-op',
      },
      elements: {},
      violations: [],
    });
    render(
      <MemoryRouter initialEntries={['/redesign']}>
        <Workspace />
      </MemoryRouter>,
    );
    await waitFor(() => expect(planCanvasProps.current).not.toBeNull());
    planCanvasProps.current?.onSemanticCommand({ type: 'createWall' });
    await waitFor(() => {
      const state = useBimStore.getState();
      expect(state.revision).toBe(2);
      expect(state.elementsById['wall-new']).toBeDefined();
      expect(state.elementsById['wall-existing']).toBe(existingWall);
    });
    expect(mockApplyCommand).toHaveBeenCalledWith(
      'test-model',
      expect.objectContaining({ type: 'createWall' }),
      expect.objectContaining({
        userId: 'user-1',
        clientOpId: expect.stringMatching(/^web-/),
      }),
    );
  });
});
