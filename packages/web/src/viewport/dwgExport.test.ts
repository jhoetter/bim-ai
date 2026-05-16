import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { exportSceneToDwg } from './dwgExport';

const EMPTY_ELEMENTS: Record<string, Element> = {};

const ELEMENTS_WITH_LEVEL: Record<string, Element> = {
  lv1: { kind: 'level', id: 'lv1', name: 'Ground Floor', elevationMm: 0 } as Element,
  w1: {
    kind: 'wall',
    id: 'w1',
    name: 'Wall',
    levelId: 'lv1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 5000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 3000,
  } as Element,
};

describe('DWG export — §12.4.3', () => {
  it('exportSceneToDwg produces output without throwing', () => {
    expect(() => exportSceneToDwg(EMPTY_ELEMENTS)).not.toThrow();
    expect(() => exportSceneToDwg(ELEMENTS_WITH_LEVEL)).not.toThrow();
  });

  it('returned string starts with "0\\nSECTION" (DXF/DWG format header)', () => {
    const result = exportSceneToDwg(ELEMENTS_WITH_LEVEL);
    expect(result.startsWith('0\nSECTION')).toBe(true);
  });

  it('returned string contains AC1015 version header', () => {
    const result = exportSceneToDwg(ELEMENTS_WITH_LEVEL);
    expect(result).toContain('AC1015');
    expect(result).not.toContain('AC1009');
  });

  it('returned string ends with EOF marker', () => {
    const result = exportSceneToDwg(ELEMENTS_WITH_LEVEL);
    expect(result.trimEnd()).toMatch(/EOF$/);
  });
});
