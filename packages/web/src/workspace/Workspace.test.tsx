import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
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
  Viewport: ({
    activeTabId,
    lensMode,
    activePlanTool,
  }: {
    activeTabId?: string;
    lensMode?: string;
    activePlanTool?: string;
  }) => (
    <div
      data-testid="stub-viewport"
      data-active-tab-id={activeTabId ?? ''}
      data-lens-mode={lensMode ?? ''}
      data-active-plan-tool={activePlanTool ?? ''}
    />
  ),
}));
vi.mock('../plan/PlanCanvas', () => ({
  PlanCanvas: ({
    activeTabId,
    lensMode,
    activePlanTool,
  }: {
    activeTabId?: string;
    lensMode?: string;
    activePlanTool?: string;
  }) => (
    <div
      data-testid="stub-plan-canvas"
      data-active-tab-id={activeTabId ?? ''}
      data-lens-mode={lensMode ?? ''}
      data-active-plan-tool={activePlanTool ?? ''}
    />
  ),
}));

import { Workspace } from './Workspace';

const TABS_KEY = 'bim-ai:tabs-v1';
const RIBBON_HIDDEN_KEY = 'bim-ai.ribbon.hiddenCommands.v1';
const PANE_LAYOUT_KEY = 'bim-ai:pane-layout-v1';
const COMPOSITIONS_KEY = 'bim-ai:workspace-compositions-v1';

function seedTabs(kind: string, id = 'tab-test-1') {
  localStorage.setItem(
    TABS_KEY,
    JSON.stringify({ v: 1, tabs: [{ id, kind, label: `Test ${kind}` }], activeId: id }),
  );
}

function seedSplitPaneLayout(leftTabId: string, rightTabId: string) {
  localStorage.setItem(
    PANE_LAYOUT_KEY,
    JSON.stringify({
      v: 1,
      layout: {
        focusedLeafId: 'pane-right',
        root: {
          kind: 'split',
          id: 'pane-root',
          axis: 'horizontal',
          first: { kind: 'leaf', id: 'pane-left', tabId: leftTabId },
          second: { kind: 'leaf', id: 'pane-right', tabId: rightTabId },
        },
      },
    }),
  );
}

function paneSecondary(
  rendered: ReturnType<typeof renderWithProviders>,
  paneId?: string,
): HTMLElement {
  if (paneId) return rendered.getByTestId(`canvas-pane-secondary-sidebar-${paneId}`);
  const sidebar = rendered.container.querySelector<HTMLElement>(
    '[data-testid^="canvas-pane-secondary-sidebar-"]',
  );
  if (!sidebar) throw new Error('Expected a pane-local secondary sidebar');
  return sidebar;
}

function paneRibbon(
  rendered: ReturnType<typeof renderWithProviders>,
  paneId?: string,
): HTMLElement {
  if (paneId) return rendered.getByTestId(`canvas-pane-ribbon-${paneId}`);
  const ribbon = rendered.container.querySelector<HTMLElement>(
    '[data-testid^="canvas-pane-ribbon-"]',
  );
  if (!ribbon) throw new Error('Expected a pane-local ribbon');
  return ribbon;
}

function paneViewHeader(
  rendered: ReturnType<typeof renderWithProviders>,
  paneId?: string,
): HTMLElement {
  if (paneId) return rendered.getByTestId(`canvas-pane-view-header-${paneId}`);
  const header = rendered.container.querySelector<HTMLElement>(
    '[data-testid^="canvas-pane-view-header-"]',
  );
  if (!header) throw new Error('Expected a pane-local view header');
  return header;
}

function paneElementSidebar(
  rendered: ReturnType<typeof renderWithProviders>,
  paneId?: string,
): HTMLElement {
  if (paneId) return rendered.getByTestId(`canvas-pane-element-sidebar-${paneId}`);
  const sidebar = rendered.container.querySelector<HTMLElement>(
    '[data-testid^="canvas-pane-element-sidebar-"]',
  );
  if (!sidebar) throw new Error('Expected a pane-local element sidebar');
  return sidebar;
}

beforeEach(() => {
  localStorage.removeItem(TABS_KEY);
  localStorage.removeItem(RIBBON_HIDDEN_KEY);
  localStorage.removeItem(PANE_LAYOUT_KEY);
  localStorage.removeItem(COMPOSITIONS_KEY);
  // Suppress the OnboardingTour dialog so aria-modal doesn't hide canvas content.
  localStorage.setItem('bim.onboarding-completed', 'true');
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
    vvDialogOpen: false,
  });
});

afterEach(() => {
  cleanup();
  localStorage.removeItem('bim.onboarding-completed');
  localStorage.removeItem(TABS_KEY);
  localStorage.removeItem(RIBBON_HIDDEN_KEY);
  localStorage.removeItem(PANE_LAYOUT_KEY);
  localStorage.removeItem(COMPOSITIONS_KEY);
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
    vvDialogOpen: false,
  });
});

