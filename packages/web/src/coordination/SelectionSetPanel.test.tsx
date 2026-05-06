import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import i18n from '../i18n';
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

const baseEl: Extract<Element, { kind: 'selection_set' }> = {
  kind: 'selection_set',
  id: 'ss1',
  name: 'Test Set',
  filterRules: [],
};

describe('SelectionSetPanel', () => {
  it('renders with no rules', () => {
    const { getByRole, getByText } = renderWithI18n(
      <SelectionSetPanel el={baseEl} elements={{}} />,
    );
    expect(getByRole('button', { name: 'Add rule' })).toBeTruthy();
    expect(getByText(/Matched elements:\s*0/)).toBeTruthy();
  });

  it('add rule appends a rule row', () => {
    const { getByRole, getAllByLabelText } = renderWithI18n(
      <SelectionSetPanel el={baseEl} elements={{}} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add rule' }));
    expect(getAllByLabelText('Field').length).toBe(1);
  });

  it('remove rule splices it from state', () => {
    const { getByRole, getAllByLabelText, queryByLabelText } = renderWithI18n(
      <SelectionSetPanel el={baseEl} elements={{}} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add rule' }));
    expect(getAllByLabelText('Field').length).toBe(1);
    fireEvent.click(getByRole('button', { name: 'remove-rule' }));
    expect(queryByLabelText('Field')).toBeNull();
  });

  it('category filter equals matches elements by kind', () => {
    const wall: Element = {
      kind: 'wall',
      id: 'w1',
      name: 'Wall 1',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
    const elements: Record<string, Element> = { w1: wall };
    const elWithRule: Extract<Element, { kind: 'selection_set' }> = {
      kind: 'selection_set',
      id: 'ss2',
      name: 'Walls',
      filterRules: [{ field: 'category', operator: 'equals', value: 'wall' }],
    };
    const { getByText } = renderWithI18n(<SelectionSetPanel el={elWithRule} elements={elements} />);
    expect(getByText(/Matched elements:\s*1/)).toBeTruthy();
  });
});
