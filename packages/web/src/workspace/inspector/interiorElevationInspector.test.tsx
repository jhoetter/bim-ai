import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const marker: Extract<Element, { kind: 'interior_elevation_marker' }> = {
  kind: 'interior_elevation_marker',
  id: 'iem-1',
  positionMm: { xMm: 3000, yMm: 4000 },
  levelId: 'lvl-ground',
  radiusMm: 2500,
  activeQuadrants: ['N', 'E'],
  elevationViewIds: { north: 'ev-n', south: 'ev-s', east: 'ev-e', west: 'ev-w' },
};

const level1: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-ground',
  name: 'Ground Floor',
  elevationMm: 0,
};

const level2: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-first',
  name: 'First Floor',
  elevationMm: 3000,
};

const elementsById: Record<string, Element> = {
  [level1.id]: level1,
  [level2.id]: level2,
};

describe('interior elevation marker inspector — §6.1.5', () => {
  it('renders radius input with current radiusMm value', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(marker, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-iel-radius') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(2500);
  });

  it('changing radius dispatches update_element_property for radiusMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(marker, t, { onPropertyChange: onChange, elementsById }),
    );
    const input = getByTestId('inspector-iel-radius') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4000' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('radiusMm', 4000);
  });

  it('level select lists all levels from elementsById', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(marker, t, { onPropertyChange: onChange, elementsById }),
    );
    const select = getByTestId('inspector-iel-level') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('lvl-ground');
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('lvl-ground');
    expect(options).toContain('lvl-first');
  });

  it('quadrant checkboxes reflect activeQuadrants array', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(marker, t, { onPropertyChange: onChange, elementsById }),
    );
    const container = getByTestId('inspector-iel-quadrants');
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(4);
    const checked = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.closest('label')?.textContent?.trim());
    expect(checked).toContain('N');
    expect(checked).toContain('E');
    const unchecked = Array.from(checkboxes)
      .filter((cb) => !cb.checked)
      .map((cb) => cb.closest('label')?.textContent?.trim());
    expect(unchecked).toContain('S');
    expect(unchecked).toContain('W');
  });
});
