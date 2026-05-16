import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const dim: Extract<Element, { kind: 'permanent_dimension' }> = {
  kind: 'permanent_dimension',
  id: 'pd-1',
  levelId: 'lvl-1',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 2000, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: 500 },
};

describe('permanent dimension inspector — §4.2.5', () => {
  it('renders inspector-dim-flip button', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t, { onPropertyChange: vi.fn() }));
    expect(getByTestId('inspector-dim-flip')).toBeTruthy();
  });

  it('flip button dispatches update_element_property for flipped', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(dim, t, { onPropertyChange: onChange }));
    fireEvent.click(getByTestId('inspector-dim-flip'));
    expect(onChange).toHaveBeenCalledWith('flipped', true);
  });

  it('renders inspector-dim-offset readout', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t));
    const el = getByTestId('inspector-dim-offset');
    expect(el.textContent).toBe('500 mm from chain');
  });
});
