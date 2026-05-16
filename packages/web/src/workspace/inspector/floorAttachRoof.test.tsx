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

const roof: Extract<Element, { kind: 'roof' }> = {
  kind: 'roof',
  id: 'roof-1',
  name: 'Main Roof',
  referenceLevelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
};

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'floor-1',
  name: 'Ground Slab',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  thicknessMm: 200,
};

const floorAttached: Extract<Element, { kind: 'floor' }> = {
  ...floor,
  attachedToRoofId: 'roof-1',
  topFaceElevationMm: 3000,
};

const elementsById: Record<string, Element> = {
  [level.id]: level,
  [roof.id]: roof,
  [floor.id]: floor,
};

const elementsByIdAttached: Record<string, Element> = {
  [level.id]: level,
  [roof.id]: roof,
  [floorAttached.id]: floorAttached,
};

describe('floor attach to roof — §3.4.1', () => {
  it('renders inspector-floor-attach button when not attached', () => {
    const { getByTestId } = render(InspectorPropertiesFor(floor, t, { elementsById }));
    expect(getByTestId('inspector-floor-attach')).toBeTruthy();
  });

  it('renders inspector-floor-detach button when attached', () => {
    const { getByTestId } = render(
      InspectorPropertiesFor(floorAttached, t, { elementsById: elementsByIdAttached }),
    );
    expect(getByTestId('inspector-floor-detach')).toBeTruthy();
  });

  it('attach button dispatches attach_floor_to_roof with correct roofId', () => {
    const dispatch = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(floor, t, { elementsById, onDispatchCommand: dispatch }),
    );
    fireEvent.click(getByTestId('inspector-floor-attach'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'attach_floor_to_roof',
      floorId: 'floor-1',
      roofId: 'roof-1',
    });
  });

  it('detach button dispatches attach_floor_to_roof with empty roofId', () => {
    const dispatch = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(floorAttached, t, {
        elementsById: elementsByIdAttached,
        onDispatchCommand: dispatch,
      }),
    );
    fireEvent.click(getByTestId('inspector-floor-detach'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'attach_floor_to_roof',
      floorId: 'floor-1',
      roofId: '',
    });
  });
});
