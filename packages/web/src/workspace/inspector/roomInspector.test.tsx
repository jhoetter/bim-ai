import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorRoomEditor } from './InspectorContent';

afterEach(() => {
  cleanup();
});

const room: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-1',
  name: 'Office',
  levelId: 'lvl-1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10_000, yMm: 0 },
    { xMm: 10_000, yMm: 5_000 },
    { xMm: 0, yMm: 5_000 },
  ],
  numberLabel: '101',
  targetAreaM2: 48,
};

const roomNoOutline: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-2',
  name: 'Empty',
  levelId: 'lvl-1',
  outlineMm: [],
};

describe('room inspector — §13.1.2 + §13.1.4', () => {
  it('renders inspector-room-number input', () => {
    const { getByTestId } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={vi.fn()} />,
    );
    const input = getByTestId('inspector-room-number') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('101');
  });

  it('renders inspector-room-area-gross with computed area', () => {
    const { getByTestId } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={vi.fn()} />,
    );
    const input = getByTestId('inspector-room-area-gross') as HTMLInputElement;
    expect(input).toBeTruthy();
    // 10m × 5m = 50 m²
    expect(input.value).toBe('50.0 m²');
  });

  it('renders — when room has fewer than 3 outline points', () => {
    const { getByTestId } = render(
      <InspectorRoomEditor el={roomNoOutline} revision={1} onPersistProperty={vi.fn()} />,
    );
    const input = getByTestId('inspector-room-area-gross') as HTMLInputElement;
    expect(input.value).toBe('—');
  });

  it('renders inspector-room-target-area input', () => {
    const { getByTestId } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={vi.fn()} />,
    );
    const input = getByTestId('inspector-room-target-area') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('48');
  });

  it('changing numberLabel dispatches update_element_property', () => {
    const onPersist = vi.fn();
    const { getByTestId } = render(
      <InspectorRoomEditor el={room} revision={1} onPersistProperty={onPersist} />,
    );
    const input = getByTestId('inspector-room-number') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '102' } });
    expect(onPersist).toHaveBeenCalledWith('numberLabel', '102');
  });
});
