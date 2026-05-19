import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import { collectElementRenderFeatureStatuses } from './elementRenderFeatureStatus';

function byId(statuses: ReturnType<typeof collectElementRenderFeatureStatuses>) {
  return Object.fromEntries(statuses.map((status) => [status.elementId, status]));
}

describe('element render feature status', () => {
  it('reports hosted door dimensions, material slots, and lens ghosting deterministically', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
      discipline: 'arch',
    };
    const doorType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'door-type-1',
      name: 'Office door',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 920, leafHeightMm: 2140 },
    };
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'door-1',
      name: 'Door',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 900,
      familyTypeId: doorType.id,
      operationType: 'sliding_double',
      materialKey: 'aluminium_dark_grey',
      materialSlots: {
        frame: 'aluminium_black',
        panel: 'cladding_warm_wood',
        threshold: 'concrete_smooth',
        hardware: 'asset_stainless_brushed',
      },
      discipline: 'arch',
    };

    const statuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [wall, doorType, door],
        elementIds: [door.id],
        lensMode: 'structure',
      }),
    );

    expect(statuses['door-1']).toMatchObject({
      format: 'elementRenderFeatureStatus_v1',
      elementId: 'door-1',
      kind: 'door',
      material: {
        state: 'resolved',
        materialKey: 'aluminium_black',
        fallback: false,
      },
      family: {
        state: 'partial',
        familyTypeId: 'door-type-1',
        familyId: 'builtin:door:single',
        dimensionSource: 'family-type',
        dimensionsMm: { widthMm: 920, heightMm: 2140 },
        supportedSlots: ['frame', 'panel', 'threshold', 'hardware'],
        missingSlots: ['glass'],
        proxyFallback: false,
      },
      lens: {
        mode: 'structure',
        source: 'ui-lens',
        visibility: 'ghost',
        ghostingSupported: true,
        ghostOpacity: 0.25,
      },
    });
    expect(statuses['door-1']?.family.supportedOperations).toContain('sliding_double');
    expect(statuses['door-1']?.skippedSubfeatures).toContain('family.material_slot_glass_fallback');
  });

  it('reports window subcomponent defaults and saved-view lens foreground status', () => {
    const windowType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'window-type-1',
      name: 'Fixed window',
      familyId: 'builtin:window:fixed',
      discipline: 'window',
      parameters: { widthMm: 1500, heightMm: 1200, sillMm: 850 },
    };
    const win: Extract<Element, { kind: 'window' }> = {
      kind: 'window',
      id: 'win-1',
      name: 'Window',
      wallId: 'wall-1',
      alongT: 0.35,
      widthMm: 1200,
      heightMm: 1000,
      sillHeightMm: 900,
      familyTypeId: windowType.id,
      materialSlots: { frame: 'aluminium_natural' },
      discipline: 'arch',
    };

    const status = collectElementRenderFeatureStatuses({
      elements: [windowType, win],
      elementIds: [win.id],
      viewLensMode: 'show_arch',
    })[0];

    expect(status).toMatchObject({
      material: {
        state: 'fallback',
        slots: expect.arrayContaining([
          expect.objectContaining({ slot: 'frame', materialKey: 'aluminium_natural' }),
          expect.objectContaining({
            slot: 'glass',
            materialKey: 'asset_clear_glass_double',
            fallback: true,
          }),
        ]),
      },
      family: {
        state: 'partial',
        dimensionSource: 'family-type',
        dimensionsMm: { widthMm: 1500, heightMm: 1200, sillHeightMm: 850 },
      },
      lens: {
        mode: 'show_arch',
        source: 'view-lens',
        visibility: 'foreground',
        ghostOpacity: null,
      },
    });
    expect(status?.family.missingSlots).toEqual(['shading']);
  });

  it('reports loaded family proxy fallback and missing family type without UI dependencies', () => {
    const familyType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'chair-type-1',
      name: 'Catalog chair',
      familyId: 'catalog:chair',
      discipline: 'generic',
      parameters: {
        widthMm: 500,
        depthMm: 520,
      },
    };
    const chair: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'chair-1',
      name: 'Chair',
      familyTypeId: familyType.id,
      positionMm: { xMm: 1000, yMm: 1200 },
      paramValues: { widthMm: 540 },
      discipline: 'arch',
    };
    const missing: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'missing-family-1',
      name: 'Missing family',
      familyTypeId: 'missing-type',
      positionMm: { xMm: 0, yMm: 0 },
      discipline: 'mep',
    };

    const statuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [familyType, chair, missing],
        elementIds: [chair.id, missing.id],
        lensMode: 'mep',
      }),
    );

    expect(statuses['chair-1']).toMatchObject({
      family: {
        state: 'unsupported',
        familyTypeId: 'chair-type-1',
        familyId: 'catalog:chair',
        dimensionSource: 'override',
        dimensionsMm: { depthMm: 520, widthMm: 540 },
        proxyFallback: true,
        skippedSubfeatures: expect.arrayContaining([
          'family.definition_not_found',
          'family.model_geometry_proxy_fallback',
          'family.plan_symbol_footprint_fallback',
        ]),
      },
      lens: { visibility: 'ghost' },
    });
    expect(statuses['missing-family-1']).toMatchObject({
      family: {
        state: 'unsupported',
        familyTypeId: 'missing-type',
        proxyFallback: true,
        skippedSubfeatures: ['family.family_type_not_found', 'family.proxy_fallback'],
      },
      lens: { visibility: 'foreground' },
    });
  });

  it('reports placed asset render proxy status and unsupported asset fallbacks', () => {
    const entry: Extract<Element, { kind: 'asset_library_entry' }> = {
      kind: 'asset_library_entry',
      id: 'asset-bed',
      assetKind: 'block_2d',
      name: 'Bed marker',
      tags: ['bedroom'],
      category: 'furniture',
      thumbnailKind: 'schematic_plan',
      planSymbolKind: 'bed',
      renderProxyKind: 'bed',
    };
    const bed: Extract<Element, { kind: 'placed_asset' }> = {
      kind: 'placed_asset',
      id: 'placed-bed',
      name: 'Placed bed',
      assetId: entry.id,
      levelId: 'level-upper',
      positionMm: { xMm: 1200, yMm: 1400 },
    };
    const missing: Extract<Element, { kind: 'placed_asset' }> = {
      ...bed,
      id: 'placed-missing',
      assetId: 'missing-asset',
    };

    const statuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [entry, bed, missing],
        elementIds: [bed.id, missing.id],
      }),
    );

    expect(statuses['placed-bed']).toMatchObject({
      asset: {
        state: 'partial',
        assetId: 'asset-bed',
        assetKind: 'block_2d',
        renderProxyKind: 'bed',
        proxyFallback: false,
        skippedSubfeatures: ['asset.procedural_proxy_render'],
      },
      implementation: {
        geometryImplementation: 'procedural-proxy',
      },
      exportSupport: {
        state: 'partial',
      },
      blocking: false,
    });
    expect(statuses['placed-missing']).toMatchObject({
      asset: {
        state: 'unsupported',
        assetId: 'missing-asset',
        proxyFallback: true,
        skippedSubfeatures: ['asset.asset_entry_not_found', 'asset.proxy_fallback'],
      },
      implementation: {
        state: 'unsupported',
        geometryImplementation: 'proxy-fallback',
      },
      diagnosticCodes: expect.arrayContaining(['renderer.asset_instance.unsupported']),
      blocking: true,
    });
  });
});
