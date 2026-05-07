import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  extractDetailComponentPrimitives,
  svgFillPatternDef,
  svgTextAnchorAttrs,
  textNoteAnchorOffsetMm,
} from './detailComponentsRender';

const detailLine: Extract<Element, { kind: 'detail_line' }> = {
  kind: 'detail_line',
  id: 'dl-1',
  hostViewId: 'pv-1',
  pointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 500 },
  ],
  strokeMm: 1.5,
  colour: '#ff0000',
  style: 'dashed',
};

const detailRegion: Extract<Element, { kind: 'detail_region' }> = {
  kind: 'detail_region',
  id: 'dr-1',
  hostViewId: 'pv-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 0, yMm: 1000 },
  ],
  fillPattern: 'hatch_45',
  fillColour: '#888888',
};

const textNote: Extract<Element, { kind: 'text_note' }> = {
  kind: 'text_note',
  id: 'tn-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 500, yMm: 500 },
  text: 'Hello',
  fontSizeMm: 200,
  anchor: 'c',
};

const otherViewLine: Extract<Element, { kind: 'detail_line' }> = {
  ...detailLine,
  id: 'dl-other',
  hostViewId: 'pv-2',
};

describe('ANN-01 — extractDetailComponentPrimitives', () => {
  it('returns primitives for detail elements hosted on the supplied view', () => {
    const prims = extractDetailComponentPrimitives(
      {
        [detailLine.id]: detailLine,
        [detailRegion.id]: detailRegion,
        [textNote.id]: textNote,
        [otherViewLine.id]: otherViewLine,
      },
      'pv-1',
    );
    expect(prims).toHaveLength(3);
    const kinds = prims.map((p) => p.kind).sort();
    expect(kinds).toEqual(['detail_line', 'detail_region', 'text_note']);
  });

  it('excludes elements hosted on a different view', () => {
    const prims = extractDetailComponentPrimitives({ [otherViewLine.id]: otherViewLine }, 'pv-1');
    expect(prims).toEqual([]);
  });

  it('returns an empty list when viewId is undefined', () => {
    expect(extractDetailComponentPrimitives({ [detailLine.id]: detailLine }, undefined)).toEqual(
      [],
    );
  });

  it('preserves field defaults when authoring fields are omitted', () => {
    const minimal: Extract<Element, { kind: 'detail_line' }> = {
      kind: 'detail_line',
      id: 'dl-2',
      hostViewId: 'pv-1',
      pointsMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
    };
    const [prim] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, 'pv-1');
    expect(prim?.kind).toBe('detail_line');
    if (prim?.kind === 'detail_line') {
      expect(prim.style).toBe('solid');
      expect(prim.strokeMm).toBe(1);
      expect(prim.colour).toBe('#202020');
    }
  });
});

describe('ANN-01 — svgTextAnchorAttrs', () => {
  it('maps the 9 anchor codes to SVG text-anchor / dominant-baseline pairs', () => {
    expect(svgTextAnchorAttrs('tl')).toEqual({
      textAnchor: 'start',
      dominantBaseline: 'hanging',
    });
    expect(svgTextAnchorAttrs('c')).toEqual({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
    expect(svgTextAnchorAttrs('br')).toEqual({
      textAnchor: 'end',
      dominantBaseline: 'baseline',
    });
  });
});

describe('ANN-01 — svgFillPatternDef', () => {
  it('returns null for solid fills', () => {
    expect(svgFillPatternDef('solid', '#000')).toBeNull();
  });

  it('returns a pattern definition for hatch / dots fills', () => {
    const def = svgFillPatternDef('hatch_45', '#aabbcc');
    expect(def).not.toBeNull();
    expect(def!.id).toContain('hatch_45');
    expect(def!.svg).toContain('<pattern');
    expect(def!.svg).toContain('#aabbcc');
  });

  it('emits distinct ids per pattern token for caching purposes', () => {
    const a = svgFillPatternDef('crosshatch', '#000');
    const b = svgFillPatternDef('dots', '#000');
    expect(a!.id).not.toEqual(b!.id);
  });
});

describe('ANN-01 — textNoteAnchorOffsetMm', () => {
  it('top-left anchor returns a downward offset matching text height', () => {
    expect(textNoteAnchorOffsetMm('tl', 100, 50)).toEqual({ dxMm: 0, dyMm: -50 });
  });

  it('bottom-right anchor returns a leftward offset matching text width', () => {
    expect(textNoteAnchorOffsetMm('br', 100, 50)).toEqual({ dxMm: -100, dyMm: 0 });
  });

  it('center anchor returns half-offsets', () => {
    expect(textNoteAnchorOffsetMm('c', 100, 50)).toEqual({ dxMm: -50, dyMm: -25 });
  });
});
