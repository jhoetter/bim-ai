import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/redesign']}>{children}</MemoryRouter>
      </I18nextProvider>
    ),
  });
}

// Stub the Three.js-mounting canvases so jsdom can render the chrome.
vi.mock('../Viewport', () => ({
  Viewport: () => <div data-testid="stub-viewport" />,
}));
vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: () => <div data-testid="stub-plan-canvas" />,
}));

import { Workspace } from './Workspace';

const TABS_KEY = 'bim-ai:tabs-v1';

function seedTabs(kind: string, id = 'tab-test-1') {
  localStorage.setItem(
    TABS_KEY,
    JSON.stringify({ v: 1, tabs: [{ id, kind, label: `Test ${kind}` }], activeId: id }),
  );
}

beforeEach(() => {
  localStorage.removeItem(TABS_KEY);
  // Suppress the OnboardingTour dialog so aria-modal doesn't hide canvas content.
  localStorage.setItem('bim.onboarding-completed', 'true');
});

afterEach(() => {
  cleanup();
  localStorage.removeItem('bim.onboarding-completed');
  localStorage.removeItem(TABS_KEY);
});

describe('<Workspace /> — smoke', () => {
  it('renders the AppShell, TopBar, primary, secondary, and footer slots; inspector absent with no selection — CHR-V3-06', () => {
    const { getByTestId, getByRole, queryByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('topbar')).toBeTruthy();
    expect(getByRole('complementary', { name: 'Project browser' })).toBeTruthy();
    expect(getByTestId('app-shell-secondary-sidebar')).toBeTruthy();
    // CHR-V3-06: Inspector is absent from DOM when nothing is selected.
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('keeps 3D view controls in the secondary sidebar when no element is selected', () => {
    seedTabs('3d');
    const { getByTestId, getByRole } = renderWithProviders(<Workspace />);
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(getByTestId('app-shell-secondary-sidebar').hidden).toBe(false);
    expect(getByRole('button', { name: /Show material lighting and surface depth/i })).toBeTruthy();
  });

  it('keeps the element sidebar absent for an empty plan with no selection', () => {
    seedTabs('plan');
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
  });

  it('mounts the redesign canvas root', () => {
    const { getByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('redesign-canvas-root')).toBeTruthy();
  });

  it('shows the empty-state overlay when no walls exist', () => {
    const { getByText } = renderWithProviders(<Workspace />);
    // §25 canvas overlay — shows "Loading model…" while seed fetch is in flight,
    // then falls back to "This level is empty." once fetch settles.
    expect(getByText(/Loading model|This level is empty/)).toBeTruthy();
  });

  it('renders the floating tool palette', () => {
    const { getByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('tool-palette')).toBeTruthy();
  });
});
