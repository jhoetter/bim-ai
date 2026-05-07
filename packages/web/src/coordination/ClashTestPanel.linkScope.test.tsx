import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import i18n from '../i18n';
import { ClashTestPanel } from './ClashTestPanel';
import { SelectionSetPanel } from './SelectionSetPanel';

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

describe('FED-02 — SelectionSetPanel scope dropdown', () => {
  const linkElem: Extract<Element, { kind: 'link_model' }> = {
    kind: 'link_model',
    id: 'link-str',
    name: 'Structure',
    sourceModelId: '11111111-1111-1111-1111-111111111111',
    positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    rotationDeg: 0,
    originAlignmentMode: 'origin_to_origin',
  };

  it('shows host / all_links / per-link options', () => {
    const sset: Extract<Element, { kind: 'selection_set' }> = {
      kind: 'selection_set',
      id: 'sset-1',
      name: 'A',
      filterRules: [{ field: 'category', operator: 'equals', value: 'wall', linkScope: 'host' }],
    };
    const { getByLabelText } = renderWithI18n(
      <SelectionSetPanel el={sset} elements={{ [sset.id]: sset, [linkElem.id]: linkElem }} />,
    );
    const scope = getByLabelText('Scope') as HTMLSelectElement;
    const values = Array.from(scope.options).map((o) => o.value);
    expect(values).toEqual(['host', 'all_links', 'link-str']);
  });

  it('switching scope to all_links updates the rendered selection', () => {
    const sset: Extract<Element, { kind: 'selection_set' }> = {
      kind: 'selection_set',
      id: 'sset-1',
      name: 'A',
      filterRules: [{ field: 'category', operator: 'equals', value: 'wall', linkScope: 'host' }],
    };
    const { getByLabelText } = renderWithI18n(
      <SelectionSetPanel el={sset} elements={{ [sset.id]: sset, [linkElem.id]: linkElem }} />,
    );
    const scope = getByLabelText('Scope') as HTMLSelectElement;
    fireEvent.change(scope, { target: { value: 'all_links' } });
    expect(scope.value).toBe('all_links');
  });

  it('a rule already scoped to a specific link reflects that selection', () => {
    const sset: Extract<Element, { kind: 'selection_set' }> = {
      kind: 'selection_set',
      id: 'sset-2',
      name: 'B',
      filterRules: [
        {
          field: 'category',
          operator: 'equals',
          value: 'wall',
          linkScope: { specificLinkId: 'link-str' },
        },
      ],
    };
    const { getByLabelText } = renderWithI18n(
      <SelectionSetPanel el={sset} elements={{ [sset.id]: sset, [linkElem.id]: linkElem }} />,
    );
    const scope = getByLabelText('Scope') as HTMLSelectElement;
    expect(scope.value).toBe('link-str');
  });
});

describe('FED-02 — ClashTestPanel link-chain rendering', () => {
  const linkElem: Extract<Element, { kind: 'link_model' }> = {
    kind: 'link_model',
    id: 'link-str',
    name: 'Structure',
    sourceModelId: '11111111-1111-1111-1111-111111111111',
    positionMm: { xMm: 500, yMm: 0, zMm: 0 },
    rotationDeg: 0,
    originAlignmentMode: 'origin_to_origin',
  };

  it('shows linked element source id with "from <linkName>" prefix', () => {
    const ct: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct1',
      name: 'X',
      setAIds: ['a'],
      setBIds: ['b'],
      toleranceMm: 0,
      results: [
        {
          elementIdA: 'w-arch',
          elementIdB: 'link-str::beam-1',
          distanceMm: 0,
          linkChainA: [],
          linkChainB: ['link-str'],
        },
      ],
    };
    const { getByText } = renderWithI18n(
      <ClashTestPanel el={ct} elements={{ [linkElem.id]: linkElem }} />,
    );
    // Host element rendered as raw id; linked element gets "from <name> — <sourceId>".
    expect(getByText('w-arch')).toBeTruthy();
    expect(getByText(/from Structure — beam-1/)).toBeTruthy();
  });

  it('Run Clash Test button invokes onRun callback when provided', () => {
    const onRun = vi.fn();
    const ct: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct2',
      name: 'X',
      setAIds: [],
      setBIds: [],
      toleranceMm: 0,
    };
    const { getByRole } = renderWithI18n(<ClashTestPanel el={ct} onRun={onRun} />);
    fireEvent.click(getByRole('button', { name: 'Run Clash Test' }));
    expect(onRun).toHaveBeenCalledWith('ct2');
  });

  it('Fly to button invokes onFlyTo callback when provided', () => {
    const onFlyTo = vi.fn();
    const ct: Extract<Element, { kind: 'clash_test' }> = {
      kind: 'clash_test',
      id: 'ct3',
      name: 'X',
      setAIds: [],
      setBIds: [],
      toleranceMm: 0,
      results: [
        {
          elementIdA: 'a',
          elementIdB: 'link-str::b',
          distanceMm: 5,
          linkChainA: [],
          linkChainB: ['link-str'],
        },
      ],
    };
    const { getByRole } = renderWithI18n(<ClashTestPanel el={ct} onFlyTo={onFlyTo} />);
    fireEvent.click(getByRole('button', { name: 'Fly to' }));
    expect(onFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({ elementIdB: 'link-str::b', linkChainB: ['link-str'] }),
    );
  });
});
