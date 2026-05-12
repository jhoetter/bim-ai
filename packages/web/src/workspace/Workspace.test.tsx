import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import i18n from '../i18n';
import { useBimStore } from '../state/store';

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
  useBimStore.setState({
    selectedId: undefined,
    selectedIds: [],
    elementsById: {},
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
  });
});

afterEach(() => {
  cleanup();
  localStorage.removeItem('bim.onboarding-completed');
  localStorage.removeItem(TABS_KEY);
  useBimStore.setState({
    selectedId: undefined,
    selectedIds: [],
    elementsById: {},
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
  });
});

describe('<Workspace /> — smoke', () => {
  it('exposes semantic seven-region ownership landmarks — UX-RISK-013', () => {
    const { getByRole, queryByRole } = renderWithProviders(<Workspace />);

    const header = getByRole('banner', { name: 'Workspace header' });
    expect(within(header).getByRole('tablist', { name: 'Open views' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Open command palette' })).toBeTruthy();

    const primary = getByRole('complementary', { name: 'Project browser' });
    expect(within(primary).getByRole('tree', { name: 'Project browser' })).toBeTruthy();
    expect(within(primary).getByLabelText('Account menu')).toBeTruthy();

    const secondary = getByRole('complementary', { name: 'Active view settings' });
    expect(
      within(secondary).queryByText('Floor plan') ?? within(secondary).queryByText('3D view'),
    ).toBeTruthy();
    expect(
      within(secondary).queryByText('View State') ?? within(secondary).queryByText('Scene'),
    ).toBeTruthy();

    expect(getByRole('region', { name: 'Ribbon' })).toBeTruthy();
    expect(getByRole('main', { name: 'Canvas' })).toBeTruthy();
    expect(getByRole('contentinfo', { name: 'Global status footer' })).toBeTruthy();
    expect(queryByRole('complementary', { name: 'Inspector' })).toBeNull();
  });

  it('renders the AppShell, tab-first header, primary, secondary, and footer slots; inspector absent with no selection — CHR-V3-06', () => {
    const { getByTestId, getByRole, queryByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('workspace-header')).toBeTruthy();
    expect(getByTestId('view-tabs')).toBeTruthy();
    expect(getByTestId('workspace-header-cmdk')).toBeTruthy();
    expect(getByTestId('primary-project-selector')).toBeTruthy();
    expect(getByRole('complementary', { name: 'Project browser' })).toBeTruthy();
    expect(getByTestId('app-shell-secondary-sidebar')).toBeTruthy();
    // CHR-V3-06: Inspector is absent from DOM when nothing is selected.
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('keeps project, mode navigation, and authoring shortcuts out of the workspace header', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    const header = within(getByTestId('workspace-header'));

    expect(queryByTestId('topbar-project-name')).toBeNull();
    expect(queryByTestId('topbar-measure-shortcut')).toBeNull();
    expect(queryByTestId('topbar-dimension-shortcut')).toBeNull();
    expect(queryByTestId('topbar-tag-by-category-shortcut')).toBeNull();
    expect(queryByTestId('topbar-section-shortcut')).toBeNull();
    expect(queryByTestId('topbar-thin-lines')).toBeNull();
    expect(header.queryByRole('button', { name: /^Plan$/i })).toBeNull();
    expect(header.getByTestId('workspace-header-cmdk')).toBeTruthy();
    expect(header.getByTestId('workspace-header-share')).toBeTruthy();
  });

  it('keeps the primary sidebar navigation-only — UX-TEST-001', () => {
    const { getByTestId, getByRole, queryByTestId } = renderWithProviders(<Workspace />);
    const primary = within(getByTestId('app-shell-primary-sidebar'));

    expect(primary.getByTestId('primary-project-selector')).toBeTruthy();
    expect(primary.getByLabelText('Search')).toBeTruthy();
    expect(primary.getByText('Concept')).toBeTruthy();
    expect(primary.getByText('Floor Plans')).toBeTruthy();
    expect(primary.getByText('3D Views')).toBeTruthy();
    expect(primary.getByText('Sections')).toBeTruthy();
    expect(primary.getByText('Sheets')).toBeTruthy();
    expect(primary.getByText('Schedules')).toBeTruthy();
    expect(primary.getByTestId('primary-user-menu')).toBeTruthy();

    expect(primary.queryByText('Levels')).toBeNull();
    expect(primary.queryByText('Browser legend')).toBeNull();
    expect(primary.queryByText('Families…')).toBeNull();
    expect(primary.queryByText('Types')).toBeNull();
    expect(primary.queryByText('Wall Types')).toBeNull();
    expect(primary.queryByText('Architecture')).toBeNull();
    expect(primary.queryByText('Neutral')).toBeNull();
    expect(queryByTestId('left-rail-open-family-library')).toBeNull();
    expect(getByRole('complementary', { name: 'Project browser' })).toBeTruthy();
  });

  it('scopes primary sidebar search to navigation rows', () => {
    const { getByTestId } = renderWithProviders(<Workspace />);
    const primary = within(getByTestId('app-shell-primary-sidebar'));
    fireEvent.change(primary.getByLabelText('Search'), { target: { value: 'family' } });

    expect(primary.queryByText('Families')).toBeNull();
    expect(primary.queryByText('Wall Types')).toBeNull();
  });

  it('keeps 3D view controls in the secondary sidebar when no element is selected', () => {
    seedTabs('3d');
    const { getByTestId, getByRole } = renderWithProviders(<Workspace />);
    const secondary = within(getByTestId('app-shell-secondary-sidebar'));
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(getByTestId('app-shell-secondary-sidebar').hidden).toBe(false);
    expect(secondary.getByTestId('secondary-sidebar-3d')).toBeTruthy();
    expect(secondary.getByTestId('secondary-3d-sun')).toBeTruthy();
    expect(secondary.getByTestId('viewport3d-layers-panel')).toBeTruthy();
    expect(getByRole('button', { name: /Show material lighting and surface depth/i })).toBeTruthy();
  });

  it('uses explicit secondary sidebar adapters for every view type — UX-WP-04', () => {
    const cases: Array<[string, string]> = [
      ['plan', 'secondary-sidebar-plan'],
      ['plan-3d', 'secondary-sidebar-plan-3d'],
      ['section', 'secondary-sidebar-section'],
      ['sheet', 'secondary-sidebar-sheet'],
      ['schedule', 'secondary-sidebar-schedule'],
      ['concept', 'secondary-sidebar-concept'],
      ['agent', 'secondary-sidebar-agent'],
    ];

    for (const [kind, testId] of cases) {
      cleanup();
      seedTabs(kind, `tab-${kind}`);
      const rendered = renderWithProviders(<Workspace />);
      const secondary = within(rendered.getByTestId('app-shell-secondary-sidebar'));

      expect(secondary.getByTestId(testId)).toBeTruthy();
      expect(secondary.queryByTestId('right-rail-section-tabs')).toBeNull();
      expect(secondary.queryByTestId('right-rail-workbench')).toBeNull();
      expect(secondary.queryByTestId('right-rail-review')).toBeNull();

      rendered.unmount();
      localStorage.removeItem(TABS_KEY);
    }
  });

  it('groups secondary sidebar controls as view-wide state with advanced disclosure — UX-RISK-007', () => {
    for (const [kind, testId] of [
      ['plan', 'secondary-sidebar-plan'],
      ['3d', 'secondary-sidebar-3d'],
    ] as const) {
      cleanup();
      seedTabs(kind, `tab-${kind}`);
      const rendered = renderWithProviders(<Workspace />);
      const secondary = rendered.getByTestId('app-shell-secondary-sidebar');
      const adapter = within(secondary).getByTestId(testId);
      const sectionScopes = Array.from(adapter.querySelectorAll('[data-secondary-scope]')).map(
        (section) => section.getAttribute('data-secondary-scope'),
      );
      const advancedSections = Array.from(
        adapter.querySelectorAll('[data-secondary-scope="advanced"]'),
      );

      expect(sectionScopes).toContain('view-state');
      expect(sectionScopes).toContain('advanced');
      expect(advancedSections.length).toBeGreaterThan(0);
      for (const section of advancedSections) {
        expect(section.getAttribute('data-secondary-disclosure')).toBe('true');
      }
      expect(within(secondary).queryByTestId('inspector')).toBeNull();
      expect(within(secondary).queryByTestId('right-rail-review')).toBeNull();
      expect(within(secondary).queryByTestId('primary-user-menu')).toBeNull();

      rendered.unmount();
      localStorage.removeItem(TABS_KEY);
    }
  });

  it('keeps the element sidebar absent for an empty plan with no selection', () => {
    seedTabs('plan');
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
  });

  it('opens primary navigation views without occupying the element sidebar — UX-TEST-005', () => {
    const level: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'level-1',
      name: 'Level 1',
      elevationMm: 0,
    };
    const planView: Extract<Element, { kind: 'plan_view' }> = {
      kind: 'plan_view',
      id: 'plan-view-1',
      name: 'Level 1 Plan',
      levelId: level.id,
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall 1',
      wallTypeId: 'wt-1',
      levelId: level.id,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };

    useBimStore.setState({
      activeLevelId: level.id,
      selectedId: wall.id,
      elementsById: {
        [level.id]: level,
        [planView.id]: planView,
        [wall.id]: wall,
      },
    });

    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);

    fireEvent.click(getByTestId(`left-rail-row-${planView.id}`));

    expect(useBimStore.getState().selectedId).toBeUndefined();
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(queryByTestId('inspector')).toBeNull();
    expect(
      within(getByTestId('app-shell-secondary-sidebar')).getByTestId('secondary-sidebar-plan'),
    ).toBeTruthy();
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

  it('keeps persistent canvas chrome out of the redesign canvas root — UX-WP-07', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    const canvas = within(getByTestId('redesign-canvas-root'));

    expect(queryByTestId('tool-palette')).toBeNull();
    expect(queryByTestId('temporary-visibility-chip')).toBeNull();
    expect(canvas.queryByTestId('tool-palette')).toBeNull();
    expect(canvas.queryByTestId('temporary-visibility-chip')).toBeNull();
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('opens advisor findings from the footer and keeps advisor out of sidebars — UX-WP-08', () => {
    useBimStore.setState({
      violations: [
        {
          ruleId: 'wall_missing_type',
          severity: 'error',
          message: 'Wall needs a type.',
          elementIds: ['wall-1'],
          blocking: true,
        },
      ],
    });

    const { getByTestId, queryByTestId, getByText } = renderWithProviders(<Workspace />);

    expect(queryByTestId('right-rail-review')).toBeNull();
    expect(getByTestId('status-bar-advisor-entry').textContent).toContain('1 error');
    fireEvent.click(getByTestId('status-bar-advisor-entry'));

    expect(getByTestId('advisor-dialog')).toBeTruthy();
    expect(getByText('Wall needs a type.')).toBeTruthy();
    expect(getByTestId('advisor-navigate-wall-1')).toBeTruthy();
  });

  it('opens footer advisor through Cmd+K reachability — UX-WP-09', () => {
    useBimStore.setState({
      violations: [
        {
          ruleId: 'wall_missing_type',
          severity: 'warning',
          message: 'Wall needs a type.',
          elementIds: ['wall-1'],
        },
      ],
    });

    const { getByTestId, getByLabelText } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'open advisor' },
    });

    fireEvent.click(getByTestId('palette-entry-advisor.open'));

    expect(getByTestId('advisor-dialog')).toBeTruthy();
  });
});
