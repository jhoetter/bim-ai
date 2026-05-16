import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

describe('text note rich-text fields — §4.10', () => {
  it('text_note type accepts bold field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-1',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Bold test',
      fontSizeMm: 200,
      bold: true,
    };
    expect(el.bold).toBe(true);
  });

  it('text_note type accepts italic field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-2',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Italic test',
      fontSizeMm: 200,
      italic: true,
    };
    expect(el.italic).toBe(true);
  });

  it('text_note type accepts colorHex field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-3',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Colored',
      fontSizeMm: 200,
      colorHex: '#ff0000',
    };
    expect(el.colorHex).toBe('#ff0000');
  });

  it('text_note type accepts horizontalAlign field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-4',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Aligned',
      fontSizeMm: 200,
      horizontalAlign: 'center',
    };
    expect(el.horizontalAlign).toBe('center');
  });

  it('text_note type accepts underline field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-5',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Underlined',
      fontSizeMm: 200,
      underline: true,
    };
    expect(el.underline).toBe(true);
  });

  it('text_note type accepts fontFamily field', () => {
    const el: Extract<Element, { kind: 'text_note' }> = {
      kind: 'text_note',
      id: 'tn-6',
      hostViewId: 'pv-1',
      positionMm: { xMm: 0, yMm: 0 },
      text: 'Custom font',
      fontSizeMm: 200,
      fontFamily: 'Courier New',
    };
    expect(el.fontFamily).toBe('Courier New');
  });
});
