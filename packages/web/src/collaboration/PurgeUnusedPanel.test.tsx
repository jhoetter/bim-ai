import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PurgeUnusedPanel } from './PurgeUnusedPanel';

afterEach(() => {
  cleanup();
});

describe('PurgeUnusedPanel', () => {
  it('renders idle state', () => {
    const { getByRole } = render(<PurgeUnusedPanel />);
    expect(getByRole('button', { name: 'Purge Unused…' })).toBeTruthy();
  });

  it('transitions to confirming', () => {
    const { getByRole } = render(<PurgeUnusedPanel />);
    fireEvent.click(getByRole('button', { name: 'Purge Unused…' }));
    expect(getByRole('button', { name: 'Confirm Purge' })).toBeTruthy();
    expect(getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('cancel returns to idle', () => {
    const { getByRole } = render(<PurgeUnusedPanel />);
    fireEvent.click(getByRole('button', { name: 'Purge Unused…' }));
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(getByRole('button', { name: 'Purge Unused…' })).toBeTruthy();
  });

  it('confirm purge calls console.warn and shows done state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByRole, getByText } = render(<PurgeUnusedPanel />);
    fireEvent.click(getByRole('button', { name: 'Purge Unused…' }));
    fireEvent.click(getByRole('button', { name: 'Confirm Purge' }));
    expect(warnSpy).toHaveBeenCalledWith('purge-unused stub');
    expect(getByText('Purge complete.')).toBeTruthy();
    warnSpy.mockRestore();
  });
});
