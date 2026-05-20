import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

function makeToposolid(
  overrides: Partial<Extract<Element, { kind: 'toposolid' }>> = {},
): Extract<Element, { kind: 'toposolid' }> {
  return {
    kind: 'toposolid',
    id: 'topo-1',
    boundaryMm: [],
    heightSamples: [
      { xMm: 0, yMm: 0, zMm: 100 },
      { xMm: 1000, yMm: 0, zMm: 200 },
    ],
    ...overrides,
  } as Extract<Element, { kind: 'toposolid' }>;
}

function makeExcavation(
  overrides: Partial<Extract<Element, { kind: 'toposolid_excavation' }>> = {},
): Extract<Element, { kind: 'toposolid_excavation' }> {
  return {
    kind: 'toposolid_excavation',
    id: 'exc-1',
    toposolidId: 'topo-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ],
    depthMm: 1500,
    ...overrides,
  } as Extract<Element, { kind: 'toposolid_excavation' }>;
}

function makePad(
  overrides: Partial<Extract<Element, { kind: 'toposolid_pad' }>> = {},
): Extract<Element, { kind: 'toposolid_pad' }> {
  return {
    kind: 'toposolid_pad',
    id: 'pad-1',
    toposolidId: 'topo-1',
    elevationMm: 250,
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 2000, yMm: 0 },
      { xMm: 2000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ],
    ...overrides,
  } as Extract<Element, { kind: 'toposolid_pad' }>;
}

describe('site terrain inspector sections', () => {
  it('renders and updates toposolid control points', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(makeToposolid(), t, { onDispatchCommand }),
    );

    expect(getByTestId('inspector-topo-point-count').textContent).toContain('2 control points');
    fireEvent.blur(getByTestId('inspector-topo-point-1-z'), { target: { value: '325' } });

    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'update_toposolid',
      id: 'topo-1',
      patch: {
        heightSamples: [
          { xMm: 0, yMm: 0, zMm: 100 },
          { xMm: 1000, yMm: 0, zMm: 325 },
        ],
      },
    });
  });

  it('clamps excavation depth and reports area', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId, getByText } = render(
      InspectorPropertiesFor(makeExcavation(), t, { onPropertyChange }),
    );

    expect(getByText('1.00 m²')).toBeTruthy();
    fireEvent.blur(getByTestId('inspector-excavation-depth'), { target: { value: '20' } });

    expect(onPropertyChange).toHaveBeenCalledWith('depthMm', 100);
  });

  it('renders toposolid pad area and commits elevation', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(makePad(), t, { onPropertyChange }));

    expect(getByTestId('inspector-pad-area').textContent).toContain('2.0 m²');
    fireEvent.blur(getByTestId('inspector-pad-elevation'), { target: { value: '400' } });

    expect(onPropertyChange).toHaveBeenCalledWith('elevationMm', 400);
  });
});
