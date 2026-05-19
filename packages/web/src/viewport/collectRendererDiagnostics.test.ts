import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  collectRendererDiagnosticPacket,
  collectRendererDiagnostics,
} from './collectRendererDiagnostics';

function wall(
  overrides: Partial<Extract<Element, { kind: 'wall' }>> = {},
): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id: 'wall-1',
    name: 'Wall',
    levelId: 'level-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 6000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 3000,
    ...overrides,
  };
}

function door(
  overrides: Partial<Extract<Element, { kind: 'door' }>> = {},
): Extract<Element, { kind: 'door' }> {
  return {
    kind: 'door',
    id: 'door-1',
    name: 'Door',
    wallId: 'wall-1',
    alongT: 0.5,
    widthMm: 900,
    ...overrides,
  };
}

describe('collectRendererDiagnostics', () => {
  it('normalizes roof, wall, slab, stair, and railing diagnostics into the common contract', () => {
    const level0 = {
      kind: 'level',
      id: 'level-0',
      name: 'Level 0',
      elevationMm: 0,
    } satisfies Extract<Element, { kind: 'level' }>;
    const level1 = {
      kind: 'level',
      id: 'level-1',
      name: 'Level 1',
      elevationMm: 3000,
    } satisfies Extract<Element, { kind: 'level' }>;
    const roof = {
      kind: 'roof',
      id: 'hf-roof-main',
      name: 'Target-house folded asymmetric shell',
      referenceLevelId: level1.id,
      roofGeometryMode: 'asymmetric_gable',
      ridgeAxis: 'z',
      ridgeOffsetTransverseMm: 450,
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 8000, yMm: 0 },
        { xMm: 8000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ],
    } satisfies Extract<Element, { kind: 'roof' }>;
    const roofOpening = {
      kind: 'roof_opening',
      id: 'hf-roof-court-opening',
      name: 'target-house terrace court cutout',
      hostRoofId: roof.id,
      boundaryMm: [
        { xMm: 6000, yMm: 1000 },
        { xMm: 7900, yMm: 1000 },
        { xMm: 7900, yMm: 3000 },
        { xMm: 6000, yMm: 3000 },
      ],
      props: { occupiedRoofVoid: true },
    } as Extract<Element, { kind: 'roof_opening' }>;
    const upperFloor = {
      kind: 'floor',
      id: 'upper-floor',
      name: 'Upper floor',
      levelId: level1.id,
      boundaryMm: [
        { xMm: -1000, yMm: -1000 },
        { xMm: 5000, yMm: -1000 },
        { xMm: 5000, yMm: 5000 },
        { xMm: -1000, yMm: 5000 },
      ],
      thicknessMm: 250,
    } as Extract<Element, { kind: 'floor' }>;
    const stair = {
      kind: 'stair',
      id: 'main-stair',
      name: 'Main stair',
      baseLevelId: level0.id,
      topLevelId: level1.id,
      shape: 'straight',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
      widthMm: 1000,
    } as Extract<Element, { kind: 'stair' }>;

    const diagnostics = collectRendererDiagnostics({
      elements: [
        level0,
        level1,
        roof,
        roofOpening,
        wall(),
        door({ id: 'uncut-door' }),
        upperFloor,
        stair,
      ],
      csgEnabled: false,
      viewId: 'target-house-evidence',
      evidence: { gitHead: 'abc123', rendererBuild: 'test-renderer' },
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: 'rendererDiagnostic_v1',
          code: 'renderer.roof_opening.analytic.cut.unsupported',
          issueClass: 'renderer-unsupported',
          feature: 'roof-opening',
          elementIds: ['hf-roof-court-opening', 'hf-roof-main'],
          viewId: 'target-house-evidence',
        }),
        expect.objectContaining({
          code: 'renderer.wall_cut.wall.opening.csg.disabled',
          issueClass: 'renderer-unsupported',
          feature: 'wall-cut',
          elementIds: ['uncut-door', 'wall-1'],
        }),
        expect.objectContaining({
          code: 'renderer.stair_geometry.floor_penetration_without_slab_opening',
          issueClass: 'model-invalid',
          feature: 'stair-geometry',
          elementIds: ['main-stair', 'upper-floor'],
        }),
      ]),
    );
  });

  it('builds a renderer diagnostic packet with persistence context', () => {
    const packet = collectRendererDiagnosticPacket({
      elements: [door({ id: 'floating-door', wallId: 'missing-wall' })],
      generatedAtIso: '2026-05-19T00:00:00.000Z',
      modelRevision: 7,
      gitHead: 'abc123',
      rendererBuild: 'viewport-test',
      viewId: 'hosted-opening-evidence',
    });

    expect(packet).toMatchObject({
      format: 'rendererDiagnosticPacket_v1',
      generatedAtIso: '2026-05-19T00:00:00.000Z',
      modelRevision: 7,
      gitHead: 'abc123',
      rendererBuild: 'viewport-test',
      viewId: 'hosted-opening-evidence',
    });
    expect(packet.supportMatrixDigest).toMatch(/^rsm-[0-9a-f]{8}$/);
    expect(packet.elementRenderStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: 'elementRenderFeatureStatus_v1',
          elementId: 'floating-door',
          geometry: expect.objectContaining({
            feature: 'hosted-opening-cut',
            implementation: 'analytic-cut',
          }),
        }),
      ]),
    );
    expect(packet.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'renderer.wall_cut.wall.host.not.found',
          issueClass: 'model-invalid',
          elementIds: ['floating-door', 'missing-wall'],
        }),
        expect.objectContaining({
          code: 'renderer.wall_cut.detached_or_proxy_render_risk',
          issueClass: 'renderer-degraded',
          elementIds: ['floating-door', 'missing-wall'],
          trackerItems: expect.arrayContaining(['BIR-C08']),
        }),
      ]),
    );
  });

  it('normalizes status-derived geometry blockers for wall, roof, stair, and railing classes', () => {
    const elements = [
      wall({
        id: 'wall-degenerate',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 0, yMm: 0 },
      }),
      {
        kind: 'roof',
        id: 'roof-folded-shell',
        name: 'Folded shell',
        referenceLevelId: 'level-1',
        roofGeometryMode: 'folded_shell',
        footprintMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 5000, yMm: 0 },
          { xMm: 5000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      } as unknown as Extract<Element, { kind: 'roof' }>,
      {
        kind: 'stair',
        id: 'stair-winder',
        name: 'Winder',
        baseLevelId: 'level-1',
        topLevelId: 'level-2',
        shape: 'winder',
        runStartMm: { xMm: 0, yMm: 0 },
        runEndMm: { xMm: 2000, yMm: 0 },
        widthMm: 900,
        riserMm: 175,
        treadMm: 280,
      } as unknown as Extract<Element, { kind: 'stair' }>,
      {
        kind: 'railing',
        id: 'rail-edge-missing',
        name: 'Guard',
        levelId: 'level-2',
        pathMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 2000, yMm: 0 },
        ],
        props: { requiresHostedEdge: true },
      } as Extract<Element, { kind: 'railing' }>,
    ];

    const diagnostics = collectRendererDiagnostics({
      elements,
      viewId: 'geometry-status-golden',
      evidence: { source: 'test' },
    });
    const byCode = Object.fromEntries(
      diagnostics.map((diagnostic) => [diagnostic.code, diagnostic]),
    );

    expect(byCode['renderer.wall_geometry.degenerate']).toMatchObject({
      issueClass: 'model-invalid',
      feature: 'wall-cut',
      elementIds: ['wall-degenerate'],
      trackerItems: ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J01'],
    });
    expect(byCode['renderer.roof_geometry.unsupported']).toMatchObject({
      issueClass: 'renderer-unsupported',
      feature: 'roof-opening',
      elementIds: ['roof-folded-shell'],
      trackerItems: ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J02'],
    });
    expect(byCode['renderer.stair_geometry.unsupported_shape']).toMatchObject({
      issueClass: 'renderer-unsupported',
      feature: 'stair-geometry',
      elementIds: ['stair-winder'],
    });
    expect(byCode['renderer.railing_geometry.missing_host_edge']).toMatchObject({
      issueClass: 'model-invalid',
      feature: 'railing-geometry',
      elementIds: ['rail-edge-missing'],
    });
  });

  it('surfaces per-element material, family, and asset render-status blockers as diagnostics', () => {
    const familyInstance = {
      kind: 'family_instance',
      id: 'proxy-chair',
      name: 'Proxy chair',
      familyTypeId: 'missing-family-type',
      positionMm: { xMm: 0, yMm: 0 },
    } satisfies Extract<Element, { kind: 'family_instance' }>;
    const placedAsset = {
      kind: 'placed_asset',
      id: 'target-house-missing-asset',
      name: 'Target-house missing furniture marker',
      assetId: 'missing-asset',
      levelId: 'level-1',
      positionMm: { xMm: 1000, yMm: 1000 },
    } satisfies Extract<Element, { kind: 'placed_asset' }>;
    const wallWithUnknownMaterial = wall({
      id: 'wall-unknown-material',
      materialKey: 'missing-material-key',
    });

    const diagnostics = collectRendererDiagnostics({
      elements: [familyInstance, placedAsset, wallWithUnknownMaterial],
      viewId: 'target-house-render-status-golden',
      evidence: { source: 'test' },
    });
    const byCode = Object.fromEntries(
      diagnostics.map((diagnostic) => [diagnostic.code, diagnostic]),
    );

    expect(byCode['renderer.family_instance.unsupported']).toMatchObject({
      severity: 'error',
      issueClass: 'renderer-unsupported',
      feature: 'family-instance',
      elementIds: ['proxy-chair'],
      trackerItems: ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J05'],
    });
    expect(byCode['renderer.asset_instance.unsupported']).toMatchObject({
      severity: 'error',
      issueClass: 'renderer-unsupported',
      feature: 'asset-instance',
      elementIds: ['target-house-missing-asset'],
    });
    expect(byCode['renderer.material.unresolved']).toMatchObject({
      severity: 'error',
      rendererArea: 'materials',
      feature: 'material-resolution',
      elementIds: ['wall-unknown-material'],
      evidence: expect.objectContaining({
        details: expect.objectContaining({
          materialState: 'unresolved',
          blocking: true,
        }),
      }),
    });
  });

  it('reports room, space-overlay, and room-separation failures before screenshots hide them', () => {
    const level = {
      kind: 'level',
      id: 'level-1',
      name: 'Level 1',
      elevationMm: 0,
    } satisfies Extract<Element, { kind: 'level' }>;
    const floor = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor 1',
      levelId: level.id,
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 5000 },
        { xMm: 0, yMm: 5000 },
      ],
      thicknessMm: 250,
    } as Extract<Element, { kind: 'floor' }>;
    const room = {
      kind: 'room',
      id: 'room-dropped',
      name: '',
      levelId: level.id,
      outlineMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 1000, yMm: 1000 },
      ],
      props: { render3dVolume: true },
    } as Extract<Element, { kind: 'room' }>;
    const separation = {
      kind: 'room_separation',
      id: 'sep-dropped',
      name: 'Dropped separation',
      levelId: 'missing-level',
      start: { xMm: 2000, yMm: 2000 },
      end: { xMm: 2000, yMm: 2000 },
    } satisfies Extract<Element, { kind: 'room_separation' }>;

    const diagnostics = collectRendererDiagnostics({
      elements: [level, floor, room, separation],
      viewId: 'room-visualization-golden',
      evidence: { source: 'test' },
    });
    const byCode = Object.fromEntries(
      diagnostics.map((diagnostic) => [diagnostic.code, diagnostic]),
    );

    expect(byCode['renderer.room_visualization.degenerate_outline']).toMatchObject({
      issueClass: 'model-invalid',
      feature: 'room-visualization',
      elementIds: ['room-dropped'],
      trackerItems: ['BIR-I02', 'BIR-I03', 'BIR-I04', 'BIR-J06'],
    });
    expect(byCode['renderer.room_visualization.volume_unsupported']).toMatchObject({
      issueClass: 'renderer-unsupported',
      rendererArea: 'viewport-3d',
      elementIds: ['room-dropped'],
    });
    expect(byCode['renderer.room_visualization.missing_name']).toMatchObject({
      issueClass: 'renderer-degraded',
      rendererArea: 'plan',
      elementIds: ['room-dropped'],
    });
    expect(byCode['renderer.room_separation.missing_level']).toMatchObject({
      issueClass: 'model-invalid',
      elementIds: ['missing-level', 'sep-dropped'],
    });
    expect(byCode['renderer.room_separation.degenerate_segment']).toMatchObject({
      issueClass: 'model-invalid',
      elementIds: ['sep-dropped'],
    });
  });

  it('goldens target-house rooms, room separations, slab openings, and hosted-cut fallback diagnostics', () => {
    const snapshotPath = resolve(
      process.cwd(),
      '../../seed-artifacts/target-house-1/evidence/live-run-current/snapshot.json',
    );
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      elements: Record<string, Element>;
    };
    const elements = Object.values(snapshot.elements);
    const criticalKinds = new Set(['room', 'room_separation', 'slab_opening', 'door', 'window']);
    const counts = elements.reduce<Record<string, number>>((acc, element) => {
      if (criticalKinds.has(element.kind)) acc[element.kind] = (acc[element.kind] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.room).toBeGreaterThanOrEqual(10);
    expect(counts.room_separation).toBeGreaterThan(0);
    expect(counts.slab_opening).toBeGreaterThan(0);
    expect((counts.door ?? 0) + (counts.window ?? 0)).toBeGreaterThan(0);

    const diagnostics = collectRendererDiagnostics({
      elements,
      viewId: 'target-house-renderer-golden',
      evidence: { source: 'test', artifactPath: snapshotPath },
      csgEnabled: true,
    });
    const roomAndSlabCodes = diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.code.startsWith('renderer.room') ||
          diagnostic.code.startsWith('renderer.slab_opening'),
      )
      .map((diagnostic) => diagnostic.code);
    const hostedCutDiagnostics = diagnostics.filter((diagnostic) =>
      diagnostic.code.startsWith('renderer.wall_cut'),
    );
    const hostedCutCodeCounts = hostedCutDiagnostics.reduce<Record<string, number>>(
      (acc, diagnostic) => {
        acc[diagnostic.code] = (acc[diagnostic.code] ?? 0) + 1;
        return acc;
      },
      {},
    );

    expect(roomAndSlabCodes).toEqual([]);
    expect(hostedCutCodeCounts).toEqual({
      'renderer.wall_cut.detached_or_proxy_render_risk': 6,
      'renderer.wall_cut.wall.opening.csg.skipped.by.curtain.wall': 6,
    });
    expect(hostedCutDiagnostics.every((diagnostic) => diagnostic.severity === 'warning')).toBe(
      true,
    );
    expect(
      hostedCutDiagnostics.every((diagnostic) =>
        ['renderer-degraded', 'renderer-unsupported'].includes(diagnostic.issueClass),
      ),
    ).toBe(true);
  });
});
