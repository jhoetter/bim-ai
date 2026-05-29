/**
 * FE-CQ-01-followup: Workspace render-count regression harness.
 *
 * The follow-up to FE-CQ-01 (PR #165) eliminated the broad
 * `elementsById` subscription at Workspace.tsx:179. This test pins the
 * win in place: a stream of authoring deltas that only touch
 * `elementsById` (no level/sheet/plan-view/saved-view/section-cut
 * churn — those are covered by the narrow `modelIndices.*` selectors
 * shipped in PR #165) must NOT cause more than the structural-
 * validation re-render (the one legitimate broad-reactive case
 * documented in `useStructuralValidationViolations`).
 *
 * Budget: ≤ 3 renders/sec at p50 under 30 authoring deltas, fired in
 * one synchronous batch. With the old broad subscription this surged
 * to 30+ renders. After the followup it should drop to 1-3 renders
 * (initial mount + the structural-validation broad subscription
 * coalesces every batch of inflight state changes).
 *
 * The probe relies on `useRenderCount('Workspace')` (PERF-G07) at
 * Workspace.tsx:176.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';

import i18n from '../i18n';
import { useBimStore } from '../state/store';
import { readRenderCountProbe, resetRenderCountProbe } from '@bim-ai/web-state';

vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));
vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: () => <div data-testid="stub-plan-canvas" />,
}));
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchActivity: () => Promise.resolve({ events: [] }),
    fetchBuildingPresets: () => Promise.resolve([]),
    fetchComments: () => Promise.resolve({ comments: [] }),
  };
});

import { Workspace } from './Workspace';

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/redesign']}>{children}</MemoryRouter>
      </I18nextProvider>
    ),
  });
}

function wallElement(id: string, length: number): Element {
  return {
    id,
    kind: 'wall',
    name: id,
    levelId: 'L1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: length, yMm: 0 },
    thicknessMm: 100,
    heightMm: 2400,
  } as unknown as Element;
}

beforeEach(() => {
  resetRenderCountProbe();
  (window as { __BIM_AI_RECORD_RENDER_COUNTS__?: boolean }).__BIM_AI_RECORD_RENDER_COUNTS__ = true;
  localStorage.setItem('bim.onboarding-completed', 'true');
  useBimStore.setState({
    modelId: 'm1',
    revision: 1,
    selectedId: undefined,
    selectedIds: [],
    elementsById: {
      w1: wallElement('w1', 1000),
    },
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    planTool: 'select',
    vvDialogOpen: false,
  });
});

afterEach(() => {
  cleanup();
  resetRenderCountProbe();
  localStorage.removeItem('bim.onboarding-completed');
  useBimStore.setState({
    modelId: undefined,
    revision: undefined,
    selectedId: undefined,
    selectedIds: [],
    elementsById: {},
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    planTool: 'select',
    vvDialogOpen: false,
  });
});

describe('<Workspace /> render budget under elementsById churn', () => {
  it('does not re-render per authoring delta on wall edits — FE-CQ-01-followup', () => {
    renderWithProviders(<Workspace />);
    const mountCount = readRenderCountProbe()['Workspace']?.count ?? 0;
    expect(mountCount).toBeGreaterThan(0);

    // Stream 30 wall-only authoring deltas in one act so React can
    // coalesce. This simulates a burst of inline drag-resize updates.
    act(() => {
      for (let i = 0; i < 30; i += 1) {
        const next: Record<string, Element> = {};
        for (let j = 0; j <= i; j += 1) {
          next[`w${j}`] = wallElement(`w${j}`, 1000 + j * 10);
        }
        useBimStore.setState({ elementsById: next });
      }
    });

    const finalCount = readRenderCountProbe()['Workspace']?.count ?? 0;
    const deltaRenders = finalCount - mountCount;
    console.log(
      `FE-CQ-01-followup render-budget probe: ` +
        `mount=${mountCount}, post-30-deltas=${finalCount}, ` +
        `extra-renders=${deltaRenders}`,
    );
    // Budget: ≤ 3 extra renders per stream (the structural-validation
    // broad subscription is the one legitimate broad-reactive case;
    // React batches the streamed setState calls into a single render
    // commit). Allow a small headroom for downstream selector churn
    // (drift count, advisor merge memo, etc.).
    expect(deltaRenders).toBeLessThanOrEqual(3);
  });
});
