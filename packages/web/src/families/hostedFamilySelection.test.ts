import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { resolveHostedFamilyPlacement } from './hostedFamilySelection';

describe('resolveHostedFamilyPlacement', () => {
  it('keeps built-in window family type ids and dimensions for hosted commands', () => {
    expect(
      resolveHostedFamilyPlacement({
        tool: 'window',
        familyTypeId: 'builtin:window:casement:600x1200',
        elementsById: {},
      }),
    ).toEqual({
      familyTypeId: 'builtin:window:casement:600x1200',
      widthMm: 600,
      heightMm: 1200,
      sillHeightMm: 900,
    });
  });

  it('keeps project door family type ids and reads leaf dimensions', () => {
    const doorType: Element = {
      kind: 'family_type',
      id: 'ft-door',
      name: 'Door 1000',
      familyId: 'fam-door',
      discipline: 'door',
      parameters: { leafWidthMm: '1000', leafHeightMm: 2150 },
    };

    expect(
      resolveHostedFamilyPlacement({
        tool: 'door',
        familyTypeId: doorType.id,
        elementsById: { [doorType.id]: doorType },
      }),
    ).toEqual({
      familyTypeId: 'ft-door',
      widthMm: 1000,
      heightMm: 2150,
    });
  });

  it('falls back to generic window dimensions when the selected family type is not a window', () => {
    expect(
      resolveHostedFamilyPlacement({
        tool: 'window',
        familyTypeId: 'builtin:door:single:900x2100',
        elementsById: {},
      }),
    ).toEqual({
      widthMm: 1200,
      heightMm: 1500,
      sillHeightMm: 900,
    });
  });
});
