import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { composeRoomTagLines } from './roomTagRenderer';

type PlacedTag = Extract<Element, { kind: 'placed_tag' }>;

const baseTag: PlacedTag = {
  kind: 'placed_tag',
  id: 'tag-room-1',
  hostElementId: 'room-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 2000, yMm: 1500 },
  categoryKind: 'room',
  fields: {
    roomName: 'Living Room',
    roomNumber: '101',
    roomArea: 12_000_000, // 12 m² in mm²
  },
};

describe('room tag plan renderer — §13.1.2', () => {
  it('composes tag text with room number and name by default', () => {
    const lines = composeRoomTagLines(baseTag);
    expect(lines).toContain('101');
    expect(lines).toContain('Living Room');
  });

  it('includes area line when showRoomArea is true', () => {
    const tag: PlacedTag = { ...baseTag, showRoomArea: true };
    const lines = composeRoomTagLines(tag);
    expect(lines).toContain('12.00 m²');
  });

  it('omits name line when showRoomName is false', () => {
    const tag: PlacedTag = { ...baseTag, showRoomName: false };
    const lines = composeRoomTagLines(tag);
    expect(lines).not.toContain('Living Room');
    expect(lines).toContain('101');
  });
});