describe('<Workspace /> — smoke', () => {
  it('exposes semantic seven-region ownership landmarks — UX-RISK-013', () => {
    const { getByRole, queryByRole } = renderWithProviders(<Workspace />);

    const header = getByRole('banner', { name: 'Workspace header' });
    expect(within(header).getByRole('tablist', { name: 'Compositions' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Open command palette' })).toBeTruthy();

    const primary = getByRole('complementary', { name: 'Project browser' });
    expect(within(primary).getByRole('tree', { name: 'Project browser' })).toBeTruthy();
    expect(within(primary).getByLabelText('Account menu')).toBeTruthy();

    expect(getByRole('main', { name: 'Canvas' })).toBeTruthy();
    expect(getByRole('contentinfo', { name: 'Global status footer' })).toBeTruthy();
    expect(queryByRole('complementary', { name: 'Inspector' })).toBeNull();
  });

  it('renders the AppShell, tab-first header, primary, secondary, and footer slots; inspector absent with no selection — CHR-V3-06', () => {
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, getByRole, queryByTestId } = rendered;
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('workspace-header')).toBeTruthy();
    expect(getByTestId('composition-bar')).toBeTruthy();
    expect(getByTestId('workspace-header-cmdk')).toBeTruthy();
    expect(getByTestId('primary-project-selector')).toBeTruthy();
    expect(getByRole('complementary', { name: 'Project browser' })).toBeTruthy();
    expect(
      rendered.container.querySelectorAll('[data-testid^="canvas-pane-secondary-sidebar-"]'),
    ).toHaveLength(0);
    // CHR-V3-06: Inspector is absent from DOM when nothing is selected.
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('keeps project, mode navigation, and authoring shortcuts out of the workspace header', () => {
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;
    const header = within(getByTestId('workspace-header'));

    expect(queryByTestId('topbar-project-name')).toBeNull();
    expect(queryByTestId('topbar-measure-shortcut')).toBeNull();
    expect(queryByTestId('topbar-dimension-shortcut')).toBeNull();
    expect(queryByTestId('topbar-tag-by-category-shortcut')).toBeNull();
    expect(queryByTestId('topbar-section-shortcut')).toBeNull();
    expect(queryByTestId('topbar-thin-lines')).toBeNull();
    expect(queryByTestId('source-view-chip')).toBeNull();
    expect(header.queryByRole('button', { name: /^Plan$/i })).toBeNull();
    expect(header.getByTestId('workspace-header-cmdk')).toBeTruthy();
    expect(header.getByTestId('workspace-header-share')).toBeTruthy();
  });

  it('owns discipline lens in the pane view header while the secondary sidebar is open', () => {
    seedTabs('plan');
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;
    const primary = within(getByTestId('app-shell-primary-sidebar'));
    const viewHeader = within(paneViewHeader(rendered));
    const ribbon = within(paneRibbon(rendered));
    const statusBar = getByTestId('status-bar');
    const footer = within(statusBar);

    expect(primary.queryByTestId('primary-lens-filter')).toBeNull();
    expect(primary.queryByTestId('primary-lens-dropdown')).toBeNull();
    expect(viewHeader.getByTestId('ribbon-lens-dropdown')).toBeTruthy();
    expect(viewHeader.getByTestId('lens-dropdown-trigger')).toBeTruthy();
    expect(ribbon.queryByTestId('ribbon-lens-dropdown')).toBeNull();
    expect(queryByTestId('secondary-lens-filter')).toBeNull();
    expect(queryByTestId('secondary-lens-dropdown')).toBeNull();
    expect(footer.queryByTestId('lens-dropdown-trigger')).toBeNull();
    expect(statusBar.textContent).not.toContain('Show:');
  });

  it('reserves a ribbon-height view header above the pane secondary sidebar', () => {
    seedTabs('3d');
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId } = rendered;
    const secondary = paneSecondary(rendered);
    const ribbon = paneRibbon(rendered);
    const viewHeader = paneViewHeader(rendered);

    expect(viewHeader.parentElement).toBe(ribbon.parentElement?.parentElement);
    expect(secondary.parentElement).toBe(ribbon.parentElement?.parentElement);
    expect(viewHeader.textContent).toContain('3D');
    expect(within(ribbon).queryByTestId('ribbon-mode-identity')).toBeNull();

    fireEvent.click(getByTestId('ribbon-mode-identity'));
    expect(
      rendered.container.querySelector('[data-testid^="canvas-pane-secondary-sidebar-"]'),
    ).toBeNull();
    expect(within(paneRibbon(rendered)).getByTestId('ribbon-mode-identity').textContent).toContain(
      '3D',
    );
  });

  it('activates ceiling tool directly from ribbon create panel', () => {
    seedTabs('plan');
    const { getByTestId } = renderWithProviders(<Workspace />);
    const button = getByTestId('ribbon-command-ceiling');
    fireEvent.click(button);
    expect(useBimStore.getState().planTool).toBe('ceiling');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('resets to Select on Escape as the global default authoring mode', () => {
    seedTabs('3d');
    const { getByTestId } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('ribbon-command-wall'));
    expect(useBimStore.getState().planTool).toBe('wall');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useBimStore.getState().planTool).toBe('select');
  });

  it('leaves browser-native modifier shortcuts to the browser instead of model tools', async () => {
    seedTabs('3d');
    renderWithProviders(<Workspace />);
    useBimStore.getState().setPlanTool('select');

    for (const key of ['r', 'd', 'f']) {
      for (const modifier of ['metaKey', 'ctrlKey'] as const) {
        const event = new KeyboardEvent('keydown', {
          key,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
        expect(event.defaultPrevented, `${modifier}+${key}`).toBe(false);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(useBimStore.getState().planTool).toBe('select');
  });

  it('keeps active authoring commands pane-local in a split workspace — WP-NEXT-40', () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'plan:pv-a', kind: 'plan', label: 'Plan A', targetId: 'pv-a' },
          { id: '3d:vp-b', kind: '3d', label: '3D B', targetId: 'vp-b' },
        ],
        activeId: '3d:vp-b',
      }),
    );
    seedSplitPaneLayout('plan:pv-a', '3d:vp-b');
    useBimStore.setState({
      activeLevelId: 'lvl-a',
      elementsById: {
        'lvl-a': {
          kind: 'level',
          id: 'lvl-a',
          name: 'Level A',
          elevationMm: 0,
        } as Element,
        'pv-a': {
          kind: 'plan_view',
          id: 'pv-a',
          name: 'Plan A',
          levelId: 'lvl-a',
        } as Element,
        'vp-b': {
          kind: 'viewpoint',
          id: 'vp-b',
          name: '3D B',
          mode: 'orbit_3d',
        } as Element,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const leftRibbon = within(paneRibbon(rendered, 'pane-left'));
    const rightRibbon = within(paneRibbon(rendered, 'pane-right'));

    fireEvent.click(leftRibbon.getByTestId('ribbon-command-wall'));
    expect(leftRibbon.getByTestId('ribbon-command-wall').getAttribute('aria-pressed')).toBe('true');
    expect(rightRibbon.getByTestId('ribbon-command-select').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(rendered.getByTestId('stub-plan-canvas').getAttribute('data-active-plan-tool')).toBe(
      'wall',
    );
    expect(rendered.getByTestId('stub-viewport').getAttribute('data-active-plan-tool')).toBe(
      'select',
    );

    fireEvent.click(rightRibbon.getByTestId('ribbon-command-window'));
    expect(leftRibbon.getByTestId('ribbon-command-wall').getAttribute('aria-pressed')).toBe('true');
    expect(rightRibbon.getByTestId('ribbon-command-window').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(rendered.getByTestId('stub-plan-canvas').getAttribute('data-active-plan-tool')).toBe(
      'wall',
    );
    expect(rendered.getByTestId('stub-viewport').getAttribute('data-active-plan-tool')).toBe(
      'window',
    );
  });

  it('renders pane-local tab strips and supports primary-browser drop-assign + close from pane chrome', () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'plan:pv-a', kind: 'plan', label: 'Plan A', targetId: 'pv-a' },
          { id: '3d:vp-b', kind: '3d', label: '3D B', targetId: 'vp-b' },
        ],
        activeId: '3d:vp-b',
      }),
    );
    seedSplitPaneLayout('plan:pv-a', '3d:vp-b');
    useBimStore.setState({
      activeLevelId: 'lvl-a',
      elementsById: {
        'lvl-a': {
          kind: 'level',
          id: 'lvl-a',
          name: 'Level A',
          elevationMm: 0,
        } as Element,
        'pv-a': {
          kind: 'plan_view',
          id: 'pv-a',
          name: 'Plan A',
          levelId: 'lvl-a',
        } as Element,
        'vp-b': {
          kind: 'viewpoint',
          id: 'vp-b',
          name: '3D B',
          mode: 'orbit_3d',
        } as Element,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;
    expect(getByTestId('canvas-pane-tabstrip-pane-left').textContent).toContain('Plan A');
    expect(getByTestId('canvas-pane-tabstrip-pane-right').textContent).toContain('3D B');

    const dragData = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'copy',
      dropEffect: 'none',
      setData: (type: string, value: string) => dragData.set(type, value),
      getData: (type: string) => dragData.get(type) ?? '',
    };
    fireEvent.dragStart(getByTestId('left-rail-row-vp-b'), { dataTransfer });
    const leftStrip = getByTestId('canvas-pane-tabstrip-pane-left');
    fireEvent.dragOver(leftStrip, { dataTransfer });
    fireEvent.drop(leftStrip, { dataTransfer });
    expect(leftStrip.textContent).toContain('3D B');

    fireEvent.click(getByTestId('canvas-pane-close-tab-pane-left'));
    expect(getByTestId('canvas-pane-tabstrip-pane-left').textContent).toContain('Plan A');
  });

  it('creates an empty composition from the header plus', () => {
    seedTabs('plan');
    const { getByTestId, getByText } = renderWithProviders(<Workspace />);
    expect(getByTestId('composition-bar')).toBeTruthy();
    fireEvent.click(getByTestId('composition-add-button'));
    expect(getByText('No view open in this pane')).toBeTruthy();
    expect(getByTestId('composition-bar').textContent).toContain('Composition 2');
  });

  it('renames a composition tab inline on double click', () => {
    seedTabs('plan');
    const { getByTestId } = renderWithProviders(<Workspace />);
    const tab = getByTestId('composition-bar').querySelector<HTMLElement>(
      '[data-testid^="composition-tab-"]',
    );
    expect(tab).toBeTruthy();
    fireEvent.doubleClick(tab!);
    const compositionId = tab!.getAttribute('data-testid')!.replace('composition-tab-', '');
    const input = getByTestId(
      `composition-rename-input-${compositionId}`,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Coordination Review' } });
    fireEvent.blur(input);
    expect(getByTestId('composition-bar').textContent).toContain('Coordination Review');
  });

  it('opens a primary-browser view in the focused pane', () => {
    const level: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'lvl-a',
      name: 'Level A',
      elevationMm: 0,
    };
    const planView: Extract<Element, { kind: 'plan_view' }> = {
      kind: 'plan_view',
      id: 'pv-a',
      name: 'Plan A',
      levelId: level.id,
    };
    const viewpoint: Extract<Element, { kind: 'viewpoint' }> = {
      kind: 'viewpoint',
      id: 'vp-b',
      name: '3D B',
      mode: 'orbit_3d',
      camera: {
        position: { xMm: 0, yMm: -8000, zMm: 5000 },
        target: { xMm: 0, yMm: 0, zMm: 1500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
    };
    useBimStore.setState({
      activeLevelId: level.id,
      elementsById: {
        [level.id]: level,
        [planView.id]: planView,
        [viewpoint.id]: viewpoint,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;

    fireEvent.click(getByTestId(`left-rail-row-${viewpoint.id}`));

    expect(queryByTestId('stub-plan-canvas')).toBeNull();
    expect(getByTestId('stub-viewport')).toBeTruthy();
    expect(getByTestId('redesign-canvas-root').textContent).toContain('3D · 3D B');
    expect(useBimStore.getState().activeViewpointId).toBe(viewpoint.id);
  });

  it('splits a targeted pane recursively from a primary-browser drop', () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'plan:pv-a', kind: 'plan', label: 'Plan A', targetId: 'pv-a' },
          { id: '3d:vp-b', kind: '3d', label: '3D B', targetId: 'vp-b' },
        ],
        activeId: 'plan:pv-a',
      }),
    );
    seedSplitPaneLayout('plan:pv-a', '3d:vp-b');
    useBimStore.setState({
      activeLevelId: 'lvl-a',
      elementsById: {
        'lvl-a': {
          kind: 'level',
          id: 'lvl-a',
          name: 'Level A',
          elevationMm: 0,
        } as Element,
        'pv-a': {
          kind: 'plan_view',
          id: 'pv-a',
          name: 'Plan A',
          levelId: 'lvl-a',
        } as Element,
        'vp-b': {
          kind: 'viewpoint',
          id: 'vp-b',
          name: '3D B',
          mode: 'orbit_3d',
        } as Element,
      },
    });

    const { getByTestId, container } = renderWithProviders(<Workspace />);
    const dragData = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'copy',
      dropEffect: 'none',
      setData: (type: string, value: string) => dragData.set(type, value),
      getData: (type: string) => dragData.get(type) ?? '',
    };

    fireEvent.dragStart(getByTestId('left-rail-row-vp-b'), { dataTransfer });
    const splitTarget = getByTestId('canvas-pane-pane-left-split-dropzone-right');
    fireEvent.dragOver(splitTarget, { dataTransfer });
    fireEvent.drop(splitTarget, { dataTransfer });

    expect(container.querySelectorAll('[data-testid^="canvas-pane-tabstrip-"]').length).toBe(3);
  });

  it('keeps discipline lens per pane tab instance for the same floor plan', () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [
          {
            id: 'plan:pv-a',
            kind: 'plan',
            label: 'Plan A · Architecture',
            targetId: 'pv-a',
            lensMode: 'architecture',
          },
          {
            id: 'plan:pv-a#2',
            kind: 'plan',
            label: 'Plan A · Structure',
            targetId: 'pv-a',
            lensMode: 'structure',
          },
        ],
        activeId: 'plan:pv-a#2',
      }),
    );
    seedSplitPaneLayout('plan:pv-a', 'plan:pv-a#2');
    useBimStore.setState({
      activeLevelId: 'lvl-a',
      elementsById: {
        'lvl-a': {
          kind: 'level',
          id: 'lvl-a',
          name: 'Level A',
          elevationMm: 0,
        } as Element,
        'pv-a': {
          kind: 'plan_view',
          id: 'pv-a',
          name: 'Plan A',
          levelId: 'lvl-a',
        } as Element,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { container, getByTestId } = rendered;
    const canvases = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-testid="stub-plan-canvas"]'));

    expect(canvases().map((canvas) => canvas.dataset.lensMode)).toEqual([
      'architecture',
      'structure',
    ]);

    fireEvent.pointerDown(getByTestId('canvas-pane-pane-right'));
    const rightViewHeader = within(paneViewHeader(rendered, 'pane-right'));
    fireEvent.click(rightViewHeader.getByTestId('lens-dropdown-trigger'));
    fireEvent.click(rightViewHeader.getByTestId('lens-option-mep'));

    expect(canvases().map((canvas) => canvas.dataset.lensMode)).toEqual(['architecture', 'mep']);
  });

  it('renders a real empty pane state when no tabs are open', () => {
    localStorage.setItem(TABS_KEY, JSON.stringify({ v: 1, tabs: [], activeId: null }));
    const { getByText } = renderWithProviders(<Workspace />);
    expect(getByText('No view open in this pane')).toBeTruthy();
  });

  it('updates ribbon/secondary context when focus moves between split panes', () => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'plan:pv-a', kind: 'plan', label: 'Plan A', targetId: 'pv-a' },
          { id: 'sheet:sheet-b', kind: 'sheet', label: 'Sheet B', targetId: 'sheet-b' },
        ],
        activeId: 'sheet:sheet-b',
      }),
    );
    seedSplitPaneLayout('plan:pv-a', 'sheet:sheet-b');

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;
    const rightPane = within(paneSecondary(rendered, 'pane-right'));
    const leftPane = within(paneSecondary(rendered, 'pane-left'));
    const leftViewHeader = within(paneViewHeader(rendered, 'pane-left'));

    expect(rightPane.getByTestId('secondary-sidebar-sheet')).toBeTruthy();
    expect(paneViewHeader(rendered, 'pane-right').textContent).toContain('Sheet');
    expect(leftPane.getByTestId('secondary-sidebar-plan')).toBeTruthy();
    expect(paneViewHeader(rendered, 'pane-left').textContent).toContain('Plan');

    fireEvent.click(leftViewHeader.getByTestId('ribbon-mode-identity'));
    expect(queryByTestId('canvas-pane-secondary-sidebar-pane-left')).toBeNull();

    fireEvent.click(within(paneRibbon(rendered, 'pane-left')).getByTestId('ribbon-mode-identity'));
    expect(paneSecondary(rendered, 'pane-left')).toBeTruthy();
  });

  it('opens plan Visibility/Graphics from the secondary advanced owner — UX-DIA-004', () => {
    seedTabs('plan');
    const rendered = renderWithProviders(<Workspace />);
    const { getByRole } = rendered;
    const secondary = within(paneSecondary(rendered));

    fireEvent.click(secondary.getByTestId('secondary-plan-open-vv-dialog'));
    expect(getByRole('dialog', { name: 'Visibility/Graphics Overrides' })).toBeTruthy();
  });

  it('keeps undo/redo global controls in the footer and out of the header', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    const header = within(getByTestId('workspace-header'));
    const footer = within(getByTestId('status-bar'));

    expect(queryByTestId('topbar-undo')).toBeNull();
    expect(queryByTestId('topbar-redo')).toBeNull();
    expect(header.queryByRole('button', { name: /undo|rückgängig/i })).toBeNull();
    expect(header.queryByRole('button', { name: /redo|wiederholen/i })).toBeNull();
    expect(footer.getByRole('button', { name: /undo|rückgängig/i })).toBeTruthy();
    expect(footer.getByRole('button', { name: /redo|wiederholen/i })).toBeTruthy();
  });

  it('shows footer selection count when an element is selected — UX-FOO-006', () => {
    useBimStore.setState({ selectedId: 'wall-1' });
    const { getByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('status-bar-selection-count').textContent).toContain('1 selected');
  });

  it('owns temporary visibility override reset in pane secondary sidebar — UX-STAT-017', () => {
    seedTabs('plan');
    useBimStore.setState({
      temporaryVisibility: {
        viewId: '',
        mode: 'isolate',
        categories: ['wall'],
        elementIds: ['wall-1'],
      },
    });
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId } = rendered;
    expect(within(getByTestId('status-bar')).queryByTestId('temp-visibility-chip')).toBeNull();
    const chip = within(paneSecondary(rendered)).getByTestId('temp-visibility-chip');
    expect(chip.textContent).toContain('Isolate');
    expect(chip.textContent).toContain('#wall-1');
    fireEvent.click(chip);
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });

  it('keeps the primary sidebar navigation-only — UX-TEST-001', () => {
    const { getByTestId, getByRole, queryByTestId } = renderWithProviders(<Workspace />);
    const primary = within(getByTestId('app-shell-primary-sidebar'));

    expect(primary.getByTestId('primary-project-selector')).toBeTruthy();
    expect(primary.getByTestId('primary-create-floor-plan')).toBeTruthy();
    expect(primary.getByTestId('primary-create-3d-view')).toBeTruthy();
    expect(primary.getByTestId('primary-create-section')).toBeTruthy();
    expect(primary.getByTestId('primary-create-sheet')).toBeTruthy();
    expect(primary.getByTestId('primary-create-schedule')).toBeTruthy();
    expect(primary.getByLabelText('Search')).toBeTruthy();
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

  it('anchors the project menu to the primary sidebar selector — UX-DIA-002', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    const header = within(getByTestId('workspace-header'));
    const primary = within(getByTestId('app-shell-primary-sidebar'));

    expect(header.queryByTestId('project-menu')).toBeNull();
    expect(queryByTestId('project-menu')).toBeNull();

    fireEvent.click(primary.getByTestId('primary-project-selector'));

    expect(getByTestId('project-menu')).toBeTruthy();
  });

  it('opens the milestone dialog from the primary project menu owner', () => {
    useBimStore.setState({ modelId: 'model-milestone', revision: 7 });
    const { getByTestId, getByRole } = renderWithProviders(<Workspace />);
    const primary = within(getByTestId('app-shell-primary-sidebar'));

    fireEvent.click(primary.getByTestId('primary-project-selector'));
    fireEvent.click(getByTestId('project-menu-save-milestone'));

    expect(getByRole('dialog', { name: 'Save milestone' })).toBeTruthy();
  });

  it('opens material and appearance resource dialogs from the primary project menu owner', () => {
    const { getByTestId, getByRole } = renderWithProviders(<Workspace />);
    const primary = within(getByTestId('app-shell-primary-sidebar'));

    fireEvent.click(primary.getByTestId('primary-project-selector'));
    fireEvent.click(getByTestId('project-menu-open-material-browser'));
    expect(getByRole('dialog', { name: 'Material Browser' })).toBeTruthy();

    fireEvent.click(within(getByRole('dialog', { name: 'Material Browser' })).getByText('Close'));
    fireEvent.click(primary.getByTestId('primary-project-selector'));
    fireEvent.click(getByTestId('project-menu-open-appearance-asset-browser'));
    expect(getByRole('dialog', { name: 'Appearance Asset Browser' })).toBeTruthy();
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
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, getByRole } = rendered;
    const secondary = within(paneSecondary(rendered));
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(secondary.getByTestId('secondary-sidebar-3d')).toBeTruthy();
    expect(secondary.getByTestId('secondary-3d-sun')).toBeTruthy();
    expect(secondary.getByTestId('viewport3d-layers-panel')).toBeTruthy();
    expect(getByRole('button', { name: /Show material lighting and surface depth/i })).toBeTruthy();
  });

  it('keeps deep 3D scene/graphics/clipping ownership in the secondary sidebar', () => {
    seedTabs('3d');
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId, getByRole, getByLabelText } = rendered;
    const secondary = within(paneSecondary(rendered));

    expect(secondary.getByTestId('secondary-sidebar-3d')).toBeTruthy();
    expect(secondary.getByTestId('secondary-3d-sun')).toBeTruthy();
    expect(secondary.getByTestId('secondary-3d-graphics')).toBeTruthy();
    expect(secondary.getByTestId('viewport3d-layers-panel')).toBeTruthy();
    expect(secondary.getByTestId('clip-elev-input')).toBeTruthy();
    expect(secondary.getByTestId('clip-floor-input')).toBeTruthy();
    expect(getByRole('button', { name: /Disable Shadows|Enable Shadows/i })).toBeTruthy();
    expect(
      getByRole('button', { name: /Disable Ambient occlusion|Enable Ambient occlusion/i }),
    ).toBeTruthy();
    expect(getByRole('button', { name: /Disable Depth cue|Enable Depth cue/i })).toBeTruthy();
    expect(getByLabelText('Photographic exposure')).toBeTruthy();
    expect(getByLabelText('Silhouette edge width')).toBeTruthy();
    expect(getByTestId('layer-show-all')).toBeTruthy();
    expect(getByTestId('layer-hide-all')).toBeTruthy();
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(queryByTestId('orbit-viewpoint-persisted-hud')).toBeNull();
    expect(queryByTestId('viewport-walk-hints')).toBeNull();
  });

  it('keeps saved-view cutaway/overlay controls in secondary and exposes Measure in 3D ribbon — UX-3D-009/016/017/018/025', () => {
    seedTabs('3d');
    useBimStore.setState({
      activeViewpointId: 'vp-main',
      elementsById: {
        'pv-level-1': {
          kind: 'plan_view',
          id: 'pv-level-1',
          name: 'Level 1',
          levelId: 'lvl-1',
        },
        'vp-main': {
          kind: 'viewpoint',
          id: 'vp-main',
          name: 'Main saved view',
          mode: 'orbit_3d',
          camera: {
            position: { xMm: 0, yMm: 0, zMm: 5000 },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 0, zMm: 1 },
          },
          planOverlayEnabled: true,
          planOverlaySourcePlanViewId: 'pv-level-1',
          planOverlayOffsetMm: 4200,
          planOverlayAnnotationsVisible: true,
          hiddenSemanticKinds3d: [],
        },
      },
    });
    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId } = rendered;
    const secondary = within(paneSecondary(rendered));

    expect(secondary.getByTestId('secondary-3d-saved-view')).toBeTruthy();
    expect(secondary.getByTestId('orbit-viewpoint-persisted-hud')).toBeTruthy();

    fireEvent.click(secondary.getByText('Edit saved view'));
    expect(secondary.getByTestId('orbit-vp-cutaway-select')).toBeTruthy();
    expect(secondary.getByTestId('orbit-vp-plan-overlay-source')).toBeTruthy();
    expect(secondary.getByTestId('orbit-vp-plan-overlay-offset')).toBeTruthy();
    expect(secondary.getByTestId('orbit-vp-plan-overlay-annotations-toggle')).toBeTruthy();

    fireEvent.click(getByTestId('ribbon-tab-analyze'));
    expect(getByTestId('ribbon-command-3d-measure')).toBeTruthy();
  });

  it('exposes full 3D modeling ribbon actions with direct wall activation', () => {
    seedTabs('3d');
    const { getByTestId } = renderWithProviders(<Workspace />);

    fireEvent.click(getByTestId('ribbon-tab-create'));
    expect(getByTestId('ribbon-command-wall')).toBeTruthy();
    expect(getByTestId('ribbon-command-floor')).toBeTruthy();
    expect(getByTestId('ribbon-command-roof')).toBeTruthy();
    expect(getByTestId('ribbon-command-ceiling')).toBeTruthy();
    expect(getByTestId('ribbon-command-door')).toBeTruthy();
    expect(getByTestId('ribbon-command-window')).toBeTruthy();
    expect(getByTestId('ribbon-mode-identity').textContent).toContain('3D');

    fireEvent.click(getByTestId('ribbon-command-wall'));
    expect(getByTestId('ribbon-mode-identity').textContent).toContain('3D');
    expect(getByTestId('ribbon-command-wall').getAttribute('aria-pressed')).toBe('true');
  });

  it('uses explicit secondary sidebar adapters for every view type — UX-WP-04', () => {
    const cases: Array<[string, string]> = [
      ['plan', 'secondary-sidebar-plan'],
      ['3d', 'secondary-sidebar-3d'],
      ['section', 'secondary-sidebar-section'],
      ['sheet', 'secondary-sidebar-sheet'],
      ['schedule', 'secondary-sidebar-schedule'],
    ];

    for (const [kind, testId] of cases) {
      cleanup();
      localStorage.removeItem(COMPOSITIONS_KEY);
      seedTabs(kind, `tab-${kind}`);
      const rendered = renderWithProviders(<Workspace />);
      const secondary = within(paneSecondary(rendered));

      expect(secondary.getByTestId(testId)).toBeTruthy();
      expect(secondary.queryByTestId('right-rail-section-tabs')).toBeNull();
      expect(secondary.queryByTestId('right-rail-workbench')).toBeNull();
      expect(secondary.queryByTestId('right-rail-review')).toBeNull();

      rendered.unmount();
      localStorage.removeItem(TABS_KEY);
      localStorage.removeItem(COMPOSITIONS_KEY);
    }
  });

  it('groups secondary sidebar controls as view-wide state with advanced disclosure — UX-RISK-007', () => {
    for (const [kind, testId] of [
      ['plan', 'secondary-sidebar-plan'],
      ['3d', 'secondary-sidebar-3d'],
    ] as const) {
      cleanup();
      localStorage.removeItem(COMPOSITIONS_KEY);
      seedTabs(kind, `tab-${kind}`);
      const rendered = renderWithProviders(<Workspace />);
      const secondary = paneSecondary(rendered);
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
      localStorage.removeItem(COMPOSITIONS_KEY);
    }
  });

  it('keeps the element sidebar absent for an empty plan with no selection', () => {
    seedTabs('plan');
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);
    expect(queryByTestId('inspector')).toBeNull();
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(queryByTestId('app-shell-element-resize-handle')).toBeNull();
    expect(queryByTestId('canvas-pane-element-sidebar-pane-root')).toBeNull();
  });

  it('shows the element sidebar inside the focused pane when selection exists — UX-ELE-021', () => {
    seedTabs('plan');
    useBimStore.setState({
      selectedId: 'wall-1',
      elementsById: {
        'wall-1': {
          kind: 'wall',
          id: 'wall-1',
          name: 'Wall 1',
          wallTypeId: 'wt-1',
          levelId: 'lvl-1',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 3000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 3000,
          baseOffsetMm: 0,
          unconnectedHeightMm: 3000,
          roomBounding: true,
          structural: false,
        } as Extract<Element, { kind: 'wall' }>,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(queryByTestId('app-shell-element-resize-handle')).toBeNull();
    const sidebar = paneElementSidebar(rendered);
    expect(sidebar.className).toContain('absolute');
    expect(within(sidebar).getByTestId('inspector')).toBeTruthy();
  });

  it('keeps sheet review controls in the ribbon and out of canvas chrome — UX-CAN-023', () => {
    seedTabs('sheet');
    const { getByTestId, queryByTestId, getByLabelText } = renderWithProviders(<Workspace />);

    expect(queryByTestId('sheet-review-toolbar')).toBeNull();

    const reviewComment = getByTestId('ribbon-command-sheet-review-comment');
    const reviewMarkup = getByTestId('ribbon-command-sheet-review-markup');
    const shapeFreehand = getByTestId('ribbon-command-sheet-markup-freehand');
    const shapeText = getByTestId('ribbon-command-sheet-markup-text');

    expect(reviewComment.className).toContain('bg-accent');
    fireEvent.click(reviewMarkup);
    expect(reviewMarkup.className).toContain('bg-accent');
    expect(reviewComment.className).not.toContain('bg-accent');

    expect(shapeFreehand.className).toContain('bg-accent');
    fireEvent.click(shapeText);
    expect(shapeText.className).toContain('bg-accent');
    expect(shapeFreehand.className).not.toContain('bg-accent');

    fireEvent.click(getByTestId('ribbon-command-sheet-review-comment'));
    expect(getByTestId('ribbon-command-sheet-review-comment').className).toContain('bg-accent');
  });

  it('keeps schedule row and column operations in the schedule ribbon — UX-SCH-013/014', () => {
    seedTabs('schedule', 'schedule:sched-doors');
    useBimStore.setState({
      elementsById: {
        'sched-doors': {
          kind: 'schedule',
          id: 'sched-doors',
          name: 'Door schedule',
          filters: { category: 'door' },
        },
      },
    });

    const { getByTestId } = renderWithProviders(<Workspace />);
    expect(getByTestId('ribbon-command-schedule-row-ops')).toBeTruthy();
    expect(getByTestId('ribbon-command-schedule-column-ops')).toBeTruthy();
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

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, queryByTestId } = rendered;

    fireEvent.click(getByTestId(`left-rail-row-${planView.id}`));

    expect(useBimStore.getState().selectedId).toBeUndefined();
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(queryByTestId('inspector')).toBeNull();
    expect(within(paneSecondary(rendered)).getByTestId('secondary-sidebar-plan')).toBeTruthy();
  });

  it('reopens the element sidebar after a new element selection when it was manually collapsed — UX-ELE-020', () => {
    seedTabs('plan');
    const wallA: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-a',
      name: 'Wall A',
      wallTypeId: 'wt-1',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };
    const wallB: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-b',
      name: 'Wall B',
      wallTypeId: 'wt-1',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 1200 },
      end: { xMm: 4000, yMm: 1200 },
      thicknessMm: 200,
      heightMm: 3000,
    };

    useBimStore.setState({
      selectedId: wallA.id,
      selectedIds: [wallA.id],
      elementsById: {
        [wallA.id]: wallA,
        [wallB.id]: wallB,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { getByTestId, getByLabelText, queryByTestId } = rendered;
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(paneElementSidebar(rendered)).toBeTruthy();

    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'toggle element sidebar' },
    });
    fireEvent.click(getByTestId('palette-entry-shell.toggle-element-sidebar'));
    expect(queryByTestId('canvas-pane-element-sidebar-pane-root')).toBeNull();

    act(() => {
      useBimStore.setState({
        selectedId: wallB.id,
        selectedIds: [wallB.id],
      });
    });

    expect(paneElementSidebar(rendered)).toBeTruthy();
  });

  it('opens material and appearance dialogs from element-sidebar actions for selected model context', () => {
    seedTabs('plan');
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Generic - 200mm',
      basisLine: 'center',
      layers: [{ function: 'structure', materialKey: 'Concrete', thicknessMm: 200 }],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall 1',
      wallTypeId: wallType.id,
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };
    useBimStore.setState({
      selectedId: wall.id,
      selectedIds: [wall.id],
      elementsById: {
        [wall.id]: wall,
        [wallType.id]: wallType,
      },
    });

    const rendered = renderWithProviders(<Workspace />);
    const { getByRole } = rendered;
    const elementSidebar = within(paneElementSidebar(rendered));

    fireEvent.click(elementSidebar.getByTestId('inspector-open-material-browser'));
    expect(getByRole('dialog', { name: 'Material Browser' })).toBeTruthy();

    fireEvent.click(within(getByRole('dialog', { name: 'Material Browser' })).getByText('Close'));
    fireEvent.click(elementSidebar.getByTestId('inspector-open-appearance-asset-browser'));
    expect(getByRole('dialog', { name: 'Appearance Asset Browser' })).toBeTruthy();
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

  it('supports advisor grouping and ignore/restore workflow in the footer dialog — UX-DIA-019', () => {
    useBimStore.setState({
      violations: [
        {
          ruleId: 'physical_hard_clash',
          severity: 'error',
          message: 'Physical clash detected.',
          elementIds: ['wall-1'],
          blocking: true,
        },
        {
          ruleId: 'schedule_sheet_viewport_missing',
          severity: 'warning',
          message: 'Schedule viewport is missing.',
          elementIds: ['sheet-a101'],
        },
      ],
    });

    const { getByTestId, getByText, queryByText } = renderWithProviders(<Workspace />);

    fireEvent.click(getByTestId('status-bar-advisor-entry'));
    const advisorDialog = getByTestId('advisor-dialog');
    const dialog = within(advisorDialog);
    expect(dialog.getByText('Physical clash detected.')).toBeTruthy();
    expect(dialog.getByText('Schedule viewport is missing.')).toBeTruthy();
    fireEvent.change(dialog.getByTestId('advisor-group-by'), { target: { value: 'category' } });
    expect(dialog.getByTestId('advisor-group-physical').textContent).toContain('Physical');
    expect(dialog.getByTestId('advisor-group-schedule').textContent).toContain('Schedule');
    fireEvent.click(dialog.getAllByRole('button', { name: 'Ignore' })[0]!);
    expect(queryByText('Physical clash detected.')).toBeNull();
    expect(dialog.getByTestId('advisor-ignored-summary').textContent).toContain('Ignored 1');
    fireEvent.click(dialog.getByTestId('advisor-reset-ignored'));
    expect(getByText('Physical clash detected.')).toBeTruthy();
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

  it('opens jobs from the footer and keeps jobs out of sidebars — UX-STAT-019', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);

    expect(queryByTestId('right-rail-review')).toBeNull();
    fireEvent.click(getByTestId('status-bar-jobs-entry'));
    expect(getByTestId('jobs-dialog')).toBeTruthy();
  });

  it('opens footer jobs through Cmd+K reachability', () => {
    const { getByTestId, getByLabelText } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'open jobs' },
    });

    fireEvent.click(getByTestId('palette-entry-jobs.open'));
    expect(getByTestId('jobs-dialog')).toBeTruthy();
  });

  it('opens the milestone dialog through Cmd+K reachability', () => {
    useBimStore.setState({ modelId: 'model-milestone', revision: 7 });
    const { getByTestId, getByLabelText, getByRole } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'milestone dialog' },
    });

    fireEvent.click(getByTestId('palette-entry-milestone.open'));
    expect(getByRole('dialog', { name: 'Save milestone' })).toBeTruthy();
  });

  it('opens material and appearance dialogs through Cmd+K reachability', () => {
    const { getByTestId, getByLabelText, getByRole } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'material browser' },
    });

    fireEvent.click(getByTestId('palette-entry-library.open-material-browser'));
    expect(getByRole('dialog', { name: 'Material Browser' })).toBeTruthy();

    fireEvent.click(within(getByRole('dialog', { name: 'Material Browser' })).getByText('Close'));
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'appearance asset browser' },
    });
    fireEvent.click(getByTestId('palette-entry-library.open-appearance-asset-browser'));
    expect(getByRole('dialog', { name: 'Appearance Asset Browser' })).toBeTruthy();
  });

  it('routes import IFC/DXF commands to the primary project resources owner', () => {
    const { getByTestId, getByLabelText } = renderWithProviders(<Workspace />);
    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'import ifc link' },
    });
    fireEvent.click(getByTestId('palette-entry-project.import.ifc'));
    expect(getByTestId('project-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'import dxf underlay' },
    });
    fireEvent.click(getByTestId('palette-entry-project.import.dxf'));
    expect(getByTestId('project-menu')).toBeTruthy();
  });

  it('opens project settings through Cmd+K and primary sidebar reachability', () => {
    const { getByTestId, getByLabelText } = renderWithProviders(<Workspace />);

    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'project settings' },
    });
    fireEvent.click(getByTestId('palette-entry-project.open-settings'));
    expect(getByTestId('project-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });

    const primary = within(getByTestId('app-shell-primary-sidebar'));
    fireEvent.click(primary.getByTestId('primary-project-selector'));
    expect(getByTestId('project-menu')).toBeTruthy();
  });

  it('replays onboarding tour through Cmd+K help reachability', async () => {
    const { getByTestId, getByLabelText, queryByTestId, findByTestId } = renderWithProviders(
      <Workspace />,
    );
    expect(queryByTestId('onboarding-tour')).toBeNull();

    fireEvent.click(getByTestId('workspace-header-cmdk'));
    fireEvent.change(getByLabelText('Command palette search'), {
      target: { value: 'replay onboarding tour' },
    });

    fireEvent.click(getByTestId('palette-entry-help.replay-onboarding-tour'));
    expect(await findByTestId('onboarding-tour')).toBeTruthy();
  });

  it('owns activity stream entry in footer and opens the activity drawer from there', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<Workspace />);

    expect(queryByTestId('workspace-header-activity')).toBeNull();
    fireEvent.click(getByTestId('status-bar-activity-entry'));
    expect(getByTestId('activity-drawer')).toBeTruthy();
  });
});
