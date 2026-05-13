import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  normalizeSheetIntent,
  readSheetIntent,
  sheetIntentPatchJson,
  sheetIntentLabel,
} from './sheetIntent';

const baseSheet: Extract<Element, { kind: 'sheet' }> = {
  kind: 'sheet',
  id: 'sheet-a101',
  name: 'A101',
};

describe('sheetIntent', () => {
  it('normalizes intent aliases and defaults to documentation', () => {
    expect(normalizeSheetIntent('docs')).toBe('documentation');
    expect(normalizeSheetIntent('Mood board')).toBe('moodboard');
    expect(normalizeSheetIntent('unknown')).toBeNull();
    expect(readSheetIntent(baseSheet)).toBe('documentation');
  });

  it('reads persisted titleblock intent tags', () => {
    expect(
      readSheetIntent({
        ...baseSheet,
        titleblockParameters: { sheetIntent: 'hybrid' },
      }),
    ).toBe('hybrid');
  });

  it('writes sheet intent as canonical patch JSON', () => {
    expect(sheetIntentPatchJson('moodboard')).toBe('{"sheetIntent":"moodboard"}');
    expect(sheetIntentLabel('documentation')).toBe('Documentation');
    expect(sheetIntentLabel('moodboard')).toBe('Moodboard');
  });
});
