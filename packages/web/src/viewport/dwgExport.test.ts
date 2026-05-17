import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { exportSceneToDwg } from './dwgExport';

const EMPTY_ELEMENTS: Record<string, Element> = {};

const WALL: Element = {
  kind: 'wall',
  id: 'w1',
  name: 'Wall',
  levelId: 'lv1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
} as Element;

const DOOR: Element = {
  kind: 'door',
  id: 'd1',
  name: 'Door',
  wallId: 'w1',
  alongT: 0.5,
  widthMm: 900,
} as Element;

const FLOOR: Element = {
  kind: 'floor',
  id: 'fl1',
  name: 'Floor',
  levelId: 'lv1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  thicknessMm: 250,
} as Element;

const ROOM: Element = {
  kind: 'room',
  id: 'r1',
  name: 'Wohnzimmer',
  levelId: 'lv1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
} as Element;

// ---------------------------------------------------------------------------
// Original suite — preserved
// ---------------------------------------------------------------------------

describe('DWG export — §12.4.3', () => {
  it('exportSceneToDwg produces output without throwing', () => {
    expect(() => exportSceneToDwg(EMPTY_ELEMENTS)).not.toThrow();
    expect(() => exportSceneToDwg({ w1: WALL })).not.toThrow();
  });

  it('returned string starts with "0\\nSECTION" (DXF/DWG format header)', () => {
    const result = exportSceneToDwg({ w1: WALL });
    expect(result.startsWith('0\nSECTION')).toBe(true);
  });

  it('returned string contains AC1015 version header', () => {
    const result = exportSceneToDwg({ w1: WALL });
    expect(result).toContain('AC1015');
    expect(result).not.toContain('AC1009');
  });

  it('returned string ends with EOF marker', () => {
    const result = exportSceneToDwg({ w1: WALL });
    expect(result.trimEnd()).toMatch(/EOF$/);
  });
});

// ---------------------------------------------------------------------------
// New suite — German layer names + entity types (§12.4.3)
// ---------------------------------------------------------------------------

describe('exportSceneToDwg — §12.4.3', () => {
  it('output contains DXF header AC1015', () => {
    const result = exportSceneToDwg(EMPTY_ELEMENTS);
    expect(result).toContain('AC1015');
  });

  it('output contains LAYER table with A-WAND', () => {
    const result = exportSceneToDwg(EMPTY_ELEMENTS);
    expect(result).toContain('A-WAND');
  });

  it('output contains LAYER table with A-TUERE', () => {
    const result = exportSceneToDwg(EMPTY_ELEMENTS);
    expect(result).toContain('A-TUERE');
  });

  it('wall element produces LWPOLYLINE entity on A-WAND layer', () => {
    const result = exportSceneToDwg({ w1: WALL });
    expect(result).toContain('LWPOLYLINE');
    expect(result).toContain('A-WAND');
  });

  it('door element produces LINE entity on A-TUERE layer', () => {
    const result = exportSceneToDwg({ d1: DOOR });
    expect(result).toContain('LINE');
    expect(result).toContain('A-TUERE');
  });

  it('floor element with boundaryMm produces LWPOLYLINE on A-DECKE', () => {
    const result = exportSceneToDwg({ fl1: FLOOR });
    expect(result).toContain('LWPOLYLINE');
    expect(result).toContain('A-DECKE');
  });

  it('room element produces TEXT entity on A-RAUM layer', () => {
    const result = exportSceneToDwg({ r1: ROOM });
    expect(result).toContain('TEXT');
    expect(result).toContain('A-RAUM');
    expect(result).toContain('Wohnzimmer');
  });

  it('output is valid DXF (contains ENDSEC and EOF)', () => {
    const result = exportSceneToDwg(EMPTY_ELEMENTS);
    expect(result).toContain('ENDSEC');
    expect(result).toContain('EOF');
  });
});
