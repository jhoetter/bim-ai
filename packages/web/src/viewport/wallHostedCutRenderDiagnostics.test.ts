import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  diagnoseWallHostedCutRenderRisks,
  type WallHostedCutRenderDiagnosticCode,
} from './wallHostedCutRenderDiagnostics';

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

function win(
  overrides: Partial<Extract<Element, { kind: 'window' }>> = {},
): Extract<Element, { kind: 'window' }> {
  return {
    kind: 'window',
    id: 'window-1',
    name: 'Window',
    wallId: 'wall-1',
    alongT: 0.5,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1200,
    ...overrides,
  };
}

function opening(
  overrides: Partial<Extract<Element, { kind: 'wall_opening' }>> = {},
): Extract<Element, { kind: 'wall_opening' }> {
  return {
    kind: 'wall_opening',
    id: 'opening-1',
    name: 'Opening',
    hostWallId: 'wall-1',
    alongTStart: 0.35,
    alongTEnd: 0.55,
    sillHeightMm: 100,
    headHeightMm: 2200,
    ...overrides,
  };
}

function codes(elements: Element[], options = {}): WallHostedCutRenderDiagnosticCode[] {
  return diagnoseWallHostedCutRenderRisks({ elements, ...options }).map((finding) => finding.code);
}

describe('diagnoseWallHostedCutRenderRisks', () => {
  it('returns no diagnostics for a simple cuttable wall with separated hosted cuts', () => {
    expect(
      diagnoseWallHostedCutRenderRisks({
        elements: [
          wall(),
          door({ id: 'door', alongT: 0.22, widthMm: 800 }),
          win({ id: 'window', alongT: 0.72, widthMm: 900 }),
          opening({ id: 'opening', alongTStart: 0.42, alongTEnd: 0.54 }),
        ],
      }),
    ).toEqual([]);
  });

  it('flags missing, unresolved, and wrong-kind wall hosts', () => {
    const floor = { kind: 'floor', id: 'floor-1', name: 'Floor' } as Element;

    expect(
      codes([
        door({ id: 'missing-id', wallId: '' }),
        win({ id: 'not-found', wallId: 'absent-wall' }),
        opening({ id: 'wrong-kind', hostWallId: 'floor-1' }),
        floor,
      ]),
    ).toEqual(
      expect.arrayContaining([
        'missing_wall_host',
        'wall_host_not_found',
        'wall_host_wrong_kind',
        'detached_or_proxy_render_risk',
      ]),
    );
  });

  it('flags wall span, endpoint clearance, and too-short host risks', () => {
    const findings = codes(
      [
        wall({ id: 'tiny-wall', end: { xMm: 5, yMm: 0 } }),
        wall({ id: 'short-wall', end: { xMm: 700, yMm: 0 } }),
        wall(),
        door({ id: 'too-wide', wallId: 'short-wall', widthMm: 1200 }),
        door({ id: 'too-close', wallId: 'wall-1', alongT: 0.08, widthMm: 900 }),
        win({ id: 'too-short-host', wallId: 'tiny-wall' }),
      ],
      { endpointClearanceMm: 100 },
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        'host_wall_too_short',
        'hosted_cut_outside_wall_span',
        'hosted_cut_low_endpoint_clearance',
      ]),
    );
  });

  it('flags vertical cut extents beyond the host wall height', () => {
    expect(
      codes([
        wall({ heightMm: 2200 }),
        win({ id: 'tall-window', sillHeightMm: 900, heightMm: 1600 }),
        opening({ id: 'bad-opening', alongTStart: 0.1, alongTEnd: 0.2, headHeightMm: 2600 }),
      ]),
    ).toEqual(expect.arrayContaining(['hosted_cut_vertical_extent_outside_host']));
  });

  it('flags element-level host-cut opt-outs', () => {
    expect(
      codes([
        wall(),
        door({ id: 'depth-zero', hostCutDepthMm: 0 }),
        opening({
          id: 'props-disabled',
          alongTStart: 0.7,
          alongTEnd: 0.82,
          props: { disableHostCut: true },
        }),
      ]),
    ).toEqual(expect.arrayContaining(['host_cut_disabled_by_element']));
  });

  it('flags unsupported curved, profiled, and non-prismatic host geometry', () => {
    const findings = codes([
      wall({
        wallCurve: {
          kind: 'arc',
          center: { xMm: 3000, yMm: 3000 },
          radiusMm: 3000,
          startAngleDeg: 180,
          endAngleDeg: 0,
          sweepDeg: 180,
        },
        profilePoints: [
          { xPct: 0, yPct: 0 },
          { xPct: 1, yPct: 0 },
          { xPct: 1, yPct: 1 },
        ],
        leanMm: { xMm: 50, yMm: 0 },
      }),
      door(),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        'unsupported_curved_host_geometry',
        'unsupported_non_rectangular_host_profile',
        'unsupported_non_prismatic_host_geometry',
        'detached_or_proxy_render_risk',
      ]),
    );
  });

  it('flags overlapping hosted cut intervals on the same wall', () => {
    expect(
      codes([
        wall(),
        door({ id: 'door-a', alongT: 0.5, widthMm: 1200 }),
        win({ id: 'window-b', alongT: 0.56, widthMm: 1200 }),
      ]),
    ).toEqual(expect.arrayContaining(['overlapping_hosted_wall_cuts']));
  });

  it('flags disabled CSG and curtain-wall CSG skip paths as proxy render risks', () => {
    expect(codes([wall(), door()], { csgEnabled: false })).toEqual(
      expect.arrayContaining(['wall_opening_csg_disabled', 'detached_or_proxy_render_risk']),
    );

    expect(codes([wall({ isCurtainWall: true }), win()])).toEqual(
      expect.arrayContaining([
        'wall_opening_csg_skipped_by_curtain_wall',
        'detached_or_proxy_render_risk',
      ]),
    );
  });

  it('accepts elementsById and snapshot element maps', () => {
    const elementsById = { 'wall-1': wall(), 'door-1': door() };

    expect(diagnoseWallHostedCutRenderRisks({ elementsById })).toEqual([]);
    expect(diagnoseWallHostedCutRenderRisks({ snapshot: { elements: elementsById } })).toEqual([]);
  });
});
