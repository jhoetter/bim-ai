import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { AppShell } from './AppShell';
import { useBimStore } from '../../state/store';

afterEach(() => {
  document.body.innerHTML = '';
  useBimStore.getState().setPlanTool('select');
});

describe('AppShell — spec §8', () => {
  it('renders all five named slots', () => {
    const { getByText } = render(
      <AppShell
        topBar={<span>top</span>}
        leftRail={<span>left</span>}
        canvas={<span>canvas</span>}
        rightRail={<span>right</span>}
        statusBar={<span>status</span>}
      />,
    );
    expect(getByText('top')).toBeTruthy();
    expect(getByText('left')).toBeTruthy();
    expect(getByText('canvas')).toBeTruthy();
    expect(getByText('right')).toBeTruthy();
    expect(getByText('status')).toBeTruthy();
  });

  it('uses CSS-grid template areas for layout', () => {
    const { getByTestId } = render(
      <AppShell
        topBar={<span>t</span>}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.style.display).toBe('grid');
    expect(shell.style.gridTemplateAreas).toContain('topbar');
    expect(shell.style.gridTemplateAreas).toContain('canvas');
    expect(shell.style.gridTemplateAreas).toContain('statusbar');
  });

  it('responds to `[` to toggle the left rail collapsed-state', () => {
    const { getByTestId } = render(
      <AppShell
        topBar={<span>t</span>}
        leftRail={<span>full-left</span>}
        leftRailCollapsed={<span>icon-left</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
        defaultLeftCollapsed
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.leftCollapsed).toBe('true');
    fireEvent.keyDown(document, { key: '[' });
    expect(shell.dataset.leftCollapsed).toBe('false');
    fireEvent.keyDown(document, { key: '[' });
    expect(shell.dataset.leftCollapsed).toBe('true');
  });

  it('responds to `]` to toggle the right rail collapsed-state', () => {
    const { getByTestId } = render(
      <AppShell
        topBar={<span>t</span>}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>full-right</span>}
        statusBar={<span>s</span>}
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.rightCollapsed).toBe('false');
    fireEvent.keyDown(document, { key: ']' });
    expect(shell.dataset.rightCollapsed).toBe('true');
    fireEvent.keyDown(document, { key: ']' });
    expect(shell.dataset.rightCollapsed).toBe('false');
  });

  it('does not toggle while user is typing in an input', () => {
    const { getByTestId } = render(
      <AppShell
        topBar={<input data-testid="probe-input" defaultValue="" />}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    const input = getByTestId('probe-input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: '[' });
    expect(shell.dataset.leftCollapsed).toBe('false');
    fireEvent.keyDown(input, { key: ']' });
    expect(shell.dataset.rightCollapsed).toBe('false');
  });

  it('honors defaultLeftCollapsed and defaultRightCollapsed', () => {
    const { getByTestId } = render(
      <AppShell
        topBar={<span>t</span>}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
        defaultLeftCollapsed
        defaultRightCollapsed
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.leftCollapsed).toBe('true');
    expect(shell.dataset.rightCollapsed).toBe('true');
  });

  it('renders the collapsed left rail node when collapsed', () => {
    const { getByText, queryByText } = render(
      <AppShell
        topBar={<span>t</span>}
        leftRail={<span>full-left</span>}
        leftRailCollapsed={<span>icon-left</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
        defaultLeftCollapsed
      />,
    );
    expect(queryByText('full-left')).toBeNull();
    expect(getByText('icon-left')).toBeTruthy();
  });

  it('shows plan tool option surfaces only in plan-capable modes', () => {
    useBimStore.getState().setPlanTool('wall');

    const { getByTestId, queryByTestId, rerender } = render(
      <AppShell
        activeMode="plan"
        topBar={<span>t</span>}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
      />,
    );

    expect(getByTestId('tool-modifier-bar')).toBeTruthy();
    expect(getByTestId('options-bar')).toBeTruthy();

    rerender(
      <AppShell
        activeMode="3d"
        topBar={<span>t</span>}
        leftRail={<span>l</span>}
        canvas={<span>c</span>}
        rightRail={<span>r</span>}
        statusBar={<span>s</span>}
      />,
    );

    expect(queryByTestId('tool-modifier-bar')).toBeNull();
    expect(queryByTestId('options-bar')).toBeNull();
  });
});
