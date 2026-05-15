import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ToolPalette } from './ToolPalette';
import { getToolRegistry, paletteForMode } from './toolRegistry';
import { ShortcutChip } from '../ui/ShortcutChip';
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

  it('plan mode includes mirror (FAM-07)', () => {
    const ids = paletteForMode('plan', tIdentity as never).map((t) => t.id);
    expect(ids).toContain('mirror');
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
    expect(onSelect).toHaveBeenLastCalledWith('query');
    fireEvent.keyDown(getByRole('toolbar'), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith('ceiling'); // wraps backwards from select
  });

  it('keeps Floor enabled without walls because sketch mode owns boundary creation', () => {
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={() => undefined}
        disabledContext={{ hasAnyWall: false, hasAnyFloor: false, hasAnySelection: false }}
      />,
    );
    const floor = getByLabelText('Floor (F)') as HTMLButtonElement;
    expect(floor.disabled).toBe(false);
    expect(floor.title).not.toMatch(/wall first/);
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

describe('ShortcutChip — EDT-V3-04', () => {
  afterEach(() => cleanup());

  it('renders with the provided label', () => {
    const { container } = render(<ShortcutChip label="WI" />);
    expect(container.textContent).toBe('WI');
  });

  it('is aria-hidden so screen readers skip it', () => {
    const { container } = render(<ShortcutChip label="W" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Tool shortcut field — EDT-V3-04', () => {
  const registry = getToolRegistry(tIdentity as never);

  it('wall has shortcut W', () => {
    expect(registry.wall.shortcut).toBe('W');
  });

  it('door has shortcut D', () => {
    expect(registry.door.shortcut).toBe('D');
  });

  it('window has shortcut WI', () => {
    expect(registry.window.shortcut).toBe('WI');
  });

  it('dimension has shortcut DI', () => {
    expect(registry.dimension.shortcut).toBe('DI');
  });

  it('column has shortcut C', () => {
    expect(registry.column.shortcut).toBe('C');
  });
});

describe('ToolPalette tooltip format — EDT-V3-04', () => {
  afterEach(() => cleanup());

  it('Wall button title reads "Wall (W)"', () => {
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={() => undefined}
        disabledContext={ENABLED_CTX}
      />,
    );
    const wall = getByLabelText('Wall (W)') as HTMLButtonElement;
    expect(wall.title).toBe('Wall (W)');
  });

  it('Window button title reads "Window (WI)"', () => {
    const { getByLabelText } = renderWithI18n(
      <ToolPalette
        mode="plan"
        activeTool="select"
        onToolSelect={() => undefined}
        disabledContext={ENABLED_CTX}
      />,
    );
    const win = getByLabelText('Window (Shift+W)') as HTMLButtonElement;
    expect(win.title).toBe('Window (WI)');
  });
});
