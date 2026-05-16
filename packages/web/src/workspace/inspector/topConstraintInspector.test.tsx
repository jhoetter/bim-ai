import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const lvl1: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Level 1',
  elevationMm: 0,
};

const lvl2: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-2',
  name: 'Level 2',
  elevationMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-1': lvl1,
  'lvl-2': lvl2,
};

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall 1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  levelId: 'lvl-1',
};

const wallWithTopConstraint: Extract<Element, { kind: 'wall' }> = {
  ...wall,
  id: 'wall-2',
  topConstraintLevelId: 'lvl-2',
  topConstraintOffsetMm: 0,
};

const column: Extract<Element, { kind: 'column' }> = {
  kind: 'column',
  id: 'col-1',
  name: 'Column 1',
  xMm: 0,
  yMm: 0,
  bMm: 300,
  hMm: 300,
  heightMm: 3000,
  levelId: 'lvl-1',
};

describe('top constraint level inspector — §2.6.2', () => {
  it('renders inspector-wall-top-level select for wall elements', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    const select = getByTestId('inspector-wall-top-level') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('');
  });

  it('select shows all levels from elementsById', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    const select = getByTestId('inspector-wall-top-level') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('lvl-1');
    expect(values).toContain('lvl-2');
    expect(values).toContain('');
  });

  it('selecting a level dispatches update_element_property for topConstraintLevelId', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(wall, t, { elementsById, onPropertyChange: onChange }),
    );
    const select = getByTestId('inspector-wall-top-level') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'lvl-2' } });
    expect(onChange).toHaveBeenCalledWith('topConstraintLevelId', 'lvl-2');
  });

  it('selecting Unconnected dispatches topConstraintLevelId=null', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(wallWithTopConstraint, t, {
        elementsById,
        onPropertyChange: onChange,
      }),
    );
    const select = getByTestId('inspector-wall-top-level') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('topConstraintLevelId', null);
  });

  it('offset input is hidden when topConstraintLevelId is null', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(wall, t, { elementsById }));
    expect(queryByTestId('inspector-wall-top-offset')).toBeNull();
  });

  it('offset input shown when topConstraintLevelId is set', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(wallWithTopConstraint, t, { elementsById }),
    );
    expect(getByTestId('inspector-wall-top-offset')).toBeTruthy();
  });

  it('changing offset dispatches update_element_property for topConstraintOffsetMm', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(wallWithTopConstraint, t, {
        elementsById,
        onPropertyChange: onChange,
      }),
    );
    const input = getByTestId('inspector-wall-top-offset') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith('topConstraintOffsetMm', expect.any(Number));
  });

  it('renders inspector-column-top-level select for column elements', () => {
    const { getByTestId } = render(InspectorPropertiesFor(column, t, { elementsById }));
    const select = getByTestId('inspector-column-top-level') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('');
  });

  it('column level select shows all levels from elementsById', () => {
    const { getByTestId } = render(InspectorPropertiesFor(column, t, { elementsById }));
    const select = getByTestId('inspector-column-top-level') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('lvl-1');
    expect(values).toContain('lvl-2');
  });

  it('column offset input hidden when topConstraintLevelId is null', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(column, t, { elementsById }));
    expect(queryByTestId('inspector-column-top-offset')).toBeNull();
  });

  it('column offset input shown when topConstraintLevelId is set', () => {
    const columnWithConstraint: Extract<Element, { kind: 'column' }> = {
      ...column,
      id: 'col-2',
      topConstraintLevelId: 'lvl-2',
    };
    const { getByTestId } = render(
      InspectorPropertiesFor(columnWithConstraint, t, { elementsById }),
    );
    expect(getByTestId('inspector-column-top-offset')).toBeTruthy();
  });
});
