import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const mat: Extract<Element, { kind: 'material' }> = {
  kind: 'material',
  id: 'mat-1',
  name: 'Concrete',
  displayName: 'Concrete',
};

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'floor-1',
  name: 'F1',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 5000 },
    { xMm: 0, yMm: 5000 },
  ],
  thicknessMm: 250,
  faceMaterialOverrides: { top: 'mat-1', bottom: 'mat-1' },
};

const floorNoOverrides: Extract<Element, { kind: 'floor' }> = {
  ...floor,
  id: 'floor-2',
  faceMaterialOverrides: null,
};

const elementsById: Record<string, Element> = {
  'mat-1': mat,
  'floor-1': floor,
  'floor-2': floorNoOverrides,
};

describe('face material overrides inspector — §3.3.4', () => {
  it('renders inspector-face-overrides section when overrides exist', () => {
    const { getByTestId } = render(InspectorPropertiesFor(floor, t, { elementsById }));
    expect(getByTestId('inspector-face-overrides')).toBeDefined();
    expect(getByTestId('face-override-top')).toBeDefined();
    expect(getByTestId('face-override-bottom')).toBeDefined();
  });

  it('renders nothing when faceMaterialOverrides is null', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(floorNoOverrides, t, { elementsById }));
    expect(queryByTestId('inspector-face-overrides')).toBeNull();
  });

  it('remove button dispatches paint_face with materialId null', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(floor, t, { elementsById, onDispatchCommand }),
    );
    fireEvent.click(getByTestId('face-override-remove-top'));
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'paint_face',
      elementId: 'floor-1',
      faceId: 'top',
      materialId: null,
    });
  });
});
