/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { TopBar, WORKSPACE_MODES } from './TopBar';
import { RibbonBar, ribbonCommandReachabilityForMode } from './RibbonBar';
import { TopBarV3 } from '../chrome/TopBar';
import type { ViewTab } from '../tabsModel';
import i18n from '../../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const baseProps = {
  projectName: 'Seed house V2',
  theme: 'light' as const,
};

const viewTabs: ViewTab[] = [
  { id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'Plan · Level 0' },
  { id: '3d:vp1', kind: '3d', targetId: 'vp1', label: '3D · Default' },
];

describe('TopBar — spec §11', () => {
  it('renders all mode pills with hotkey hints', () => {
    const { getAllByRole } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} />,
    );
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(WORKSPACE_MODES.length);
    expect(tabs.map((t) => t.textContent)).toEqual(
      WORKSPACE_MODES.map((m) => `${m.label}${m.hotkey}`),
    );
  });

  it('marks the active pill with aria-selected and tabIndex 0', () => {
    const { getAllByRole } = renderWithI18n(
      <TopBar {...baseProps} mode="3d" onModeChange={() => undefined} />,
    );
    const tabs = getAllByRole('tab');
    const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(active?.textContent).toContain('3D');
    const inactive = tabs.filter((t) => t.getAttribute('aria-selected') !== 'true');
    inactive.forEach((t) => expect(t.tabIndex).toBe(-1));
    expect(active?.tabIndex).toBe(0);
  });

  it('invokes onModeChange when a pill is clicked', () => {
    const onModeChange = vi.fn();
    const { getAllByRole } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={onModeChange} />,
    );
    const sectionPill = getAllByRole('tab').find((t) => t.textContent?.startsWith('Section'));
    fireEvent.click(sectionPill!);
    expect(onModeChange).toHaveBeenCalledWith('section');
  });

  it('cycles modes with ArrowRight / ArrowLeft', () => {
    const onModeChange = vi.fn();
    const { getByRole } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={onModeChange} />,
    );
    const tablist = getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onModeChange).toHaveBeenLastCalledWith('3d');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onModeChange).toHaveBeenLastCalledWith('concept'); // wraps backwards from plan
  });

  it('renders theme toggle in avatar dropdown (light → dark label, dark → light label)', () => {
    const { rerender, getByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onThemeToggle={() => undefined}
        theme="light"
      />,
    );
    // Open the avatar menu to reveal the theme toggle
    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    const btn = getByTestId('topbar-theme-toggle');
    expect(btn.getAttribute('data-current-theme')).toBe('light');
    expect(btn.textContent).toContain('Dark theme');
    rerender(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onThemeToggle={() => undefined}
        theme="dark"
      />,
    );
    expect(btn.getAttribute('data-current-theme')).toBe('dark');
    expect(btn.textContent).toContain('Light theme');
  });

  it('shows the project name and emits onProjectNameClick on click', () => {
    const onProjectNameClick = vi.fn();
    const { getByText } = renderWithI18n(
      <TopBar
        {...baseProps}
        projectName="My project"
        mode="plan"
        onModeChange={() => undefined}
        onProjectNameClick={onProjectNameClick}
      />,
    );
    fireEvent.click(getByText('My project'));
    expect(onProjectNameClick).toHaveBeenCalled();
  });

  it('exposes QAT shortcuts for measure, dimension, Tag by Category, and Close Inactive', () => {
    const onMeasureShortcut = vi.fn();
    const onDimensionShortcut = vi.fn();
    const onTagByCategoryShortcut = vi.fn();
    const onCloseInactiveTabs = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onMeasureShortcut={onMeasureShortcut}
        onDimensionShortcut={onDimensionShortcut}
        onTagByCategoryShortcut={onTagByCategoryShortcut}
        onCloseInactiveTabs={onCloseInactiveTabs}
      />,
    );
    fireEvent.click(getByTestId('topbar-measure-shortcut'));
    fireEvent.click(getByTestId('topbar-dimension-shortcut'));
    fireEvent.click(getByTestId('topbar-tag-by-category-shortcut'));
    fireEvent.click(getByTestId('topbar-close-inactive'));
    expect(onMeasureShortcut).toHaveBeenCalledTimes(1);
    expect(onDimensionShortcut).toHaveBeenCalledTimes(1);
    expect(onTagByCategoryShortcut).toHaveBeenCalledTimes(1);
    expect(onCloseInactiveTabs).toHaveBeenCalledTimes(1);
  });

  it('labels QAT plan-tool shortcuts as bridge actions outside plan-capable modes', () => {
    const { getByTestId } = renderWithI18n(
      <TopBar {...baseProps} mode="3d" onModeChange={() => undefined} />,
    );

    const dimension = getByTestId('topbar-dimension-shortcut');
    const measure = getByTestId('topbar-measure-shortcut');
    expect(dimension.getAttribute('data-command-behavior')).toBe('bridge');
    expect(dimension.getAttribute('title')).toContain('Plan');
    expect(dimension.getAttribute('aria-label')).toContain('switches to Plan');
    expect(measure.getAttribute('data-command-behavior')).toBe('bridge');
  });

  it('labels QAT section-compatible shortcuts as direct in section mode', () => {
    const { getByTestId } = renderWithI18n(
      <TopBar {...baseProps} mode="section" onModeChange={() => undefined} />,
    );

    expect(getByTestId('topbar-dimension-shortcut').getAttribute('data-command-behavior')).toBe(
      'direct',
    );
    expect(getByTestId('topbar-section-shortcut').getAttribute('data-command-behavior')).toBe(
      'direct',
    );
    expect(getByTestId('topbar-measure-shortcut').getAttribute('data-command-behavior')).toBe(
      'bridge',
    );
  });

  it('customizes visible QAT entries and persists the preference', () => {
    const { getByTestId, queryByTestId, rerender } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} />,
    );
    expect(queryByTestId('topbar-measure-shortcut')).not.toBeNull();
    fireEvent.click(getByTestId('topbar-qat-customize'));
    fireEvent.click(getByTestId('topbar-qat-toggle-measure'));
    expect(queryByTestId('topbar-measure-shortcut')).toBeNull();

    rerender(<TopBar {...baseProps} mode="plan" onModeChange={() => undefined} />);
    expect(queryByTestId('topbar-measure-shortcut')).toBeNull();
  });

  it('renders the collaborator badge when count > 0', () => {
    const { getByTestId } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} collaboratorsCount={3} />,
    );
    expect(getByTestId('topbar-badge').textContent).toBe('3');
  });

  it('emits onCommandPalette when ⌘K button is clicked', () => {
    const onCommandPalette = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onCommandPalette={onCommandPalette}
      />,
    );
    fireEvent.click(getByTestId('topbar-cmdpalette'));
    expect(onCommandPalette).toHaveBeenCalled();
  });

  it('activates view tabs from the whole tab surface and keyboard', () => {
    const onTabActivate = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        tabs={viewTabs}
        activeTabId="plan:l0"
        onTabActivate={onTabActivate}
      />,
    );
    const tab = getByTestId('tab-activate-3d:vp1').closest('[role="tab"]') as HTMLElement;
    fireEvent.click(tab);
    fireEvent.keyDown(tab, { key: 'Enter' });
    fireEvent.keyDown(tab, { key: ' ' });
    expect(onTabActivate).toHaveBeenCalledTimes(3);
    expect(onTabActivate).toHaveBeenLastCalledWith('3d:vp1');
  });

  it('renders peer avatar chips from the peers prop', () => {
    const peers = [{ name: 'Alice', color: '#f00' }, { name: 'Bob' }];
    const { getByTestId } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} peers={peers} />,
    );
    const container = getByTestId('peer-avatars');
    expect(container.children).toHaveLength(2);
    expect(container.children[0]!.textContent).toBe('AL');
    expect(container.children[1]!.textContent).toBe('BO');
  });

  it('does not render peer-avatars div when peers list is empty', () => {
    const { queryByTestId } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} peers={[]} />,
    );
    expect(queryByTestId('peer-avatars')).toBeNull();
  });

  it('renders avatarInitials in the account tile', () => {
    const { getByLabelText } = renderWithI18n(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} avatarInitials="JH" />,
    );
    expect(getByLabelText('Account').textContent).toBe('JH');
  });

  it('opens a local account, license, about, and status panel from the avatar menu', () => {
    const { getByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        avatarInitials="JH"
        accountStatus={{
          displayName: 'Jane Hoetter',
          userId: 'user-123',
          modelId: 'model-456',
          revision: 17,
          wsConnected: true,
          online: false,
          pendingEdits: 2,
          appMode: 'test',
          planLabel: 'Local authoring',
          licenseLabel: 'No Autodesk license required',
        }}
      />,
    );

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));

    expect(getByTestId('account-status-display-name').textContent).toBe('Jane Hoetter');
    expect(getByTestId('account-status-plan').textContent).toBe('Local authoring');
    expect(getByTestId('account-status-license').textContent).toBe('No Autodesk license required');
    expect(getByTestId('account-status-model').textContent).toBe('model-456');
    expect(getByTestId('account-status-revision').textContent).toBe('r17');
    expect(getByTestId('account-status-network').textContent).toBe('Offline');
    expect(getByTestId('account-status-realtime').textContent).toBe('Connected');
    expect(getByTestId('account-status-pending').textContent).toBe('2');
    expect(getByTestId('account-status-environment').textContent).toBe('test');
    expect(getByTestId('account-status-details').textContent).toContain('Account details');
    expect(getByTestId('account-status-manage-license').textContent).toContain('Manage license');
    expect(getByTestId('account-status-privacy').textContent).toContain('Privacy settings');
    expect(getByTestId('account-status-sign-out').textContent).toContain('Sign out');
  });

  it('routes account panel actions to account, license, privacy, sign-out, help, and command handlers', () => {
    const onSettings = vi.fn();
    const onCommandPalette = vi.fn();
    const onAccountDetails = vi.fn();
    const onManageLicense = vi.fn();
    const onPrivacySettings = vi.fn();
    const onSignOut = vi.fn();
    const { getByTestId, queryByTestId } = renderWithI18n(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onSettings={onSettings}
        onCommandPalette={onCommandPalette}
        onAccountDetails={onAccountDetails}
        onManageLicense={onManageLicense}
        onPrivacySettings={onPrivacySettings}
        onSignOut={onSignOut}
      />,
    );

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-details'));
    expect(onAccountDetails).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-manage-license'));
    expect(onManageLicense).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-privacy'));
    expect(onPrivacySettings).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-settings'));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-command-palette'));
    expect(onCommandPalette).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();

    fireEvent.click(getByTestId('topbar-avatar-menu-trigger'));
    fireEvent.click(getByTestId('account-status-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(queryByTestId('topbar-avatar-menu')).toBeNull();
  });
});

