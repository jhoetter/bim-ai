import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { RedesignedCommandPalette } from './RedesignedCommandPalette';
import type { CommandCandidate } from './commandPaletteSources';

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

describe('<RedesignedCommandPalette /> — spec §18', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <RedesignedCommandPalette
        open={false}
        onOpenChange={() => undefined}
        candidates={candidates}
        onPick={() => undefined}
      />,
    );
    expect(queryByTestId('command-palette')).toBeNull();
  });

  it('opens with the empty-state hints when no query', () => {
    const { getByText } = render(
      <RedesignedCommandPalette
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
    const { getByPlaceholderText, getByText, queryByText } = render(
      <RedesignedCommandPalette
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
    const { getByText } = render(
      <RedesignedCommandPalette
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
    const { getByLabelText } = render(
      <RedesignedCommandPalette
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
