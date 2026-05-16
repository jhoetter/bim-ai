import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const roomEl: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-1',
  name: 'Living Room',
  levelId: 'level-1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
  numberLabel: '101',
};

const roomTag: Extract<Element, { kind: 'placed_tag' }> = {
  kind: 'placed_tag',
  id: 'tag-room-1',
  hostElementId: roomEl.id,
  hostViewId: 'pv-1',
  positionMm: { xMm: 2000, yMm: 1500 },
  categoryKind: 'room',
  fields: {
    roomName: 'Living Room',
    roomNumber: '101',
    roomArea: 12_000_000, // 12 m² in mm²
  },
};

const elementsById: Record<string, Element> = {
  [roomEl.id]: roomEl,
  [roomTag.id]: roomTag,
};

describe('room tag inspector — §13.1.2', () => {
  it('renders inspector-tag-show-number checkbox checked by default', () => {
    const { getByTestId } = render(InspectorPropertiesFor(roomTag, t, { elementsById }));
    const cb = getByTestId('inspector-tag-show-number') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('renders inspector-tag-show-area checkbox unchecked by default', () => {
    const { getByTestId } = render(InspectorPropertiesFor(roomTag, t, { elementsById }));
    const cb = getByTestId('inspector-tag-show-area') as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it('show-area change dispatches onPropertyChange for showRoomArea', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(roomTag, t, { elementsById, onPropertyChange }),
    );
    const cb = getByTestId('inspector-tag-show-area') as HTMLInputElement;
    fireEvent.click(cb);
    expect(onPropertyChange).toHaveBeenCalledWith('showRoomArea', true);
  });

  it('shows computed area from fields.roomArea', () => {
    const { getByText } = render(InspectorPropertiesFor(roomTag, t, { elementsById }));
    expect(getByText('12.00 m²')).toBeTruthy();
  });
});
