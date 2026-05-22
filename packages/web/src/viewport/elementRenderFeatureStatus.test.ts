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
        // Missing material slots no longer degrade family.state to 'partial' —
        // that overlapped with material.state. See realistic-3d-partial-status-tracker.md.
        state: 'supported',
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
        // Missing material slots no longer degrade family.state — see tracker.
        state: 'supported',
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

  it('proves W25-A material, family, and lens status closure in one packet shape', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-w25-a',
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
      id: 'door-type-w25-a',
      name: 'Pivot door',
      familyId: 'builtin:door:single',
      discipline: 'door',
      parameters: { leafWidthMm: 1000, leafHeightMm: 2400 },
    };
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'door-w25-a',
      name: 'Door',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 900,
      familyTypeId: doorType.id,
      operationType: 'pivot',
      materialKey: 'aluminium_black',
      materialSlots: {
        frame: 'aluminium_black',
        panel: 'cladding_warm_wood',
        threshold: 'concrete_smooth',
        hardware: 'asset_stainless_brushed',
        glass: 'asset_clear_glass_double',
      },
      discipline: 'arch',
    };
    const familyType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'proxy-family-type',
      name: 'Proxy family',
      familyId: 'catalog:unloaded',
      discipline: 'generic',
      parameters: { widthMm: 500, heightMm: 700 },
    };
    const instance: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'family-proxy-w25-a',
      name: 'Proxy family',
      familyTypeId: familyType.id,
      positionMm: { xMm: 1000, yMm: 1000 },
      paramValues: { widthMm: 650 },
      discipline: 'mep',
    };

    const statuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [wall, doorType, door, familyType, instance],
        elementIds: [door.id, instance.id],
        lensMode: 'mep',
      }),
    );

    expect(statuses['door-w25-a']).toMatchObject({
      material: {
        state: 'resolved',
        fallback: false,
        slots: expect.arrayContaining([
          expect.objectContaining({ slot: 'frame', resolved: true }),
          expect.objectContaining({ slot: 'glass', resolved: true }),
        ]),
      },
      family: {
        state: 'supported',
        dimensionSource: 'family-type',
        dimensionsMm: { widthMm: 1000, heightMm: 2400 },
        supportedSlots: ['frame', 'panel', 'threshold', 'hardware', 'glass'],
        missingSlots: [],
        proxyFallback: false,
      },
      lens: {
        mode: 'mep',
        source: 'ui-lens',
        visibility: 'ghost',
        ghostOpacity: 0.25,
      },
      blocking: false,
    });
    expect(statuses['door-w25-a']?.family.supportedOperations).toContain('pivot');
    expect(statuses['family-proxy-w25-a']).toMatchObject({
      family: {
        state: 'unsupported',
        dimensionSource: 'override',
        dimensionsMm: { heightMm: 700, widthMm: 650 },
        proxyFallback: true,
      },
      lens: {
        mode: 'mep',
        visibility: 'foreground',
      },
      implementation: {
        state: 'unsupported',
        geometryImplementation: 'proxy-fallback',
      },
      diagnosticCodes: expect.arrayContaining(['renderer.family_instance.unsupported']),
      blocking: true,
    });
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
        // block_2d procedural proxies render correctly when renderProxyKind is
        // set — that no longer downgrades the viewport-3d state. exportSupport
        // still flags placed_asset as partial across the export surface.
        state: 'supported',
        assetId: 'asset-bed',
        assetKind: 'block_2d',
        renderProxyKind: 'bed',
        proxyFallback: false,
        skippedSubfeatures: [],
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

  it('reports geometry render status across wall, opening, roof, stair, railing, and room classes', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-degenerate',
      name: 'Degenerate wall',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };
    const opening: Extract<Element, { kind: 'wall_opening' }> = {
      kind: 'wall_opening',
      id: 'opening-status',
      name: 'Opening',
      hostWallId: wall.id,
      alongTStart: 0.4,
      alongTEnd: 0.55,
      sillHeightMm: 0,
      headHeightMm: 2100,
    };
    const roof = {
      kind: 'roof',
      id: 'roof-unsupported',
      name: 'Unsupported roof',
      referenceLevelId: 'level-1',
      roofGeometryMode: 'folded_shell',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
    } as unknown as Extract<Element, { kind: 'roof' }>;
    const stair = {
      kind: 'stair',
      id: 'stair-unsupported-shape',
      name: 'Unsupported stair',
      baseLevelId: 'level-1',
      topLevelId: 'level-2',
      shape: 'winder',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 2000, yMm: 0 },
      widthMm: 900,
      riserMm: 175,
      treadMm: 280,
    } as unknown as Extract<Element, { kind: 'stair' }>;
    const railing = {
      kind: 'railing',
      id: 'rail-missing-edge',
      name: 'Guard',
      levelId: 'level-2',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
      ],
      props: { requiresHostedEdge: true },
    } as Extract<Element, { kind: 'railing' }>;
    const regularRailing = {
      kind: 'railing',
      id: 'rail-regular-edge',
      name: 'Regular edge guard',
      levelId: 'level-2',
      hostFloorId: 'floor-upper',
      hostEdgeId: 'floor-upper:edge:south',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
      ],
      balusterPattern: { rule: 'regular', spacingMm: 100 },
      props: { requiresHostedEdge: true },
    } as unknown as Extract<Element, { kind: 'railing' }>;
    const room = {
      kind: 'room',
      id: 'room-volume',
      name: 'Room',
      levelId: 'level-1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      props: { render3dVolume: true },
    } as Extract<Element, { kind: 'room' }>;

    const statuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [wall, opening, roof, stair, railing, regularRailing, room],
      }),
    );

    expect(statuses['wall-degenerate']).toMatchObject({
      geometry: {
        state: 'unsupported',
        feature: 'wall-geometry',
        diagnosticCodes: ['renderer.wall_geometry.degenerate'],
        blocking: true,
      },
      diagnosticCodes: expect.arrayContaining(['renderer.wall_geometry.degenerate']),
    });
    expect(statuses['opening-status']).toMatchObject({
      // Hosted-opening cuts render correctly in 3D when CSG succeeds — the
      // BIR-I "parity_partial" claim now lives on exportSupport only, so the
      // chip shows 'supported'.
      geometry: {
        state: 'supported',
        feature: 'hosted-opening-cut',
        implementation: 'analytic-cut',
      },
      exportSupport: { state: 'partial' },
    });
    expect(statuses['roof-unsupported']).toMatchObject({
      geometry: {
        state: 'unsupported',
        diagnosticCodes: ['renderer.roof_geometry.unsupported'],
        blocking: true,
      },
    });
    const supportedRoofStatuses = byId(
      collectElementRenderFeatureStatuses({
        elements: [
          {
            kind: 'roof',
            id: 'roof-gable-rectangle',
            name: 'Supported gable roof',
            referenceLevelId: 'level-1',
            roofGeometryMode: 'gable_pitched_rectangle',
            footprintMm: [
              { xMm: 0, yMm: 0 },
              { xMm: 5000, yMm: 0 },
              { xMm: 5000, yMm: 3000 },
              { xMm: 0, yMm: 3000 },
            ],
            materialKey: 'roof_tiles_unknown',
          } as Extract<Element, { kind: 'roof' }>,
        ],
      }),
    );
    expect(supportedRoofStatuses['roof-gable-rectangle']).toMatchObject({
      // Known roof modes (gable_pitched_rectangle, hip, mono_slope, etc.) have
      // working mesh builders and now report 'supported' in 3D.
      geometry: {
        state: 'supported',
        diagnosticCodes: [],
        blocking: false,
      },
      material: {
        state: 'resolved',
        materialKey: 'roof_tiles_unknown',
      },
    });
    expect(statuses['stair-unsupported-shape']).toMatchObject({
      geometry: {
        state: 'unsupported',
        diagnosticCodes: ['renderer.stair_geometry.unsupported_shape'],
      },
    });
    expect(statuses['rail-missing-edge']).toMatchObject({
      geometry: {
        state: 'unsupported',
        diagnosticCodes: ['renderer.railing_geometry.missing_host_edge'],
      },
    });
    expect(statuses['rail-regular-edge']).toMatchObject({
      // Railings with a known baluster rule and a valid host edge render
      // correctly in 3D — they no longer blanket-degrade to 'partial'.
      geometry: {
        state: 'supported',
        diagnosticCodes: [],
        blocking: false,
      },
    });
    expect(statuses['room-volume']).toMatchObject({
      geometry: {
        state: 'partial',
        implementation: 'diagnostic-overlay',
        diagnosticCodes: ['renderer.room_visualization.volume_unsupported'],
        blocking: false,
      },
      implementation: {
        geometryImplementation: 'diagnostic-overlay',
      },
    });
  });
});
