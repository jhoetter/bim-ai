import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  parseSheetViewRef,
  resolveViewportTitleFromRef,
  sheetsReferencingSectionCut,
} from './sheetViewRef';

describe('parseSheetViewRef', () => {
  it('normalizes sec: and vp: prefixes', () => {
    expect(parseSheetViewRef('sec:sc1')).toEqual({
      rawRef: 'sec:sc1',
      normalizedRef: 'section:sc1',
      kind: 'section',
      refId: 'sc1',
    });
    expect(parseSheetViewRef('vp:v1')).toEqual({
      rawRef: 'vp:v1',
      normalizedRef: 'viewpoint:v1',
      kind: 'viewpoint',
      refId: 'v1',
    });
  });

  it('parses plan:, schedule:, section:, viewpoint:', () => {
    expect(parseSheetViewRef('plan:pv')?.kind).toBe('plan');
    expect(parseSheetViewRef('schedule:sch')?.kind).toBe('schedule');
    expect(parseSheetViewRef('section:s')?.normalizedRef).toBe('section:s');
    expect(parseSheetViewRef('viewpoint:x')?.kind).toBe('viewpoint');
  });

  it('returns unknown for malformed refs', () => {
    expect(parseSheetViewRef('nocolon')?.kind).toBe('unknown');
    expect(parseSheetViewRef('foo:bar')?.kind).toBe('unknown');
    expect(parseSheetViewRef(':')?.kind).toBe('unknown');
    expect(parseSheetViewRef('')).toEqual({
      rawRef: '',
      normalizedRef: '',
      kind: 'unknown',
      refId: '',
    });
    expect(parseSheetViewRef(null)).toBeNull();
  });

  it('preserves nested ids after first colon', () => {
    expect(parseSheetViewRef('plan:a:b:c')?.refId).toBe('a:b:c');
    expect(parseSheetViewRef('plan:a:b:c')?.normalizedRef).toBe('plan:a:b:c');
  });
});

describe('sheetsReferencingSectionCut', () => {
  const scZ = 'sc-z';
  const scA = 'sc-a';

  it('matches section: and sec: aliases and sorts by sheet id then raw ref', () => {
    const elementsById: Record<string, Element> = {
      shB: {
        kind: 'sheet',
        id: 'sh-b',
        name: 'B sheet',
        viewportsMm: [{ viewRef: `section:${scA}` }, { viewRef: 'plan:pv1' }] as Element['viewportsMm'],
      } as Extract<Element, { kind: 'sheet' }>,
      shA: {
        kind: 'sheet',
        id: 'sh-a',
        name: 'A sheet',
        viewportsMm: [{ view_ref: `sec:${scA}` }] as unknown as Element['viewportsMm'],
      } as Extract<Element, { kind: 'sheet' }>,
      [scA]: {
        kind: 'section_cut',
        id: scA,
        name: 'Cut A',
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 1000, yMm: 0 },
      } as Extract<Element, { kind: 'section_cut' }>,
      other: {
        kind: 'section_cut',
        id: scZ,
        name: 'Z',
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 500, yMm: 0 },
      } as Extract<Element, { kind: 'section_cut' }>,
    };

    expect(sheetsReferencingSectionCut(elementsById, scA)).toEqual([
      {
        sheetId: 'sh-a',
        sheetName: 'A sheet',
        viewRefNormalized: 'section:sc-a',
        rawViewRef: 'sec:sc-a',
      },
      {
        sheetId: 'sh-b',
        sheetName: 'B sheet',
        viewRefNormalized: 'section:sc-a',
        rawViewRef: 'section:sc-a',
      },
    ]);
  });

  it('returns empty when no sheet references the cut', () => {
    const elementsById: Record<string, Element> = {
      sh: {
        kind: 'sheet',
        id: 'sh',
        name: 'S',
        viewportsMm: [{ viewRef: 'section:other' }] as Element['viewportsMm'],
      } as Extract<Element, { kind: 'sheet' }>,
    };
    expect(sheetsReferencingSectionCut(elementsById, 'missing')).toEqual([]);
  });
});

describe('resolveViewportTitleFromRef', () => {
  it('resolves viewpoint refs', () => {
    const elementsById: Record<string, Element> = {
      v1: {
        kind: 'viewpoint',
        id: 'v1',
        name: 'Southwest axo',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 5000 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
        mode: 'orbit_3d',
      },
    };
    expect(resolveViewportTitleFromRef(elementsById, 'viewpoint:v1')).toBe('Southwest axo');
  });
});
