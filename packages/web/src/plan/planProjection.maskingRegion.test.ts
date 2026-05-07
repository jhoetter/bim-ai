import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { extractMaskingRegionPrimitives } from './maskingRegionRender';

const maskingRegion: Extract<Element, { kind: 'masking_region' }> = {
  kind: 'masking_region',
  id: 'mr-1',
  hostViewId: 'pv-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 1000, yMm: 1000 },
    { xMm: 0, yMm: 1000 },
  ],
  fillColor: '#ffffff',
};

const otherViewMr: Extract<Element, { kind: 'masking_region' }> = {
  ...maskingRegion,
  id: 'mr-2',
  hostViewId: 'pv-2',
};

const detailLine: Extract<Element, { kind: 'detail_line' }> = {
  kind: 'detail_line',
  id: 'dl-1',
  hostViewId: 'pv-1',
  pointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
  ],
};

describe('KRN-10 — extractMaskingRegionPrimitives', () => {
  it('returns masking_region primitives only for the supplied view', () => {
    const prims = extractMaskingRegionPrimitives(
      {
        [maskingRegion.id]: maskingRegion,
        [otherViewMr.id]: otherViewMr,
        [detailLine.id]: detailLine,
      },
      'pv-1',
    );
    expect(prims).toHaveLength(1);
    expect(prims[0]!.id).toBe('mr-1');
    expect(prims[0]!.boundaryMm).toHaveLength(4);
    expect(prims[0]!.fillColor).toBe('#ffffff');
  });

  it('returns an empty list when no view is active', () => {
    expect(
      extractMaskingRegionPrimitives({ [maskingRegion.id]: maskingRegion }, undefined),
    ).toEqual([]);
  });

  it('falls back to opaque white when fillColor is omitted', () => {
    const naked = { ...maskingRegion, fillColor: undefined } as Extract<
      Element,
      { kind: 'masking_region' }
    >;
    const prims = extractMaskingRegionPrimitives({ [naked.id]: naked }, 'pv-1');
    expect(prims[0]!.fillColor).toBe('#ffffff');
  });

  it('renders nothing for views with no hosted masking_region', () => {
    expect(extractMaskingRegionPrimitives({ [detailLine.id]: detailLine }, 'pv-1')).toEqual([]);
  });
});
