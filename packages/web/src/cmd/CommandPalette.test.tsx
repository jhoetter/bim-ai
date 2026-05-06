import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { CommandPalette } from './CommandPalette';
import type { CommandCandidate } from './commandPaletteSources';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
}

beforeAll(() => {
  // jsdom lacks ResizeObserver and scrollIntoView — cmdk uses both on mount.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe(): void {
        return;
      }
      unobserve(): void {
        return;
      }
      disconnect(): void {
        return;
      }
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = StubResizeObserver;
  }
  if (
    typeof Element !== 'undefined' &&
    !(Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  ) {
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = function noop(): void {
      return;
    };
  }
});

afterEach(() => {
  cleanup();
});

const candidates: CommandCandidate[] = [
  { id: 'tool.wall', kind: 'tool', label: 'Wall', hint: 'W' },
  { id: 'view.plan-eg', kind: 'view', label: 'Plan: Ground' },
  { id: 'el.wall.1', kind: 'element', label: 'wall: hf-w-so' },
];

describe('<CommandPalette /> — spec §18', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = renderWithI18n(
      <CommandPalette
        open={false}
        onOpenChange={() => undefined}
        candidates={candidates}
        onPick={() => undefined}
      />,
    );
    expect(queryByTestId('command-palette')).toBeNull();
  });

  it('opens with the empty-state hints when no query', () => {
    const { getByText } = renderWithI18n(
      <CommandPalette
        open={true}
        onOpenChange={() => undefined}
        candidates={candidates}
        onPick={() => undefined}
      />,
    );
    // Empty state hint label
    expect(getByText('Open command palette')).toBeTruthy();
  });

  it('filters via the prefix grammar', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithI18n(
      <CommandPalette
        open={true}
        onOpenChange={() => undefined}
        candidates={candidates}
        onPick={() => undefined}
      />,
    );
    const input = getByPlaceholderText(/Type a command/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '>wall' } });
    expect(getByText('Wall')).toBeTruthy();
    expect(queryByText('Plan: Ground')).toBeNull();
  });

  it('emits onPick on item select', () => {
    const onPick = vi.fn();
    const { getByText } = renderWithI18n(
      <CommandPalette
        open={true}
        onOpenChange={() => undefined}
        candidates={candidates}
        onPick={onPick}
      />,
    );
    const input =
      (document.querySelector('input[placeholder*="Type a command"]') as HTMLInputElement) ??
      undefined;
    if (input) fireEvent.change(input, { target: { value: 'wall' } });
    fireEvent.click(getByText('Wall'));
    expect(onPick).toHaveBeenCalled();
    expect(onPick.mock.calls[0]![0].id).toBe('tool.wall');
  });

  it('Close button dispatches onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <CommandPalette
        open={true}
        onOpenChange={onOpenChange}
        candidates={candidates}
        onPick={() => undefined}
      />,
    );
    fireEvent.click(getByLabelText('Close command palette'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
