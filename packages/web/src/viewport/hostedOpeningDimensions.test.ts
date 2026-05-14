import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { resolveDoorCutDimensions, resolveWindowCutDimensions } from './hostedOpeningDimensions';

describe('hosted opening CSG dimensions', () => {
  it('uses selected built-in door type dimensions instead of stale instance width', () => {
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'door',
      name: 'Door',
      wallId: 'wall',
      alongT: 0.5,
      widthMm: 900,
      familyTypeId: 'builtin:door:double:1800x2100',
    };

    expect(resolveDoorCutDimensions(door, {}, 2800)).toEqual({
      widthMm: 1800,
      heightMm: 2100,
    });
  });

  it('uses project-authored family_type dimensions for hosted windows', () => {
    const elementsById: Record<string, Element> = {
      'ft-window': {
        kind: 'family_type',
        id: 'ft-window',
        name: 'Tall window',
        familyId: 'custom-window',
        discipline: 'window',
        parameters: { widthMm: 900, heightMm: 2200, sillMm: 150 },
      },
    };
    const win: Extract<Element, { kind: 'window' }> = {
      kind: 'window',
      id: 'win',
      name: 'Window',
      wallId: 'wall',
      alongT: 0.5,
      widthMm: 1200,
      heightMm: 1500,
      sillHeightMm: 900,
      familyTypeId: 'ft-window',
    };

    expect(resolveWindowCutDimensions(win, elementsById)).toEqual({
      widthMm: 900,
      heightMm: 2200,
      sillHeightMm: 150,
    });
  });
});
