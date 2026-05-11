import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import {
  makeInternalOriginMarker,
  makeProjectBasePointMarker,
  makeSurveyPointMarker,
} from './originMarkers';
import { elemViewerCategory } from './sceneUtils';

type IO = Extract<Element, { kind: 'internal_origin' }>;
type PBP = Extract<Element, { kind: 'project_base_point' }>;
type SP = Extract<Element, { kind: 'survey_point' }>;

describe('KRN-06 origin markers', () => {
  it('makeInternalOriginMarker produces a Group with axis lines', () => {
    const el: IO = { kind: 'internal_origin', id: 'internal_origin' };
    const g = makeInternalOriginMarker(el);
    expect(g).toBeInstanceOf(THREE.Group);
    // 3 axis lines + 1 sphere node
    expect(g.children.length).toBeGreaterThanOrEqual(4);
    expect(g.userData.bimPickId).toBe('internal_origin');
    // Internal origin always at world (0,0,0)
    expect(g.position.x).toBe(0);
    expect(g.position.y).toBe(0);
    expect(g.position.z).toBe(0);
  });

  it('makeProjectBasePointMarker maps model XY→XZ and Z→Y, in metres', () => {
    const el: PBP = {
      kind: 'project_base_point',
      id: 'pbp1',
      positionMm: { xMm: 1500, yMm: 2500, zMm: 3000 },
      angleToTrueNorthDeg: 0,
    };
    const g = makeProjectBasePointMarker(el);
    expect(g.position.x).toBeCloseTo(1.5, 5);
    expect(g.position.y).toBeCloseTo(3.0, 5);
    expect(g.position.z).toBeCloseTo(2.5, 5);
    expect(g.userData.bimPickId).toBe('pbp1');
    expect(g.userData.markerLabel).toBe('PBP');
  });

  it('makeProjectBasePointMarker rotates around Y by angleToTrueNorthDeg', () => {
    const el: PBP = {
      kind: 'project_base_point',
      id: 'pbp1',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 30,
    };
    const g = makeProjectBasePointMarker(el);
    expect(g.rotation.y).toBeCloseTo((30 * Math.PI) / 180, 5);
  });

  it('makeSurveyPointMarker maps position correctly and labels SP', () => {
    const el: SP = {
      kind: 'survey_point',
      id: 'sp1',
      positionMm: { xMm: 4000, yMm: 0, zMm: 0 },
      sharedElevationMm: 0,
    };
    const g = makeSurveyPointMarker(el);
    expect(g.position.x).toBeCloseTo(4.0, 5);
    expect(g.userData.bimPickId).toBe('sp1');
    expect(g.userData.markerLabel).toBe('SP');
  });

  it('elemViewerCategory routes all three origin kinds to "site_origin"', () => {
    const io: IO = { kind: 'internal_origin', id: 'internal_origin' };
    const pbp: PBP = {
      kind: 'project_base_point',
      id: 'pbp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: 0,
    };
    const sp: SP = {
      kind: 'survey_point',
      id: 'sp',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      sharedElevationMm: 0,
    };
    expect(elemViewerCategory(io)).toBe('site_origin');
    expect(elemViewerCategory(pbp)).toBe('site_origin');
    expect(elemViewerCategory(sp)).toBe('site_origin');
  });

  it('elemViewerCategory covers all semantic kinds rendered by the 3D viewport', () => {
    const cases: Array<[Element['kind'], string]> = [
      ['wall', 'wall'],
      ['floor', 'floor'],
      ['roof', 'roof'],
      ['ceiling', 'ceiling'],
      ['stair', 'stair'],
      ['railing', 'railing'],
      ['column', 'column'],
      ['beam', 'beam'],
      ['door', 'door'],
      ['window', 'window'],
      ['room', 'room'],
      ['family_instance', 'family_instance'],
      ['placed_asset', 'placed_asset'],
      ['mass', 'mass'],
      ['site', 'site'],
      ['reference_plane', 'reference_plane'],
      ['text_3d', 'text_3d'],
      ['sweep', 'sweep'],
      ['dormer', 'dormer'],
      ['balcony', 'floor'],
    ];

    for (const [kind, category] of cases) {
      expect(elemViewerCategory({ kind, id: `test-${kind}` } as Element)).toBe(category);
    }
  });
});