describe('RibbonBar — F-005', () => {
  it('renders the plan ribbon schema by default', () => {
    const { getByTestId, getByRole } = render(<RibbonBar activeToolId="wall" />);
    expect(getByTestId('ribbon-bar')).toBeTruthy();
    expect(getByRole('tab', { name: 'Create' }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: 'Sketch' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Insert' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Annotate' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Review' })).toBeTruthy();
    expect(() => getByRole('tab', { name: 'Architecture' })).toThrow();
    expect(() => getByRole('tab', { name: 'Structure' })).toThrow();
    expect(() => getByRole('tab', { name: 'Massing & Site' })).toThrow();
    expect(() => getByRole('tab', { name: 'Analyze' })).toThrow();
    expect(() => getByRole('tab', { name: 'Steel' })).toThrow();
    expect(() => getByRole('tab', { name: 'Precast' })).toThrow();
    expect(() => getByRole('tab', { name: 'Systems' })).toThrow();
    expect(() => getByRole('tab', { name: 'Add-Ins' })).toThrow();
    expect(getByTestId('ribbon-command-wall').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('ribbon-command-door')).toBeTruthy();
  });

  it('switches tabs and dispatches tool commands', () => {
    const onToolSelect = vi.fn();
    const { getByTestId } = render(<RibbonBar onToolSelect={onToolSelect} />);
    fireEvent.click(getByTestId('ribbon-tab-annotate'));
    fireEvent.click(getByTestId('ribbon-command-dimension'));
    expect(onToolSelect).toHaveBeenCalledWith('dimension');
  });

  it('switches to direct sheet actions in sheet mode', () => {
    const onPlaceRecommended = vi.fn();
    const onOpenViewports = vi.fn();
    const { getByTestId } = render(
      <RibbonBar
        activeMode="sheet"
        onPlaceRecommendedViewsOnActiveSheet={onPlaceRecommended}
        onOpenSheetViewportEditor={onOpenViewports}
      />,
    );

    fireEvent.click(getByTestId('ribbon-tab-view'));
    expect(getByTestId('ribbon-command-sheet-place-recommended')).toBeTruthy();
    expect(() => getByTestId('ribbon-command-wall')).toThrow();
    fireEvent.click(getByTestId('ribbon-command-sheet-place-recommended'));
    fireEvent.click(getByTestId('ribbon-command-sheet-edit-viewports'));
    expect(onPlaceRecommended).toHaveBeenCalledTimes(1);
    expect(onOpenViewports).toHaveBeenCalledTimes(1);
  });

  it('uses a 3D ribbon schema with no disabled plan buttons', () => {
    const onToolSelect = vi.fn();
    const onSaveCurrentViewpoint = vi.fn();
    const { getByTestId, getByRole, queryByTestId } = render(
      <RibbonBar
        activeMode="3d"
        onToolSelect={onToolSelect}
        onSaveCurrentViewpoint={onSaveCurrentViewpoint}
      />,
    );

    expect(getByRole('tab', { name: '3D View' }).getAttribute('aria-selected')).toBe('true');
    expect(queryByTestId('ribbon-command-wall')).toBeNull();
    expect(queryByTestId('ribbon-command-visibility-graphics')).toBeNull();
    expect((getByTestId('ribbon-command-select') as HTMLButtonElement).disabled).toBe(false);
    expect((getByTestId('ribbon-command-3d-save-view') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(getByTestId('ribbon-command-select'));
    fireEvent.click(getByTestId('ribbon-command-3d-save-view'));
    expect(onToolSelect).toHaveBeenCalledWith('select');
    expect(onSaveCurrentViewpoint).toHaveBeenCalledTimes(1);
  });

  it('opens added catalogue tabs and minimizes ribbon panels', () => {
    const onOpenFamilyLibrary = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <RibbonBar onOpenFamilyLibrary={onOpenFamilyLibrary} />,
    );
    fireEvent.click(getByTestId('ribbon-tab-insert'));
    fireEvent.click(getByTestId('ribbon-command-family-library'));
    expect(onOpenFamilyLibrary).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId('ribbon-toggle-minimize'));
    expect(queryByTestId('ribbon-panels')).toBeNull();
    expect(getByTestId('ribbon-toggle-minimize').getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(getByTestId('ribbon-tab-review'));
    expect(getByTestId('ribbon-panels')).toBeTruthy();
  });

  it('uses a schedule ribbon schema with direct table actions', () => {
    const onOpenCommandPalette = vi.fn();
    const onOpenScheduleControls = vi.fn();
    const onDuplicateActiveSchedule = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <RibbonBar
        activeMode="schedule"
        onOpenCommandPalette={onOpenCommandPalette}
        onOpenScheduleControls={onOpenScheduleControls}
        onDuplicateActiveSchedule={onDuplicateActiveSchedule}
      />,
    );

    fireEvent.click(getByTestId('ribbon-tab-view'));
    expect(queryByTestId('ribbon-command-door')).toBeNull();
    fireEvent.click(getByTestId('ribbon-command-schedule-controls'));
    fireEvent.click(getByTestId('ribbon-command-schedule-duplicate'));
    expect(onOpenScheduleControls).toHaveBeenCalledTimes(1);
    expect(onDuplicateActiveSchedule).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).not.toHaveBeenCalled();
  });

  it('customizes visible ribbon commands and persists the preference', () => {
    const first = render(<RibbonBar />);
    fireEvent.click(first.getByTestId('ribbon-toggle-customize'));
    fireEvent.click(first.getByLabelText('Door'));
    expect(first.queryByTestId('ribbon-command-door')).toBeNull();
    first.unmount();

    const second = render(<RibbonBar />);
    expect(second.queryByTestId('ribbon-command-door')).toBeNull();
    fireEvent.click(second.getByTestId('ribbon-toggle-customize'));
    fireEvent.click(second.getByLabelText('Door'));
    expect(second.getByTestId('ribbon-command-door')).toBeTruthy();
  });

  it('adds a contextual Modify tab when an element is selected', () => {
    const { getByTestId } = render(<RibbonBar selectedElementKind="wall" />);
    const tab = getByTestId('ribbon-tab-modify');
    expect(tab.textContent).toBe('Modify | Wall');
    expect(tab.getAttribute('data-contextual')).toBe('true');
  });

  it('does not expose disabled ribbon commands in any active view schema — UX-WP-06', () => {
    for (const mode of [
      'plan',
      '3d',
      'plan-3d',
      'section',
      'sheet',
      'schedule',
      'agent',
      'concept',
    ] as const) {
      expect(
        ribbonCommandReachabilityForMode(mode, 'wall').filter((row) => row.behavior === 'disabled'),
      ).toEqual([]);
    }
  });
});

describe('TopBar v3 — CHR-V3-01', () => {
  const baseV3Props = {
    projectName: 'Seed house V3',
    currentProjectId: 'proj-001',
    activeWorkspaceId: 'arch' as const,
    userPreferredWorkspace: 'arch' as const,
    theme: 'light' as const,
  };

  it('renders with data-testid="topbar-v3" and applies the height token', () => {
    const { getByTestId } = render(<TopBarV3 {...baseV3Props} />);
    const bar = getByTestId('topbar-v3');
    expect(bar).toBeTruthy();
    expect(bar.style.height).toBe('var(--shell-topbar-height)');
    expect(bar.style.minHeight).toBe('var(--shell-topbar-height)');
  });

  it('renders 4 presence avatars for a 4-user presence list', () => {
    const presence = [
      { userId: 'u1', name: 'Alice' },
      { userId: 'u2', name: 'Bob' },
      { userId: 'u3', name: 'Carol' },
      { userId: 'u4', name: 'Dan' },
    ];
    const { getByTestId } = render(<TopBarV3 {...baseV3Props} presence={presence} />);
    const container = getByTestId('topbar-v3-presence');
    expect(container.children).toHaveLength(4);
  });

  it('renders 4 avatars and "+4" overflow chip for 8-user presence list', () => {
    const presence = Array.from({ length: 8 }, (_, i) => ({ userId: `u${i}`, name: `User ${i}` }));
    const { getByTestId } = render(<TopBarV3 {...baseV3Props} presence={presence} />);
    const container = getByTestId('topbar-v3-presence');
    // 4 avatars + 1 overflow chip
    expect(container.children).toHaveLength(5);
    expect(container.children[4]!.textContent).toBe('+4');
  });

  it('omits data-testid="topbar-v3-presence" from DOM when presence is empty', () => {
    const { queryByTestId } = render(<TopBarV3 {...baseV3Props} presence={[]} />);
    expect(queryByTestId('topbar-v3-presence')).toBeNull();
  });

  it('omits data-testid="topbar-v3-presence" from DOM when presence is undefined', () => {
    const { queryByTestId } = render(<TopBarV3 {...baseV3Props} />);
    expect(queryByTestId('topbar-v3-presence')).toBeNull();
  });

  it('fires onCommandPalette when the Cmd+K button is clicked', () => {
    const onCommandPalette = vi.fn();
    const { getByTestId } = render(
      <TopBarV3 {...baseV3Props} onCommandPalette={onCommandPalette} />,
    );
    fireEvent.click(getByTestId('topbar-v3-cmdpalette'));
    expect(onCommandPalette).toHaveBeenCalledOnce();
  });

  it('fires onActivityStream when the activity button is clicked', () => {
    const onActivityStream = vi.fn();
    const { getByTestId } = render(
      <TopBarV3 {...baseV3Props} onActivityStream={onActivityStream} />,
    );
    fireEvent.click(getByTestId('topbar-v3-activity'));
    expect(onActivityStream).toHaveBeenCalledOnce();
  });

  it('fires onActivityStream on Cmd+H keydown on document', () => {
    const onActivityStream = vi.fn();
    render(<TopBarV3 {...baseV3Props} onActivityStream={onActivityStream} />);
    fireEvent.keyDown(document, { key: 'h', metaKey: true });
    expect(onActivityStream).toHaveBeenCalledOnce();
  });

  it('project name button has a title attribute matching projectName', () => {
    const { getByTestId } = render(
      <TopBarV3 {...baseV3Props} projectName="A very long project name that should truncate" />,
    );
    const btn = getByTestId('topbar-v3-project-name');
    expect(btn.getAttribute('title')).toBe('A very long project name that should truncate');
    const span = btn.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.style.maxWidth).toBe('180px');
  });

  it('workspace chip carries data-disc matching activeWorkspaceId', () => {
    const { getByTestId } = render(<TopBarV3 {...baseV3Props} activeWorkspaceId="arch" />);
    expect(getByTestId('workspace-switcher-chip').getAttribute('data-disc')).toBe('arch');
  });

  it('workspace chip data-disc updates for struct and mep', () => {
    const { getByTestId, rerender } = render(
      <TopBarV3 {...baseV3Props} activeWorkspaceId="struct" userPreferredWorkspace="struct" />,
    );
    expect(getByTestId('workspace-switcher-chip').getAttribute('data-disc')).toBe('struct');
    rerender(<TopBarV3 {...baseV3Props} activeWorkspaceId="mep" userPreferredWorkspace="mep" />);
    expect(getByTestId('workspace-switcher-chip').getAttribute('data-disc')).toBe('mep');
  });

  it('has no bare hex literals in inline style attributes', () => {
    const presence = [{ userId: 'u1', name: 'Alice' }];
    const { getByTestId } = render(<TopBarV3 {...baseV3Props} presence={presence} />);
    const bar = getByTestId('topbar-v3');
    const allStyles = bar.querySelectorAll('[style]');
    const hexPattern = /#[0-9a-fA-F]{3,8}(?![^(]*\))/;
    allStyles.forEach((el) => {
      const styleAttr = el.getAttribute('style') ?? '';
      expect(hexPattern.test(styleAttr)).toBe(false);
    });
    expect(hexPattern.test(bar.getAttribute('style') ?? '')).toBe(false);
  });
});
