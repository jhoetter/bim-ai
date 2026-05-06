import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ToolPalette } from './ToolPalette';
import { paletteForMode } from './toolRegistry';
import i18n from '../i18n';

const tIdentity = (key: string) => key;

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    ),
  });
}

afterEach(() => {
  cleanup();
});

const ENABLED_CTX = { hasAnyWall: true, hasAnyFloor: true, hasAnySelection: false };

describe('paletteForMode — spec §16.1', () => {
  it('plan mode includes Wall/Door/Window/Floor/Roof/Stair/Room/Dimension/Section/Tag/Select', () => {
    const ids = paletteForMode('plan', tIdentity as never).map((t) => t.id);
    for (const required of [
      'select',
      'wall',
      'door',
      'window',
      'floor',
      'roof',
      'stair',
      'room',
      'dimension',
      'section',
      'tag',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('schedule mode only includes select', () => {
    const ids = paletteForMode('schedule', tIdentity as never).map((t) => t.id);
    expect(ids).toEqual(['select']);
  });
});

describe('<ToolPalette /> — spec §16', () => {
  it('renders all plan-mode tools as toolbar buttons', () => {
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={() => undefined}
        disabledContext={ENABLED_CTX}
      />,
    );
    expect(getByLabelText('Wall (W)')).toBeTruthy();
    expect(getByLabelText('Door (D)')).toBeTruthy();
    expect(getByLabelText('Section (Shift+S)')).toBeTruthy();
  });

  it('marks the active tool with aria-pressed and tabIndex 0', () => {
    const { getByLabelText, getAllByRole } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="wall"
        onToolSelect={() => undefined}
        disabledContext={ENABLED_CTX}
      />,
    );
    const wall = getByLabelText('Wall (W)') as HTMLButtonElement;
    expect(wall.getAttribute('aria-pressed')).toBe('true');
    expect(wall.tabIndex).toBe(0);
    const inactive = getAllByRole('button').filter(
      (b) => b !== wall && !(b as HTMLButtonElement).disabled,
    );
    inactive.forEach((b) => {
      expect((b as HTMLButtonElement).tabIndex).toBe(-1);
    });
  });

  it('emits onToolSelect when a tool is clicked', () => {
    const onSelect = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={onSelect}
        disabledContext={ENABLED_CTX}
      />,
    );
    fireEvent.click(getByLabelText('Door (D)'));
    expect(onSelect).toHaveBeenCalledWith('door');
  });

  it('cycles tools with ArrowRight / ArrowLeft', () => {
    const onSelect = vi.fn();
    const { getByRole } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={onSelect}
        disabledContext={ENABLED_CTX}
      />,
    );
    fireEvent.keyDown(getByRole('toolbar'), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('wall');
    fireEvent.keyDown(getByRole('toolbar'), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith('shaft'); // wraps backwards from select
  });

  it('disables Floor when no walls exist and surfaces the reason', () => {
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={() => undefined}
        disabledContext={{ hasAnyWall: false, hasAnyFloor: false, hasAnySelection: false }}
      />,
    );
    const floor = getByLabelText('Floor (F)') as HTMLButtonElement;
    expect(floor.disabled).toBe(true);
    expect(floor.title).toMatch(/wall first/);
  });

  it('Tag button dispatches onTagSubmenu instead of onToolSelect', () => {
    const onSelect = vi.fn();
    const onTag = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={onSelect}
        onTagSubmenu={onTag}
        disabledContext={ENABLED_CTX}
      />,
    );
    fireEvent.click(getByLabelText('Tag (T)'));
    expect(onTag).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
