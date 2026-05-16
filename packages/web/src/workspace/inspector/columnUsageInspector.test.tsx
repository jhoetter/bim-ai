import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const col: Extract<Element, { kind: 'column' }> = {
  kind: 'column',
  id: 'col-1',
  name: 'C1',
  levelId: 'lvl-0',
  positionMm: { xMm: 0, yMm: 0 },
  bMm: 300,
  hMm: 300,
  heightMm: 3000,
};

describe('column usage inspector — §9.1.1', () => {
  it('renders inspector-column-usage select defaulting to architectural', () => {
    const { getByTestId } = render(InspectorPropertiesFor(col, t));
    const select = getByTestId('inspector-column-usage') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('architectural');
  });

  it('structural option dispatches onPropertyChange for columnUsage', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(col, t, { onPropertyChange: onChange }));
    const select = getByTestId('inspector-column-usage') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'structural' } });
    expect(onChange).toHaveBeenCalledWith('columnUsage', 'structural');
  });

  it('shows structural when columnUsage is structural', () => {
    const structuralCol: Extract<Element, { kind: 'column' }> = {
      ...col,
      columnUsage: 'structural',
    };
    const { getByTestId } = render(InspectorPropertiesFor(structuralCol, t));
    const select = getByTestId('inspector-column-usage') as HTMLSelectElement;
    expect(select.value).toBe('structural');
  });
});
