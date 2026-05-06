import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Stub the Three.js-mounting canvases so jsdom can render the chrome.
vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));
vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: () => <div data-testid="stub-plan-canvas" />,
}));

import { RedesignedWorkspace } from './RedesignedWorkspace';

beforeEach(() => {
  // Suppress the OnboardingTour dialog so aria-modal doesn't hide canvas content.
  localStorage.setItem('bim.onboarding-completed', JSON.stringify({ completed: true }));
});

afterEach(() => {
  cleanup();
  localStorage.removeItem('bim.onboarding-completed');
});

describe('<RedesignedWorkspace /> — smoke', () => {
  it('renders the AppShell, TopBar, LeftRail, Inspector, StatusBar slots', () => {
    const { getByTestId, getByRole } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <RedesignedWorkspace />
      </MemoryRouter>,
    );
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('topbar')).toBeTruthy();
    expect(getByRole('tree', { name: 'Project browser' })).toBeTruthy();
    expect(getByTestId('inspector')).toBeTruthy();
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('mounts the redesign canvas root', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <RedesignedWorkspace />
      </MemoryRouter>,
    );
    expect(getByTestId('redesign-canvas-root')).toBeTruthy();
  });

  it('shows the empty-state overlay when no walls exist', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <RedesignedWorkspace />
      </MemoryRouter>,
    );
    // §25 canvas overlay — shows "Loading model…" while seed fetch is in flight,
    // then falls back to "This level is empty." once fetch settles.
    expect(getByText(/Loading model|This level is empty/)).toBeTruthy();
  });

  it('renders the floating tool palette', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/redesign']}>
        <RedesignedWorkspace />
      </MemoryRouter>,
    );
    expect(getByTestId('tool-palette')).toBeTruthy();
  });
});
