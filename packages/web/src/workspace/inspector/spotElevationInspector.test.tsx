import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const spotEl: Extract<Element, { kind: 'spot_elevation' }> = {
  kind: 'spot_elevation',
  id: 'se-test',
  hostViewId: 'view-1',
  positionMm: { xMm: 0, yMm: 0 },
  elevationMm: 3500,
  prefix: 'EL:',
  suffix: ' m',
};

describe('spot elevation inspector — §4.7', () => {
  it('renders inspector-spot-elevation-mm input with current value', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: vi.fn() }),
    );
    const input = getByTestId('inspector-spot-elevation-mm') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
    expect(Number(input.value)).toBe(3500);
  });

  it('elevation input change dispatches update_element_property for elevationMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-spot-elevation-mm') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '4000' } });
    expect(onChange).toHaveBeenCalledWith('elevationMm', expect.any(Number));
  });

  it('renders inspector-spot-elevation-mode select', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: vi.fn() }),
    );
    const select = getByTestId('inspector-spot-elevation-mode') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('absolute');
    expect(values).toContain('relative-to-level');
  });

  it('renders inspector-spot-elevation-show3d checkbox', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: vi.fn() }),
    );
    const checkbox = getByTestId('inspector-spot-elevation-show3d') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(true);
  });

  it('renders inspector-spot-elevation-prefix input with current prefix', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: vi.fn() }),
    );
    const input = getByTestId('inspector-spot-elevation-prefix') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('EL:');
  });

  it('renders inspector-spot-elevation-suffix input with current suffix', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: vi.fn() }),
    );
    const input = getByTestId('inspector-spot-elevation-suffix') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe(' m');
  });

  it('prefix input blur dispatches for prefix property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-spot-elevation-prefix') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: 'Z:' } });
    expect(onChange).toHaveBeenCalledWith('prefix', expect.any(String));
  });

  it('show3d checkbox change dispatches for showIn3D property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(spotEl, t, { onPropertyChange: onChange }),
    );
    const checkbox = getByTestId('inspector-spot-elevation-show3d') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('showIn3D', expect.any(Boolean));
  });
});
