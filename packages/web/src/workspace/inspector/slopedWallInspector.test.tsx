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
  id: 'wall-slope-1',
  name: 'Sloped Wall',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  levelId: 'lvl-1',
};

const wallWithSlope: Extract<Element, { kind: 'wall' }> = {
  ...wall,
  id: 'wall-slope-2',
  slopeAngleDeg: 10,
  topThicknessMm: 100,
};

describe('sloped wall inspector — §3.5.7', () => {
  it('renders inspector-wall-slope-angle input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    const input = getByTestId('inspector-wall-slope-angle') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
  });

  it('renders inspector-wall-top-thickness input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    const input = getByTestId('inspector-wall-top-thickness') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
  });

  it('slope-angle input shows existing value when wall has slopeAngleDeg set', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wallWithSlope, t, {}));
    const input = getByTestId('inspector-wall-slope-angle') as HTMLInputElement;
    expect(Number(input.value)).toBe(10);
  });

  it('changing slope angle dispatches update_element_property for slopeAngleDeg', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { onPropertyChange: onChange }));
    const input = getByTestId('inspector-wall-slope-angle') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith('slopeAngleDeg', expect.any(Number));
  });

  it('changing top thickness dispatches update_element_property for topThicknessMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { onPropertyChange: onChange }));
    const input = getByTestId('inspector-wall-top-thickness') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith('topThicknessMm', expect.any(Number));
  });
});
