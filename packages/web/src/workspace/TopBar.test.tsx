import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TopBar, WORKSPACE_MODES } from './TopBar';

afterEach(() => {
  cleanup();
});

const baseProps = {
  projectName: 'Seed house V2',
  theme: 'light' as const,
};

describe('TopBar — spec §11', () => {
  it('renders all 7 mode pills with hotkey hints', () => {
    const { getAllByRole } = render(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} />,
    );
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(WORKSPACE_MODES.length);
    expect(tabs.map((t) => t.textContent)).toEqual(
      WORKSPACE_MODES.map((m) => `${m.label}${m.hotkey}`),
    );
  });

  it('marks the active pill with aria-selected and tabIndex 0', () => {
    const { getAllByRole } = render(
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
    const { getAllByRole } = render(
      <TopBar {...baseProps} mode="plan" onModeChange={onModeChange} />,
    );
    const sectionPill = getAllByRole('tab').find((t) => t.textContent?.startsWith('Section'));
    fireEvent.click(sectionPill!);
    expect(onModeChange).toHaveBeenCalledWith('section');
  });

  it('cycles modes with ArrowRight / ArrowLeft', () => {
    const onModeChange = vi.fn();
    const { getByRole } = render(<TopBar {...baseProps} mode="plan" onModeChange={onModeChange} />);
    const tablist = getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onModeChange).toHaveBeenLastCalledWith('3d');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onModeChange).toHaveBeenLastCalledWith('agent'); // wraps backwards from plan
  });

  it('renders Sun when theme=dark and Moon when theme=light', () => {
    const { rerender, getByTestId } = render(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onThemeToggle={() => undefined}
        theme="light"
      />,
    );
    const btn = getByTestId('topbar-theme-toggle');
    expect(btn.getAttribute('data-current-theme')).toBe('light');
    expect(btn.getAttribute('aria-label')).toBe('Dark theme');
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
    expect(btn.getAttribute('aria-label')).toBe('Light theme');
  });

  it('shows the project name and emits onProjectNameClick on click', () => {
    const onProjectNameClick = vi.fn();
    const { getByText } = render(
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

  it('renders the collaborator badge when count > 0', () => {
    const { getByTestId } = render(
      <TopBar {...baseProps} mode="plan" onModeChange={() => undefined} collaboratorsCount={3} />,
    );
    expect(getByTestId('topbar-badge').textContent).toBe('3');
  });

  it('emits onCommandPalette when ⌘K button is clicked', () => {
    const onCommandPalette = vi.fn();
    const { getByText } = render(
      <TopBar
        {...baseProps}
        mode="plan"
        onModeChange={() => undefined}
        onCommandPalette={onCommandPalette}
      />,
    );
    fireEvent.click(getByText('⌘K').parentElement!);
    expect(onCommandPalette).toHaveBeenCalled();
  });
});
