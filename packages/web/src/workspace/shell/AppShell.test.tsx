import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { AppShell } from './AppShell';
import { useBimStore } from '../../state/store';

afterEach(() => {
  document.body.innerHTML = '';
  useBimStore.getState().setPlanTool('select');
});

describe('AppShell — spec §8', () => {
  it('renders the canonical seven workspace regions', () => {
    const { getByText } = render(
      <AppShell
        header={<span>header</span>}
        ribbon={<span>ribbon</span>}
        primarySidebar={<span>primary</span>}
        secondarySidebar={<span>secondary</span>}
        canvas={<span>canvas</span>}
        elementSidebar={<span>element</span>}
        footer={<span>footer</span>}
      />,
    );
    expect(getByText('header')).toBeTruthy();
    expect(getByText('ribbon')).toBeTruthy();
    expect(getByText('primary')).toBeTruthy();
    expect(getByText('secondary')).toBeTruthy();
    expect(getByText('canvas')).toBeTruthy();
    expect(getByText('element')).toBeTruthy();
    expect(getByText('footer')).toBeTruthy();
  });

  it('uses CSS-grid template areas for layout', () => {
    const { getByTestId } = render(
      <AppShell
        header={<span>t</span>}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.style.display).toBe('grid');
    expect(shell.style.gridTemplateAreas).toContain('header');
    expect(shell.style.gridTemplateAreas).toContain('primarySidebar');
    expect(shell.style.gridTemplateAreas).toContain('secondarySidebar');
    expect(shell.style.gridTemplateAreas).toContain('canvas');
    expect(shell.style.gridTemplateAreas).toContain('elementSidebar');
    expect(shell.style.gridTemplateAreas).toContain('footer');
  });

  it('responds to `[` to hide and restore the primary sidebar', () => {
    const { getByTestId } = render(
      <AppShell
        header={<span>t</span>}
        primarySidebar={<span>full-left</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
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
        header={<span>t</span>}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>full-right</span>}
        footer={<span>s</span>}
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
        header={<input data-testid="probe-input" defaultValue="" />}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
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
        header={<span>t</span>}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
        defaultLeftCollapsed
        defaultRightCollapsed
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.leftCollapsed).toBe('true');
    expect(shell.dataset.rightCollapsed).toBe('true');
  });

  it('restores a hidden primary sidebar from the header reveal button', () => {
    const { getByTestId, queryByTestId } = render(
      <AppShell
        header={<span>t</span>}
        primarySidebar={<span>full-left</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
        defaultLeftCollapsed
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.primaryHidden).toBe('true');
    expect(getByTestId('app-shell-primary-sidebar').hidden).toBe(true);
    fireEvent.click(getByTestId('app-shell-primary-reveal'));
    expect(shell.dataset.primaryHidden).toBe('false');
    expect(queryByTestId('app-shell-primary-reveal')).toBeNull();
    expect(getByTestId('app-shell-primary-sidebar').hidden).toBe(false);
  });

  it('allows the primary sidebar to resize to zero using the resize handle', () => {
    const { getByTestId } = render(
      <AppShell
        header={<span>t</span>}
        primarySidebar={<span>full-left</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
      />,
    );
    const shell = getByTestId('app-shell') as HTMLElement;
    expect(shell.dataset.primaryHidden).toBe('false');
    fireEvent.keyDown(getByTestId('app-shell-primary-resize-handle'), { key: 'End' });
    expect(shell.dataset.primaryHidden).toBe('true');
    fireEvent.click(getByTestId('app-shell-primary-reveal'));
    expect(shell.dataset.primaryHidden).toBe('false');
  });

  it('keeps the secondary sidebar mounted while the element sidebar can be absent', () => {
    const { getByTestId, queryByText } = render(
      <AppShell
        header={<span>t</span>}
        primarySidebar={<span>primary</span>}
        secondarySidebar={<span>view-wide settings</span>}
        canvas={<span>canvas</span>}
        elementSidebar={null}
        footer={<span>footer</span>}
      />,
    );
    expect(getByTestId('app-shell-secondary-sidebar').hidden).toBe(false);
    expect(getByTestId('app-shell-element-sidebar').hidden).toBe(true);
    expect(getByTestId('app-shell').dataset.elementSidebarPresent).toBe('false');
    expect(queryByText('view-wide settings')).toBeTruthy();
  });

  it('shows plan tool option surfaces only in plan-capable modes', () => {
    useBimStore.getState().setPlanTool('wall');

    const { getByTestId, queryByTestId, queryByRole, rerender } = render(
      <AppShell
        activeMode="plan"
        header={<span>t</span>}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
      />,
    );

    expect(getByTestId('tool-modifier-bar')).toBeTruthy();
    expect(getByTestId('options-bar')).toBeTruthy();
    expect(queryByTestId('options-bar-discipline-scope')).toBeNull();
    expect(queryByRole('combobox', { name: /discipline workspace/i })).toBeNull();

    rerender(
      <AppShell
        activeMode="3d"
        header={<span>t</span>}
        primarySidebar={<span>l</span>}
        secondarySidebar={<span>sec</span>}
        canvas={<span>c</span>}
        elementSidebar={<span>r</span>}
        footer={<span>s</span>}
      />,
    );

    expect(queryByTestId('tool-modifier-bar')).toBeNull();
    expect(queryByTestId('options-bar')).toBeNull();
  });
});
