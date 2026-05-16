import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const ceiling: Extract<Element, { kind: 'ceiling' }> = {
  kind: 'ceiling',
  id: 'ceil-1',
  name: 'Test Ceiling',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  heightOffsetMm: 2700,
  thicknessMm: 50,
  gridPatternMm: 600,
};

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Ground Floor',
  elevationMm: 0,
};

const elementsById: Record<string, Element> = {
  [ceiling.id]: ceiling,
  [level.id]: level,
};

describe('ceiling inspector grid size — §8.2', () => {
  it('renders inspector-ceiling-grid-size input', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(ceiling, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-ceiling-grid-size') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(600);
  });

  it('changing value dispatches update_element_property for gridPatternMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(ceiling, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-ceiling-grid-size') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1200' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('gridPatternMm', 1200);
  });
});
