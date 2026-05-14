/**
 * VIS-V3-08 — Paper mode tests.
 *
 * Verifies that the canvas container applies:
 *   - `data-view-type` attribute from the active tab kind
 *   - `background: var(--color-canvas-paper)` for 2D view kinds (plan, section)
 *   - `background: var(--color-background)` for 3D view kinds
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import i18n from '../../i18n';

const TABS_KEY = 'bim-ai:tabs-v1';
const COMPOSITIONS_KEY = 'bim-ai:workspace-compositions-v1';
const ONBOARDING_KEY = 'bim.onboarding-completed';

// Stub heavy canvases so jsdom renders the chrome without WebGL.
vi.mock('../../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));
vi.mock('../../plan/PlanCanvas', () => ({
  PlanCanvas: () => <div data-testid="stub-plan-canvas" />,
}));

import { Workspace } from '../Workspace';

beforeEach(() => {
  localStorage.removeItem(COMPOSITIONS_KEY);
});

function renderWorkspace() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/']}>{<Workspace />}</MemoryRouter>
    </I18nextProvider>,
  );
}

function seedTabs(kind: string, id = 'tab-test-1') {
  localStorage.setItem(
    TABS_KEY,
    JSON.stringify({ v: 1, tabs: [{ id, kind, label: `Test ${kind}` }], activeId: id }),
  );
}

afterEach(() => {
  cleanup();
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(TABS_KEY);
  localStorage.removeItem(COMPOSITIONS_KEY);
});

describe('VIS-V3-08 — paper mode canvas background', () => {
  it('canvas root always has a data-view-type attribute', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
    const { getByTestId } = renderWorkspace();
    const canvasRoot = getByTestId('redesign-canvas-root') as HTMLElement;
    expect(canvasRoot.hasAttribute('data-view-type')).toBe(true);
  });

  it('applies paper background when active tab kind is plan', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
    seedTabs('plan');
    const { getByTestId } = renderWorkspace();
    const canvasRoot = getByTestId('redesign-canvas-root') as HTMLElement;
    expect(canvasRoot.getAttribute('data-view-type')).toBe('plan');
    expect(canvasRoot.style.background).toBe('var(--color-canvas-paper)');
  });

  it('applies dark background when active tab kind is 3d', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
    seedTabs('3d');
    const { getByTestId } = renderWorkspace();
    const canvasRoot = getByTestId('redesign-canvas-root') as HTMLElement;
    expect(canvasRoot.getAttribute('data-view-type')).toBe('3d');
    expect(canvasRoot.style.background).toBe('var(--color-background)');
  });

  it('applies paper background when active tab kind is section', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
    seedTabs('section');
    const { getByTestId } = renderWorkspace();
    const canvasRoot = getByTestId('redesign-canvas-root') as HTMLElement;
    expect(canvasRoot.getAttribute('data-view-type')).toBe('section');
    expect(canvasRoot.style.background).toBe('var(--color-canvas-paper)');
  });

  it('falls back to dark background when no active tab', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
    // No tabs persisted — activeTab is null, data-view-type resolves to "none".
    const { getByTestId } = renderWorkspace();
    const canvasRoot = getByTestId('redesign-canvas-root') as HTMLElement;
    expect(canvasRoot.getAttribute('data-view-type')).toBe('none');
    expect(canvasRoot.style.background).toBe('var(--color-background)');
  });
});
