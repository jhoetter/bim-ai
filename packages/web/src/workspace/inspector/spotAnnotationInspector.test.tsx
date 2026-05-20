import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

describe('spot and slope annotation inspector sections', () => {
  it('commits spot coordinate northing changes', () => {
    const onPropertyChange = vi.fn();
    const el: Extract<Element, { kind: 'spot_coordinate' }> = {
      kind: 'spot_coordinate',
      id: 'coord-1',
      hostViewId: 'view-1',
      positionMm: { xMm: 10, yMm: 20 },
      northMm: 100,
      eastMm: 200,
      coordinateN: 100,
      coordinateE: 200,
      elevationMm: 300,
    };

    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange }));
    fireEvent.change(getByTestId('inspector-spot-coord-n'), { target: { value: '125' } });

    expect(onPropertyChange).toHaveBeenCalledWith('coordinateN', 125);
  });

  it('commits slope annotation percentage changes and renders ratio', () => {
    const onPropertyChange = vi.fn();
    const el: Extract<Element, { kind: 'slope_annotation' }> = {
      kind: 'slope_annotation',
      id: 'slope-annotation-1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 1000, yMm: 0 },
      slopePct: 5,
    };

    const { getByTestId } = render(InspectorPropertiesFor(el, t, { onPropertyChange }));
    expect(getByTestId('inspector-slope-annotation-ratio').textContent).toBe('1:20');
    fireEvent.change(getByTestId('inspector-slope-annotation-pct'), {
      target: { value: '4.5' },
    });

    expect(onPropertyChange).toHaveBeenCalledWith('slopePct', 4.5);
  });
});
