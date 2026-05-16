import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-override-1',
  name: 'Test Wall',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  levelId: 'lvl-1',
};

describe('graphics override inspector — §2.1.4', () => {
  it('renders inspector-override-fill-color for wall', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    const input = getByTestId('inspector-override-fill-color') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('color');
  });

  it('renders inspector-override-surface-color for wall', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    const input = getByTestId('inspector-override-surface-color') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('color');
  });

  it('color change dispatches update_element_property for graphicsOverride', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { onPropertyChange: onChange }));
    const input = getByTestId('inspector-override-fill-color') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith(
      'graphicsOverride',
      expect.objectContaining({ fillColorHex: '#ff0000' }),
    );
  });
});
