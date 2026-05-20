import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import { computeShaftCutFloors } from '../../plan/shaftCutFloors';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const LEVEL_GROUND: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-ground',
  name: 'Ground',
  elevationMm: 0,
};

const LEVEL_UPPER: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-upper',
  name: 'Upper',
  elevationMm: 3000,
};

const SHAFT: Extract<Element, { kind: 'shaft' }> = {
  kind: 'shaft',
  id: 'shaft-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 5000 },
    { xMm: 0, yMm: 5000 },
  ],
  baseLevelId: 'lvl-ground',
  topLevelId: 'lvl-upper',
};

const elementsById: Record<string, Element> = {
  'lvl-ground': LEVEL_GROUND,
  'lvl-upper': LEVEL_UPPER,
  'shaft-1': SHAFT,
};

describe('shaft inspector — §2.5.1', () => {
  it('renders base level dropdown', () => {
    const { getByTestId } = render(InspectorPropertiesFor(SHAFT, t, { elementsById }));
    expect(getByTestId('inspector-shaft-base-level')).toBeTruthy();
  });

  it('renders top level dropdown', () => {
    const { getByTestId } = render(InspectorPropertiesFor(SHAFT, t, { elementsById }));
    expect(getByTestId('inspector-shaft-top-level')).toBeTruthy();
  });

  it('shows cut floor count', () => {
    const shaftWithCuts = { ...SHAFT, cutFloorIds: ['floor-1', 'floor-2'] };
    const { getByTestId } = render(InspectorPropertiesFor(shaftWithCuts, t, { elementsById }));
    const span = getByTestId('inspector-shaft-cut-floor-count');
    expect(span.textContent).toContain('2');
  });

  it('shows 0 cut floors when cutFloorIds is empty', () => {
    const shaftNoCuts = { ...SHAFT, cutFloorIds: undefined };
    const { getByTestId } = render(InspectorPropertiesFor(shaftNoCuts, t, { elementsById }));
    const span = getByTestId('inspector-shaft-cut-floor-count');
    expect(span.textContent).toContain('0');
  });

  it('renders Apply Shaft Cut button', () => {
    const { getByTestId } = render(InspectorPropertiesFor(SHAFT, t, { elementsById }));
    expect(getByTestId('inspector-shaft-apply-cut')).toBeTruthy();
  });

  it('Apply Shaft Cut button dispatches applyShaftCut command', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(SHAFT, t, { elementsById, onDispatchCommand }),
    );
    fireEvent.click(getByTestId('inspector-shaft-apply-cut'));
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('applyShaftCut');
    expect(cmd.shaftId).toBe('shaft-1');
  });

  it('base level dropdown calls onPropertyChange with baseLevelId', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(SHAFT, t, { elementsById, onPropertyChange }),
    );
    fireEvent.change(getByTestId('inspector-shaft-base-level'), {
      target: { value: 'lvl-upper' },
    });
    expect(onPropertyChange).toHaveBeenCalledWith('baseLevelId', 'lvl-upper');
  });

  it('top level dropdown calls onPropertyChange with topLevelId', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(SHAFT, t, { elementsById, onPropertyChange }),
    );
    fireEvent.change(getByTestId('inspector-shaft-top-level'), {
      target: { value: 'lvl-ground' },
    });
    expect(onPropertyChange).toHaveBeenCalledWith('topLevelId', 'lvl-ground');
  });
});

describe('computeShaftCutFloors wiring — §2.5.1', () => {
  it('returns empty array for shaft with no boundary', () => {
    const emptyShaft: Extract<Element, { kind: 'shaft' }> = {
      kind: 'shaft',
      id: 'shaft-empty',
      boundaryMm: [],
      baseLevelId: 'lvl-ground',
      topLevelId: 'lvl-upper',
    };
    const result = computeShaftCutFloors(emptyShaft, elementsById);
    expect(result).toEqual([]);
  });

  it('finds floors within vertical extent', () => {
    const floor: Element = {
      kind: 'floor',
      id: 'floor-1',
      levelId: 'lvl-ground',
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 4000, yMm: 1000 },
        { xMm: 4000, yMm: 4000 },
        { xMm: 1000, yMm: 4000 },
      ],
      thicknessMm: 200,
      structureThicknessMm: 150,
      finishThicknessMm: 50,
      roomBounded: true,
    } as unknown as Element;

    const elems: Record<string, Element | undefined> = {
      ...elementsById,
      'floor-1': floor,
    };

    const result = computeShaftCutFloors(SHAFT, elems);
    expect(result).toContain('floor-1');
  });
});
