import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useTheme } from './useTheme';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
});

function ThemeProbe() {
  const theme = useTheme();
  return <span data-testid="theme-readout">{theme}</span>;
}

describe('useTheme — spec §32 V11 fix', () => {
  it('returns the initial theme on mount', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { getByTestId } = render(<ThemeProbe />);
    expect(getByTestId('theme-readout').textContent).toBe('dark');
  });

  it('updates when data-theme attribute flips', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { getByTestId } = render(<ThemeProbe />);
    expect(getByTestId('theme-readout').textContent).toBe('light');
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(getByTestId('theme-readout').textContent).toBe('dark');
  });

  it('updates when the .dark class is toggled (legacy theming path)', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { getByTestId } = render(<ThemeProbe />);
    await act(async () => {
      document.documentElement.classList.add('dark');
      // Class change won't flip data-theme automatically, but the observer
      // re-reads getCurrentTheme which returns 'dark' if the class is set.
      // We need to also clear data-theme so getCurrentTheme returns dark.
      document.documentElement.removeAttribute('data-theme');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(getByTestId('theme-readout').textContent).toBe('dark');
  });
});
