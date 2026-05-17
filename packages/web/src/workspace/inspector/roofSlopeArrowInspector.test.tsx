import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Ground Floor',
  elevationMm: 0,
};

function makeRoof(
  overrides: Partial<Extract<Element, { kind: 'roof' }>> = {},
): Extract<Element, { kind: 'roof' }> {
  return {
    kind: 'roof',
    id: 'roof-1',
    name: 'Test Roof',
    referenceLevelId: 'lvl-1',
    footprintMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 8000, yMm: 0 },
      { xMm: 8000, yMm: 6000 },
      { xMm: 0, yMm: 6000 },
    ],
    ...overrides,
  };
}

const elementsById: Record<string, Element> = {
  [level.id]: level,
};

describe('roof slope arrow inspector — §10.1.3', () => {
  it('renders use-slope-arrow checkbox', () => {
    const onChange = vi.fn();
    const roof = makeRoof();
    const { getByTestId } = render(
      InspectorPropertiesFor(roof, t, { onPropertyChange: onChange, elementsById }),
    );
    const label = getByTestId('inspector-roof-use-slope-arrow');
    expect(label).toBeTruthy();
    const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);
  });

  it('shows slope pct input when useSlopeArrow is true', () => {
    const onChange = vi.fn();
    const roof = makeRoof({
      useSlopeArrow: true,
      slopeArrow: {
        tailMm: { xMm: 0, yMm: 3000 },
        headMm: { xMm: 4000, yMm: 3000 },
        slopeRatio: 0.25,
      },
    });
    const { getByTestId } = render(
      InspectorPropertiesFor(roof, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-roof-slope-pct') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(25);
  });

  it('does not show slope pct when useSlopeArrow is false', () => {
    const onChange = vi.fn();
    const roof = makeRoof({
      useSlopeArrow: false,
      slopeArrow: {
        tailMm: { xMm: 0, yMm: 3000 },
        headMm: { xMm: 4000, yMm: 3000 },
        slopeRatio: 0.25,
      },
    });
    const { queryByTestId } = render(
      InspectorPropertiesFor(roof, t, { onPropertyChange: onChange, elementsById }),
    );
    expect(queryByTestId('inspector-roof-slope-pct')).toBeNull();
  });

  it('toggling checkbox calls onPropertyChange with useSlopeArrow', () => {
    const onChange = vi.fn();
    const roof = makeRoof();
    const { getByTestId } = render(
      InspectorPropertiesFor(roof, t, { onPropertyChange: onChange, elementsById }),
    );
    const label = getByTestId('inspector-roof-use-slope-arrow');
    const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('useSlopeArrow', true);
  });

  it('blurring slope pct calls onPropertyChange with updated slopeArrow', () => {
    const onChange = vi.fn();
    const roof = makeRoof({
      useSlopeArrow: true,
      slopeArrow: {
        tailMm: { xMm: 0, yMm: 3000 },
        headMm: { xMm: 4000, yMm: 3000 },
        slopeRatio: 0.25,
      },
    });
    const { getByTestId } = render(
      InspectorPropertiesFor(roof, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-roof-slope-pct') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(
      'slopeArrow',
      expect.objectContaining({ slopeRatio: 0.3 }),
    );
  });
});
