import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const radialDim: Extract<Element, { kind: 'radial_dimension' }> = {
  kind: 'radial_dimension',
  id: 'rd-1',
  hostViewId: 'pv-1',
  centerMm: { xMm: 0, yMm: 0 },
  arcPointMm: { xMm: 1500, yMm: 0 },
};

const diameterDim: Extract<Element, { kind: 'diameter_dimension' }> = {
  kind: 'diameter_dimension',
  id: 'dd-1',
  hostViewId: 'pv-1',
  centerMm: { xMm: 0, yMm: 0 },
  arcPointMm: { xMm: 1500, yMm: 0 },
};

describe('radial dimension inspector — §4.5', () => {
  it('renders inspector-radial-dim-value with radius in mm', () => {
    const { getByTestId } = render(InspectorPropertiesFor(radialDim, t));
    const el = getByTestId('inspector-radial-dim-value');
    expect(el.textContent).toBe('1500 mm');
  });

  it('renders inspector-diameter-dim-value with diameter (2×radius)', () => {
    const { getByTestId } = render(InspectorPropertiesFor(diameterDim, t));
    const el = getByTestId('inspector-diameter-dim-value');
    expect(el.textContent).toBe('3000 mm');
  });

  it('renders inspector-radial-dim-prefix input', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(radialDim, t, { onPropertyChange: vi.fn() }),
    );
    expect(getByTestId('inspector-radial-dim-prefix')).toBeTruthy();
  });

  it('flip dispatches update_element_property for flipped', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(radialDim, t, { onPropertyChange: onChange }),
    );
    fireEvent.click(getByTestId('inspector-radial-dim-flip'));
    expect(onChange).toHaveBeenCalledWith('flipped', true);
  });
});
