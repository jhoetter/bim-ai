import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { listMaterialImageAssets, missingMaterialImageAssetIds } from './materialImageAssets';

const elementsById: Record<string, Element> = {
  albedo: {
    kind: 'image_asset',
    id: 'albedo',
    filename: 'brick-albedo.png',
    mimeType: 'image/png',
    byteSize: 100,
    contentHash: 'sha256:a',
    mapUsageHint: 'albedo',
    license: 'CC0',
  },
  normal: {
    kind: 'image_asset',
    id: 'normal',
    filename: 'brick-normal.png',
    mimeType: 'image/png',
    byteSize: 90,
    contentHash: 'sha256:b',
    mapUsageHint: 'normal',
  },
};

describe('material image asset browser helpers — MAT-11', () => {
  it('filters project image assets by map usage hint', () => {
    expect(listMaterialImageAssets(elementsById, 'albedo').map((asset) => asset.id)).toEqual([
      'albedo',
    ]);
    expect(listMaterialImageAssets(elementsById, 'normal').map((asset) => asset.id)).toEqual([
      'normal',
    ]);
  });

  it('reports missing project asset ids without flagging URLs or bundled library ids', () => {
    expect(
      missingMaterialImageAssetIds(
        ['albedo', 'missing', 'library/masonry/brick', 'data:image/png;base64,abc'],
        elementsById,
      ),
    ).toEqual(['missing']);
  });
});
