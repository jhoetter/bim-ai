import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const dim: Extract<Element, { kind: 'angular_dimension' }> = {
  kind: 'angular_dimension',
  id: 'ad-1',
  hostViewId: 'pv-1',
  vertexMm: { xMm: 0, yMm: 0 },
  rayAMm: { xMm: 1000, yMm: 0 },
  rayBMm: { xMm: 0, yMm: 1000 },
  offsetMm: { xMm: 0, yMm: 300 },
};

describe('angular dimension inspector — §4.4', () => {
  it('renders inspector-angular-dim-angle with computed degrees', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t));
    const el = getByTestId('inspector-angular-dim-angle');
    expect(el.textContent).toBe('90.0°');
  });

  it('renders inspector-angular-dim-offset readout', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t));
    const el = getByTestId('inspector-angular-dim-offset');
    expect(el.textContent).toBe('300 mm');
  });

  it('renders inspector-angular-dim-prefix input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t, { onPropertyChange: vi.fn() }));
    expect(getByTestId('inspector-angular-dim-prefix')).toBeTruthy();
  });

  it('renders inspector-angular-dim-override input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(dim, t, { onPropertyChange: vi.fn() }));
    expect(getByTestId('inspector-angular-dim-override')).toBeTruthy();
  });

  it('flip button dispatches update_element_property for offsetMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(dim, t, { onPropertyChange: onChange }));
    fireEvent.click(getByTestId('inspector-angular-dim-flip'));
    expect(onChange).toHaveBeenCalledWith('offsetMm', { xMm: 0, yMm: -300 });
  });
});
