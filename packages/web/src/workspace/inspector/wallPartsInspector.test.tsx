import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const mat1: Extract<Element, { kind: 'material' }> = {
  kind: 'material',
  id: 'mat-brick',
  name: 'Brick',
};

const mat2: Extract<Element, { kind: 'material' }> = {
  kind: 'material',
  id: 'mat-concrete',
  name: 'Concrete',
};

function makeWallWithParts(
  parts: NonNullable<Extract<Element, { kind: 'wall' }>['parts']>,
): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id: 'wall-1',
    name: 'Wall',
    levelId: 'lvl-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 4000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 2800,
    parts,
  };
}

const elementsById: Record<string, Element> = {
  [mat1.id]: mat1,
  [mat2.id]: mat2,
};

describe('wall parts inspector — §8.1.3', () => {
  it('renders inspector-part-label-0 for first part', () => {
    const wall = makeWallWithParts([
      { id: 'p1', startT: 0, endT: 0.5 },
      { id: 'p2', startT: 0.5, endT: 1 },
    ]);
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    const input = getByTestId('inspector-part-label-0') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Part 1');
  });

  it('renders inspector-part-material-0 select for first part', () => {
    const wall = makeWallWithParts([{ id: 'p1', startT: 0, endT: 1, materialId: 'mat-brick' }]);
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    const select = getByTestId('inspector-part-material-0') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('mat-brick');
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('');
    expect(options).toContain('mat-brick');
    expect(options).toContain('mat-concrete');
  });

  it('renders inspector-part-length-0 read-only display', () => {
    const wall = makeWallWithParts([{ id: 'p1', startT: 0, endT: 0.5 }]);
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    const span = getByTestId('inspector-part-length-0');
    expect(span.textContent).toContain('2000');
    expect(span.textContent).toContain('mm');
  });

  it('material change dispatches update_element_property for parts array', () => {
    const onChange = vi.fn();
    const wall = makeWallWithParts([
      { id: 'p1', startT: 0, endT: 0.5 },
      { id: 'p2', startT: 0.5, endT: 1 },
    ]);
    const { getByTestId } = render(
      InspectorPropertiesFor(wall, t, { elementsById, onPropertyChange: onChange }),
    );
    const select = getByTestId('inspector-part-material-0') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'mat-brick' } });
    expect(onChange).toHaveBeenCalledOnce();
    const [prop, value] = onChange.mock.calls[0]!;
    expect(prop).toBe('parts');
    const parts = value as typeof wall.parts;
    expect(parts![0]!.materialId).toBe('mat-brick');
    expect(parts![1]!.materialId).toBeUndefined();
  });

  it('inspector-parts-create button calls buildEqualParts and dispatches', () => {
    const onChange = vi.fn();
    const wall = makeWallWithParts([{ id: 'p1', startT: 0, endT: 1 }]);
    const { getByTestId } = render(
      InspectorPropertiesFor(wall, t, { elementsById, onPropertyChange: onChange }),
    );
    const btn = getByTestId('inspector-parts-create');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledOnce();
    const [prop, value] = onChange.mock.calls[0]!;
    expect(prop).toBe('parts');
    const parts = value as Extract<Element, { kind: 'wall' }>['parts'];
    expect(parts).toHaveLength(3);
    expect(parts![0]!.startT).toBeCloseTo(0, 9);
    expect(parts![0]!.endT).toBeCloseTo(1 / 3, 9);
    expect(parts![2]!.endT).toBeCloseTo(1, 9);
  });

  it('remove button removes part from array', () => {
    const onChange = vi.fn();
    const wall = makeWallWithParts([
      { id: 'p1', startT: 0, endT: 0.5 },
      { id: 'p2', startT: 0.5, endT: 1 },
    ]);
    const { getByTestId } = render(
      InspectorPropertiesFor(wall, t, { elementsById, onPropertyChange: onChange }),
    );
    fireEvent.click(getByTestId('inspector-part-remove-0'));
    expect(onChange).toHaveBeenCalledOnce();
    const [prop, value] = onChange.mock.calls[0]!;
    expect(prop).toBe('parts');
    const parts = value as Extract<Element, { kind: 'wall' }>['parts'];
    expect(parts).toHaveLength(1);
    expect(parts![0]!.id).toBe('p2');
  });
});
