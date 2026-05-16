import type { Element } from '@bim-ai/core';

type PlacedTag = Extract<Element, { kind: 'placed_tag' }>;

/** §13.1.2 — compose display lines for a room tag from its fields and show flags. */
export function composeRoomTagLines(tag: PlacedTag): string[] {
  const lines: string[] = [];
  if (tag.showRoomNumber !== false && tag.fields?.roomNumber) {
    lines.push(tag.fields.roomNumber);
  }
  if (tag.showRoomName !== false && tag.fields?.roomName) {
    lines.push(tag.fields.roomName);
  }
  if (tag.showRoomArea === true && tag.fields?.roomArea != null) {
    lines.push(`${(tag.fields.roomArea / 1e6).toFixed(2)} m²`);
  }
  return lines.length > 0 ? lines : ['Room'];
}

export function composeRoomTagText(tag: PlacedTag): string {
  return composeRoomTagLines(tag).join('\n');
}
