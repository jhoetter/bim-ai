import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const wall = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Host Wall',
  levelId: 'level-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  materialKey: 'Concrete',
} as Extract<Element, { kind: 'wall' }>;

const materialTag: Extract<Element, { kind: 'material_tag' }> = {
  kind: 'material_tag',
  id: 'mat-tag-1',
  hostElementId: wall.id,
  hostViewId: 'pv-1',
  positionMm: { xMm: 500, yMm: 0 },
};

describe('material tag inspector', () => {
  it('resolves material from the host element', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(materialTag, t, { elementsById: { [wall.id]: wall } }),
    );

    expect(getByTestId('inspector-material-tag-resolved').textContent).toBe('Concrete');
  });

  it('commits text override and layer index edits', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(materialTag, t, {
        elementsById: { [wall.id]: wall },
        onPropertyChange,
      }),
    );

    fireEvent.blur(getByTestId('inspector-material-tag-override'), {
      target: { value: 'Painted gypsum' },
    });
    fireEvent.blur(getByTestId('inspector-material-tag-layer'), { target: { value: '2' } });

    expect(onPropertyChange).toHaveBeenCalledWith('textOverride', 'Painted gypsum');
    expect(onPropertyChange).toHaveBeenCalledWith('layerIndex', 2);
  });
});
