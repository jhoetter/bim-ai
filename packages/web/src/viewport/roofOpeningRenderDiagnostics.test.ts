import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  diagnoseRoofOpeningRendering,
  type RoofOpeningRenderDiagnosticRuleId,
} from './roofOpeningRenderDiagnostics';

type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type RoofOpeningElem = Extract<Element, { kind: 'roof_opening' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Level 0',
  elevationMm: 0,
};

const flatRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-flat',
  name: 'Flat roof',
  referenceLevelId: 'lvl-0',
  roofGeometryMode: 'flat',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 5000 },
    { xMm: 0, yMm: 5000 },
  ],
};

const asymmetricRoof: RoofElem = {
  kind: 'roof',
  id: 'hf-roof-main',
  name: 'Folded asymmetric shell',
  referenceLevelId: 'lvl-0',
  roofGeometryMode: 'asymmetric_gable',
  ridgeAxis: 'z',
  ridgeOffsetTransverseMm: 450,
  eaveHeightLeftMm: 2500,
  eaveHeightRightMm: 2350,
  slopeDeg: 23,
  overhangMm: 0,
  footprintMm: [
    { xMm: 0, yMm: -450 },
    { xMm: 8000, yMm: -450 },
    { xMm: 8000, yMm: 8200 },
    { xMm: 0, yMm: 8200 },
  ],
};

function opening(
  overrides: Partial<RoofOpeningElem> & {
    id: string;
    hostRoofId: string;
    boundaryMm: RoofOpeningElem['boundaryMm'];
    props?: Record<string, unknown>;
  },
): RoofOpeningElem {
  return {
    kind: 'roof_opening',
    name: overrides.id,
    ...overrides,
  } as RoofOpeningElem;
}

function rules(elementsById: Record<string, Element>): RoofOpeningRenderDiagnosticRuleId[] {
  return diagnoseRoofOpeningRendering(elementsById).map((diagnostic) => diagnostic.ruleId);
}

