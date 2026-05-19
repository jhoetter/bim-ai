import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { diagnoseVerticalCirculationRendering } from './verticalCirculationRenderDiagnostics';

type FloorElem = Extract<Element, { kind: 'floor' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;
type RailingElem = Extract<Element, { kind: 'railing' }>;
type SlabOpeningElem = Extract<Element, { kind: 'slab_opening' }>;
type StairElem = Extract<Element, { kind: 'stair' }>;

const ground: LevelElem = { kind: 'level', id: 'level-ground', name: 'Ground', elevationMm: 0 };
const upper: LevelElem = { kind: 'level', id: 'level-upper', name: 'Upper', elevationMm: 3000 };

const baseFloor: FloorElem = {
  kind: 'floor',
  id: 'floor-ground',
  name: 'Ground floor',
  levelId: 'level-ground',
  thicknessMm: 250,
  boundaryMm: rect(0, 0, 6000, 6000),
};

const upperFloor: FloorElem = {
  kind: 'floor',
  id: 'floor-upper',
  name: 'Upper floor',
  levelId: 'level-upper',
  thicknessMm: 250,
  boundaryMm: rect(0, 0, 6000, 6000),
};

const straightStair: StairElem = {
  kind: 'stair',
  id: 'stair-main',
  name: 'Main stair',
  baseLevelId: 'level-ground',
  topLevelId: 'level-upper',
  runStartMm: { xMm: 1200, yMm: 1000 },
  runEndMm: { xMm: 1200, yMm: 4800 },
  widthMm: 1000,
  riserMm: 175,
  treadMm: 280,
};

describe('diagnoseVerticalCirculationRendering', () => {
  it('flags slab openings without host floors and boundaries outside host slabs', () => {
    const missingHost: SlabOpeningElem = {
      kind: 'slab_opening',
      id: 'opening-missing-host',
      name: 'Missing host',
      hostFloorId: 'floor-missing',
      boundaryMm: rect(1000, 1000, 2000, 2000),
    };
    const outsideHost: SlabOpeningElem = {
      kind: 'slab_opening',
      id: 'opening-outside-host',
      name: 'Outside host',
      hostFloorId: baseFloor.id,
      boundaryMm: rect(5000, 5000, 7000, 7000),
    };
    const degenerate: SlabOpeningElem = {
      kind: 'slab_opening',
      id: 'opening-degenerate',
      name: 'Degenerate',
      hostFloorId: baseFloor.id,
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
        { xMm: 200, yMm: 0 },
      ],
    };

    const diagnostics = diagnoseVerticalCirculationRendering({
      [baseFloor.id]: baseFloor,
      [missingHost.id]: missingHost,
      [outsideHost.id]: outsideHost,
      [degenerate.id]: degenerate,
    });

    expect(codes(diagnostics)).toEqual([
      'renderer.slab_opening.boundary_outside_host',
      'renderer.slab_opening.degenerate_boundary',
      'renderer.slab_opening.missing_host_floor',
    ]);
    expect(diagnostics.every((diagnostic) => diagnostic.trackerItems.includes('BIR-J03'))).toBe(
      true,
    );
  });

  it('flags stairs crossing upper floors without slab opening evidence', () => {
    const diagnostics = diagnoseVerticalCirculationRendering({
      [ground.id]: ground,
      [upper.id]: upper,
      [baseFloor.id]: baseFloor,
      [upperFloor.id]: upperFloor,
      [straightStair.id]: straightStair,
    });

    expect(codes(diagnostics)).toContain(
      'renderer.stair_geometry.floor_penetration_without_slab_opening',
    );
    expect(
      diagnostics.find(
        (diagnostic) =>
          diagnostic.code === 'renderer.stair_geometry.floor_penetration_without_slab_opening',
      )?.elementIds,
    ).toEqual(['floor-upper', 'stair-main']);
  });

  it('accepts stair-floor crossings with matching slab opening evidence', () => {
    const stairOpening: SlabOpeningElem = {
      kind: 'slab_opening',
      id: 'opening-stair',
      name: 'Stair opening',
      hostFloorId: upperFloor.id,
      boundaryMm: rect(500, 500, 2200, 5300),
    };

    const diagnostics = diagnoseVerticalCirculationRendering({
      [ground.id]: ground,
      [upper.id]: upper,
      [baseFloor.id]: baseFloor,
      [upperFloor.id]: upperFloor,
      [straightStair.id]: straightStair,
      [stairOpening.id]: stairOpening,
    });

    expect(codes(diagnostics)).not.toContain(
      'renderer.stair_geometry.floor_penetration_without_slab_opening',
    );
  });

  it('flags explicit unsupported stair and railing render feature markers', () => {
    const markedStair = {
      ...straightStair,
      id: 'stair-marked',
      unsupportedRenderFeatures: ['winder-stringer-profile'],
    } as unknown as StairElem;
    const markedRailing = {
      kind: 'railing',
      id: 'rail-marked',
      name: 'Marked rail',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ],
      props: { rendererUnsupportedFeatures: ['curved-glass-panels'] },
    } as unknown as RailingElem;

    const diagnostics = diagnoseVerticalCirculationRendering({
      [ground.id]: ground,
      [upper.id]: upper,
      [markedStair.id]: markedStair,
      [markedRailing.id]: markedRailing,
    });

    expect(codes(diagnostics)).toContain('renderer.stair_geometry.unsupported');
    expect(codes(diagnostics)).toContain('renderer.railing_geometry.unsupported');
  });

  it('flags required railing edge associations and missing hosted stair references', () => {
    const railing = {
      kind: 'railing',
      id: 'rail-needs-edge',
      name: 'Needs edge',
      hostedStairId: 'missing-stair',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
      ],
      props: { requiresHostedEdge: true },
    } as unknown as RailingElem;
    const freestandingGuard = {
      ...railing,
      id: 'rail-freestanding-guard',
      hostedStairId: null,
    } as unknown as RailingElem;

    const diagnostics = diagnoseVerticalCirculationRendering({
      [railing.id]: railing,
      [freestandingGuard.id]: freestandingGuard,
    });

    expect(codes(diagnostics)).toContain('renderer.railing_geometry.missing_hosted_stair');
    expect(codes(diagnostics)).toContain('renderer.railing_geometry.missing_host_edge');
  });

  it('flags target-house terrace and loggia floors without enough guardrail evidence', () => {
    const terrace: FloorElem = {
      ...upperFloor,
      id: 'hf-roof-court-floor',
      name: 'Target-house roof court terrace',
    };
    const shortGuard: RailingElem = {
      kind: 'railing',
      id: 'rail-short',
      name: 'Short guard',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 600, yMm: 0 },
      ],
    };

    const missing = diagnoseVerticalCirculationRendering({
      [upper.id]: upper,
      [terrace.id]: terrace,
    });
    const partial = diagnoseVerticalCirculationRendering({
      [upper.id]: upper,
      [terrace.id]: terrace,
      [shortGuard.id]: shortGuard,
    });

    expect(codes(missing)).toContain('renderer.railing_geometry.target_house_guardrail_missing');
    expect(codes(partial)).toContain('renderer.railing_geometry.target_house_guardrail_partial');
  });
});

function rect(x0: number, y0: number, x1: number, y1: number) {
  return [
    { xMm: x0, yMm: y0 },
    { xMm: x1, yMm: y0 },
    { xMm: x1, yMm: y1 },
    { xMm: x0, yMm: y1 },
  ];
}

function codes(diagnostics: { code: string }[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code).sort((a, b) => a.localeCompare(b));
}
