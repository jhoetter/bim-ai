import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import {
  classifyPlacedAssetSymbol,
  makePlacedAssetMesh,
  resolvePlacedAssetRenderSpec,
} from './placedAssetRendering';

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl',
  name: 'Level',
  elevationMm: 3000,
};

const fridgeEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
  kind: 'asset_library_entry',
  id: 'asset-fridge',
  assetKind: 'block_2d',
  name: 'Tall Fridge',
  category: 'kitchen',
  tags: ['fridge', 'refrigerator'],
  disciplineTags: ['arch'],
  thumbnailKind: 'schematic_plan',
  thumbnailWidthMm: 600,
  thumbnailHeightMm: 650,
  planSymbolKind: 'fridge',
  renderProxyKind: 'fridge',
  paramSchema: [
    { key: 'widthMm', kind: 'mm', default: 600 },
    { key: 'depthMm', kind: 'mm', default: 650 },
    { key: 'heightMm', kind: 'mm', default: 1850 },
  ],
};

const placedFridge: Extract<Element, { kind: 'placed_asset' }> = {
  kind: 'placed_asset',
  id: 'pa-fridge',
  name: 'Kitchen fridge',
  assetId: 'asset-fridge',
  levelId: 'lvl',
  positionMm: { xMm: 1200, yMm: 2400 },
  rotationDeg: 90,
  paramValues: {},
};

describe('placed asset rendering', () => {
  it('classifies fridge assets from catalog metadata', () => {
    expect(classifyPlacedAssetSymbol(fridgeEntry, placedFridge)).toBe('fridge');
  });

  it('uses explicit symbol kinds before name/tag fallback', () => {
    expect(
      classifyPlacedAssetSymbol(
        { ...fridgeEntry, name: 'Kitchen Appliance', tags: [], planSymbolKind: 'oven' },
        placedFridge,
      ),
    ).toBe('oven');
  });

  it('resolves fridge dimensions from param schema defaults', () => {
    const spec = resolvePlacedAssetRenderSpec(placedFridge, fridgeEntry);
    expect(spec.symbolKind).toBe('fridge');
    expect(spec.widthM).toBeCloseTo(0.6);
    expect(spec.depthM).toBeCloseTo(0.65);
    expect(spec.heightM).toBeCloseTo(1.85);
  });

  it('builds a 3D fridge mesh at the placed asset level elevation', () => {
    const group = makePlacedAssetMesh(
      placedFridge,
      { lvl: level, 'asset-fridge': fridgeEntry, 'pa-fridge': placedFridge },
      null,
    );

    expect(group.position.x).toBeCloseTo(1.2);
    expect(group.position.y).toBeCloseTo(3);
    expect(group.position.z).toBeCloseTo(2.4);
    expect(group.userData.assetSymbolKind).toBe('fridge');

    let meshCount = 0;
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.bimPickId === 'pa-fridge') meshCount += 1;
    });
    expect(meshCount).toBeGreaterThan(1);
  });
});
