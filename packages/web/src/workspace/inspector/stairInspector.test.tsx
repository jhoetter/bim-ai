import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const stair: Extract<Element, { kind: 'stair' }> = {
  kind: 'stair',
  id: 'stair-1',
  name: 'Test Stair',
  baseLevelId: 'lvl-ground',
  topLevelId: 'lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1100,
  riserMm: 176,
  treadMm: 280,
};

describe('stair inspector — §8.6.4', () => {
  it('renders inspector-stair-riser-count input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-riser-count')).toBeTruthy();
  });

  it('renders inspector-stair-tread-depth input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-tread-depth')).toBeTruthy();
  });

  it('changing riser-count dispatches update_element_property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stair, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-riser-count') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('riserCount', 15);
  });

  it('changing tread-depth dispatches update_element_property', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stair, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-tread-depth') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('treadDepthMm', 300);
  });

  it('riser-count input has correct min/max constraints', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    const input = getByTestId('inspector-stair-riser-count') as HTMLInputElement;
    expect(input.min).toBe('2');
    expect(input.max).toBe('50');
  });

  it('tread-depth input has correct min/max constraints', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    const input = getByTestId('inspector-stair-tread-depth') as HTMLInputElement;
    expect(input.min).toBe('200');
    expect(input.max).toBe('450');
  });

  it('shows pre-existing riserCount value', () => {
    const stairWithCount: Extract<Element, { kind: 'stair' }> = {
      ...stair,
      id: 'stair-2',
      riserCount: 18,
    };
    const { getByTestId } = render(InspectorPropertiesFor(stairWithCount, t));
    const input = getByTestId('inspector-stair-riser-count') as HTMLInputElement;
    expect(Number(input.value)).toBe(18);
  });
});