describe('roof opening render diagnostics', () => {
  it('flags roof openings with missing host roofs', () => {
    const roofCut = opening({
      id: 'orphan-cut',
      hostRoofId: 'missing-roof',
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 2000, yMm: 1000 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 1000, yMm: 2000 },
      ],
    });

    const diagnostics = diagnoseRoofOpeningRendering({ [roofCut.id]: roofCut });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'roof_opening_render_missing_host',
        severity: 'error',
        elementIds: ['orphan-cut', 'missing-roof'],
      }),
    ]);
  });

  it('flags roof openings that extend outside the host footprint', () => {
    const roofCut = opening({
      id: 'outside-cut',
      hostRoofId: flatRoof.id,
      boundaryMm: [
        { xMm: 5000, yMm: 1000 },
        { xMm: 6500, yMm: 1000 },
        { xMm: 6500, yMm: 2000 },
        { xMm: 5000, yMm: 2000 },
      ],
    });

    expect(
      rules({ [level0.id]: level0, [flatRoof.id]: flatRoof, [roofCut.id]: roofCut }),
    ).toContain('roof_opening_render_outside_host_footprint');
  });

  it('flags large occupied roof terrace openings without required render-support metadata', () => {
    const roofCut = opening({
      id: 'roof-terrace-cut',
      name: 'Occupied roof terrace cutout',
      hostRoofId: flatRoof.id,
      props: {
        occupiedRoofVoid: true,
        criticalEvidenceFeature: true,
      },
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 4500, yMm: 1000 },
        { xMm: 4500, yMm: 4000 },
        { xMm: 1000, yMm: 4000 },
      ],
    });

    expect(
      rules({ [level0.id]: level0, [flatRoof.id]: flatRoof, [roofCut.id]: roofCut }),
    ).toContain('roof_opening_render_occupied_void_metadata_missing');
  });

  it('accepts large occupied roof openings when render-support evidence is explicit', () => {
    const roofCut = opening({
      id: 'roof-terrace-cut',
      name: 'Occupied roof terrace cutout',
      hostRoofId: flatRoof.id,
      props: {
        occupiedRoofVoid: true,
        renderSupport: {
          cut: true,
          occupiedFloor: true,
          returns: true,
          guard: true,
          drainage: true,
          support: true,
          evidenceView: 'roof-high-evidence',
        },
      },
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 4500, yMm: 1000 },
        { xMm: 4500, yMm: 4000 },
        { xMm: 1000, yMm: 4000 },
      ],
    });

    expect(
      rules({ [level0.id]: level0, [flatRoof.id]: flatRoof, [roofCut.id]: roofCut }),
    ).not.toContain('roof_opening_render_occupied_void_metadata_missing');
  });

  it('catches asymmetric roof cutouts that stop short of the east edge', () => {
    const roofCut = opening({
      id: 'hf-roof-court-opening',
      name: 'Roof court / terrace opening',
      hostRoofId: asymmetricRoof.id,
      props: {
        criticalEvidenceFeature: true,
        occupiedRoofVoid: true,
      },
      boundaryMm: [
        { xMm: 5300, yMm: 3000 },
        { xMm: 7900, yMm: 3000 },
        { xMm: 7900, yMm: 6600 },
        { xMm: 5300, yMm: 6600 },
      ],
    });

    const diagnostics = diagnoseRoofOpeningRendering({
      [level0.id]: level0,
      [asymmetricRoof.id]: asymmetricRoof,
      [roofCut.id]: roofCut,
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'roof_opening_render_analytic_cut_unsupported',
          severity: 'error',
          details: expect.objectContaining({
            alignsWithEastEdge: false,
            analyticEdgeToleranceMm: 2,
          }),
        }),
        expect.objectContaining({
          ruleId: 'roof_opening_render_edge_alignment_ambiguous',
          severity: 'error',
        }),
      ]),
    );
  });

  it('does not flag the current asymmetric analytic path when the opening aligns to the edge', () => {
    const roofCut = opening({
      id: 'hf-roof-court-opening',
      name: 'Roof court / terrace opening',
      hostRoofId: asymmetricRoof.id,
      props: {
        criticalEvidenceFeature: true,
        occupiedRoofVoid: true,
        renderSupport: {
          cut: true,
          occupiedFloor: true,
          returns: true,
          guard: true,
          drainage: true,
          support: true,
          evidenceView: 'roof-high-evidence',
        },
      },
      boundaryMm: [
        { xMm: 5300, yMm: 3000 },
        { xMm: 8000, yMm: 3000 },
        { xMm: 8000, yMm: 6600 },
        { xMm: 5300, yMm: 6600 },
      ],
    });

    const ruleIds = rules({
      [level0.id]: level0,
      [asymmetricRoof.id]: asymmetricRoof,
      [roofCut.id]: roofCut,
    });

    expect(ruleIds).not.toContain('roof_opening_render_analytic_cut_unsupported');
    expect(ruleIds).not.toContain('roof_opening_render_edge_alignment_ambiguous');
  });

  it('warns when a gable roof opening depends on non-analytic fallback rendering', () => {
    const gableRoof: RoofElem = {
      ...flatRoof,
      id: 'gable-roof',
      name: 'Gable roof',
      roofGeometryMode: 'gable_pitched_rectangle',
      slopeDeg: 30,
    };
    const roofCut = opening({
      id: 'gable-roof-cut',
      hostRoofId: gableRoof.id,
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 2000, yMm: 1000 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 1000, yMm: 2000 },
      ],
    });

    const diagnostics = diagnoseRoofOpeningRendering({
      [level0.id]: level0,
      [gableRoof.id]: gableRoof,
      [roofCut.id]: roofCut,
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'roof_opening_render_analytic_cut_unsupported',
          severity: 'warning',
        }),
      ]),
    );
  });
});
