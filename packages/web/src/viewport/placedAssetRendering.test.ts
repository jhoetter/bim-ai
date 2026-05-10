import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import {
  classifyPlacedAssetSymbol,
  makePlacedAssetMesh,
  makePlacedAssetPlanSymbol,
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

  it('classifies legacy bedroom and storage asset names without explicit metadata', () => {
    const bedEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...fridgeEntry,
      id: 'asset-bed',
      name: 'Queen Bed',
      tags: [],
      planSymbolKind: undefined,
      renderProxyKind: undefined,
    };
    const wardrobeEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...fridgeEntry,
      id: 'asset-wardrobe',
      name: 'Bedroom Wardrobe',
      tags: [],
      planSymbolKind: undefined,
      renderProxyKind: undefined,
    };

    expect(classifyPlacedAssetSymbol(bedEntry, placedFridge)).toBe('bed');
    expect(classifyPlacedAssetSymbol(wardrobeEntry, placedFridge)).toBe('wardrobe');
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

  it.each([
    ['bed', 'Queen Bed 1800x2100', { widthMm: 1800, depthMm: 2100, heightMm: 600 }],
    ['wardrobe', 'Wardrobe 1800x620', { widthMm: 1800, depthMm: 620, heightMm: 2200 }],
    ['lamp', 'Floor Lamp 1700', { diameterMm: 450, heightMm: 1700 }],
    ['rug', 'Area Rug 2400x1700', { widthMm: 2400, depthMm: 1700, heightMm: 25 }],
  ] as const)('resolves and renders %s furniture assets', (kind, name, params) => {
    const entry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...fridgeEntry,
      id: `asset-${kind}`,
      name,
      category: kind === 'wardrobe' ? 'casework' : 'furniture',
      tags: [kind],
      thumbnailWidthMm: 'diameterMm' in params ? params.diameterMm : params.widthMm,
      thumbnailHeightMm: 'diameterMm' in params ? params.diameterMm : params.depthMm,
      planSymbolKind: kind,
      renderProxyKind: kind,
      paramSchema: Object.entries(params).map(([key, value]) => ({
        key,
        kind: 'mm',
        default: value,
      })),
    };
    const asset: Extract<Element, { kind: 'placed_asset' }> = {
      ...placedFridge,
      id: `pa-${kind}`,
      name,
      assetId: entry.id,
      paramValues: {},
    };

    const spec = resolvePlacedAssetRenderSpec(asset, entry);
    const plan = makePlacedAssetPlanSymbol(asset, entry);
    const mesh = makePlacedAssetMesh(
      asset,
      { lvl: level, [entry.id]: entry, [asset.id]: asset },
      null,
    );

    expect(classifyPlacedAssetSymbol(entry, asset)).toBe(kind);
    expect(spec.symbolKind).toBe(kind);
    expect(plan.userData.assetSymbolKind).toBe(kind);
    expect(mesh.userData.assetSymbolKind).toBe(kind);

    let planMeshCount = 0;
    plan.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.bimPickId === asset.id) planMeshCount += 1;
    });
    expect(planMeshCount).toBeGreaterThan(0);

    let meshCount = 0;
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.bimPickId === asset.id) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThan(1);
  });

  it('renders a composite kitchen slab with sink and fridge offsets', () => {
    const entry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...fridgeEntry,
      id: 'asset-kitchen-layout',
      name: 'Kitchen Slab Layout',
      category: 'kitchen',
      tags: ['kitchen', 'counter', 'sink', 'fridge', 'layout'],
      thumbnailWidthMm: 3000,
      thumbnailHeightMm: 650,
      planSymbolKind: 'counter',
      renderProxyKind: 'counter',
      paramSchema: [
        { key: 'widthMm', kind: 'mm', default: 3000 },
        { key: 'depthMm', kind: 'mm', default: 650 },
        { key: 'heightMm', kind: 'mm', default: 900 },
        { key: 'sinkOffsetMm', kind: 'mm', default: 1500 },
        { key: 'fridgeOffsetMm', kind: 'mm', default: 350 },
      ],
    };
    const asset: Extract<Element, { kind: 'placed_asset' }> = {
      ...placedFridge,
      id: 'pa-kitchen-layout',
      assetId: entry.id,
      paramValues: { sinkOffsetMm: 1700 },
    };

    const spec = resolvePlacedAssetRenderSpec(asset, entry);
    const plan = makePlacedAssetPlanSymbol(asset, entry);
    const mesh = makePlacedAssetMesh(asset, { lvl: level, [entry.id]: entry }, null);

    expect(spec.symbolKind).toBe('counter');
    expect(spec.kitchenLayout).toBe(true);
    expect(spec.sinkOffsetM).toBeCloseTo(1.7);
    expect(plan.children.length).toBeGreaterThan(6);
    expect(mesh.userData.assetSymbolKind).toBe('counter');
  });

  it('renders a composite bathroom layout symbol and proxy', () => {
    const entry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...fridgeEntry,
      id: 'asset-bath-layout',
      name: 'Compact Bathroom Layout',
      category: 'bathroom',
      tags: ['bathroom', 'toilet', 'sink', 'shower', 'layout'],
      thumbnailWidthMm: 2400,
      thumbnailHeightMm: 2200,
      planSymbolKind: 'bathroom_layout',
      renderProxyKind: 'bathroom_layout',
      paramSchema: [
        { key: 'widthMm', kind: 'mm', default: 2400 },
        { key: 'depthMm', kind: 'mm', default: 2200 },
        { key: 'heightMm', kind: 'mm', default: 2100 },
        { key: 'showerOffsetMm', kind: 'mm', default: 450 },
        { key: 'toiletOffsetMm', kind: 'mm', default: 1180 },
        { key: 'vanityOffsetMm', kind: 'mm', default: 1900 },
      ],
    };
    const asset: Extract<Element, { kind: 'placed_asset' }> = {
      ...placedFridge,
      id: 'pa-bath-layout',
      assetId: entry.id,
      paramValues: { vanityOffsetMm: 2000 },
    };

    const spec = resolvePlacedAssetRenderSpec(asset, entry);
    const plan = makePlacedAssetPlanSymbol(asset, entry);
    const mesh = makePlacedAssetMesh(asset, { lvl: level, [entry.id]: entry }, null);

    expect(classifyPlacedAssetSymbol(entry, asset)).toBe('bathroom_layout');
    expect(spec.symbolKind).toBe('bathroom_layout');
    expect(spec.vanityOffsetM).toBeCloseTo(2);
    expect(plan.userData.assetSymbolKind).toBe('bathroom_layout');
    expect(mesh.userData.assetSymbolKind).toBe('bathroom_layout');
  });
});
