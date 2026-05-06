import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import i18n from '../i18n';
import { ClashTestPanel } from './ClashTestPanel';

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

describe('ClashTestPanel', () => {
  it('renders set counts', () => {
    const el: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct1',
      name: 'Clash 1',
      setAIds: ['a', 'b'],
      setBIds: [],
      toleranceMm: 50,
    };
    const { getByText } = renderWithI18n(<ClashTestPanel el={el} />);
    expect(getByText('2')).toBeTruthy();
  });

  it('Run Clash Test button calls console.warn stub', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct2',
      name: 'Clash 2',
      setAIds: ['a'],
      setBIds: ['b'],
      toleranceMm: 25,
    };
    const { getByRole } = renderWithI18n(<ClashTestPanel el={el} />);
    fireEvent.click(getByRole('button', { name: 'Run Clash Test' }));
    expect(warnSpy).toHaveBeenCalledWith(
      'run-clash-test stub',
      expect.objectContaining({ setAIds: ['a'], setBIds: ['b'], toleranceMm: 25 }),
    );
    warnSpy.mockRestore();
  });

  it('Fly to button calls console.warn with fly-to-clash', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct3',
      name: 'Clash 3',
      setAIds: [],
      setBIds: [],
      toleranceMm: 10,
      results: [{ elementIdA: 'e1', elementIdB: 'e2', distanceMm: 10 }],
    };
    const { getByRole } = renderWithI18n(<ClashTestPanel el={el} />);
    fireEvent.click(getByRole('button', { name: 'Fly to' }));
    expect(warnSpy).toHaveBeenCalledWith(
      'fly-to-clash',
      expect.objectContaining({ elementIdA: 'e1', elementIdB: 'e2', distanceMm: 10 }),
    );
    warnSpy.mockRestore();
  });
});
