/**
 * FAM-10 — Recent Clipboard tray hydration + preview modal.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { RecentClipboardTray } from './RecentClipboardTray';
import { writeClipboard, clearClipboard } from './clipboardStore';
import { CLIPBOARD_FORMAT, type ClipboardPayload } from './payload';

const sample: ClipboardPayload = {
  format: CLIPBOARD_FORMAT,
  sourceProjectId: 'proj-A',
  sourceModelId: 'model-1',
  elements: [{ id: 'el-1', kind: 'door' } as never],
  familyDefinitions: [],
  timestamp: '2026-05-07T00:00:00.000Z',
};

beforeEach(() => {
  clearClipboard();
});

afterEach(() => {
  cleanup();
  clearClipboard();
});

describe('FAM-10 RecentClipboardTray', () => {
  it('renders nothing when clipboard is empty', () => {
    const { queryByTestId } = render(<RecentClipboardTray />);
    expect(queryByTestId('recent-clipboard-tray')).toBeNull();
  });

  it('hydrates from existing localStorage payload on mount', () => {
    writeClipboard(sample);
    const { getByTestId } = render(<RecentClipboardTray />);
    expect(getByTestId('recent-clipboard-tray')).toBeTruthy();
  });

  it('listens for the bim-ai:clipboard-copy window event', () => {
    const { queryByTestId, getByTestId } = render(<RecentClipboardTray />);
    expect(queryByTestId('recent-clipboard-tray')).toBeNull();
    act(() => {
      window.dispatchEvent(new CustomEvent('bim-ai:clipboard-copy', { detail: sample }));
    });
    expect(getByTestId('recent-clipboard-tray')).toBeTruthy();
  });

  it('opens a preview dialog with a Paste-this button', () => {
    writeClipboard(sample);
    const { getByLabelText, getByText } = render(<RecentClipboardTray />);
    fireEvent.click(getByLabelText('Recent clipboard'));
    expect(getByText('Paste this')).toBeTruthy();
    expect(getByText('proj-A')).toBeTruthy();
  });
});
