import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import i18n from '../i18n';
import { ClashTestPanel, clashDisciplinePair } from './ClashTestPanel';

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

  it('DSC-V3-04 filters clashes by discipline pair', () => {
    const elements: Record<string, Element> = {
      wallA: {
        kind: 'wall',
        id: 'wallA',
        name: 'Wall',
        levelId: 'L1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
        discipline: 'arch',
      } as Element,
      beamS: { kind: 'beam', id: 'beamS', name: 'Beam', discipline: 'struct' } as Element,
      ductM: {
        kind: 'duct',
        id: 'ductM',
        levelId: 'L1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 1, yMm: 0 },
        discipline: 'mep',
      } as Element,
    };
    const el: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct-disc',
      name: 'Discipline clashes',
      setAIds: [],
      setBIds: [],
      toleranceMm: 10,
      results: [
        { elementIdA: 'wallA', elementIdB: 'beamS', distanceMm: 0 },
        { elementIdA: 'beamS', elementIdB: 'ductM', distanceMm: 0 },
      ],
    };

    expect(clashDisciplinePair(el.results![0]!, elements)).toBe('arch-struct');
    const { getByTestId, queryByTestId } = renderWithI18n(
      <ClashTestPanel el={el} elements={elements} activeFilter="struct-mep" />,
    );
    expect(getByTestId('clash-filter-struct-mep').textContent).toContain('(1)');
    expect(getByTestId('clash-row-struct-mep')).toBeTruthy();
    expect(queryByTestId('clash-row-arch-struct')).toBeNull();
  });
});
