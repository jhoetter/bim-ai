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
    expect(packet.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'renderer.wall_cut.wall.host.not.found',
          issueClass: 'model-invalid',
          elementIds: ['floating-door', 'missing-wall'],
        }),
      ]),
    );
  });
});
