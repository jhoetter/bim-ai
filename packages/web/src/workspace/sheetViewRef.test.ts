import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { resolveViewportTitleFromRef } from './sheetViewRef';

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
