import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { DEFAULT_SNAP_SETTINGS } from './snapSettings';
import { SnapSettingsToolbar } from './SnapSettingsToolbar';

afterEach(() => {
  cleanup();
});

describe('EDT-05 — SnapSettingsToolbar', () => {
  it('opens the dropdown on button click', () => {
    const onChange = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <SnapSettingsToolbar value={DEFAULT_SNAP_SETTINGS} onChange={onChange} />,
    );
    expect(queryByTestId('snap-toggle-endpoint')).toBeNull();
    fireEvent.click(getByTestId('snap-settings-button'));
    expect(getByTestId('snap-toggle-endpoint')).toBeTruthy();
  });

  it('toggles a snap kind via checkbox', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <SnapSettingsToolbar value={DEFAULT_SNAP_SETTINGS} onChange={onChange} />,
    );
    fireEvent.click(getByTestId('snap-settings-button'));
    const row = getByTestId('snap-toggle-perpendicular');
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toMatchObject({ perpendicular: false });
  });

  it('reset button restores defaults', () => {
    const value = { ...DEFAULT_SNAP_SETTINGS, intersection: false };
    const onChange = vi.fn();
    const { getByTestId } = render(<SnapSettingsToolbar value={value} onChange={onChange} />);
    fireEvent.click(getByTestId('snap-settings-button'));
    fireEvent.click(getByTestId('snap-toggle-reset'));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SNAP_SETTINGS);
  });

  it('summarises enabled count in the button label', () => {
    const value = {
      ...DEFAULT_SNAP_SETTINGS,
      perpendicular: false,
      extension: false,
    };
    const { getByTestId } = render(<SnapSettingsToolbar value={value} onChange={vi.fn()} />);
    expect(getByTestId('snap-settings-button').textContent).toContain('4/6');
  });
});
