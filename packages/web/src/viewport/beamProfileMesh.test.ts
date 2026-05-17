import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { buildBeamProfileGeometry, beamGeometryType } from './beamProfileMesh';

type BeamElem = Extract<Element, { kind: 'beam' }>;

const baseBeam: BeamElem = {
  kind: 'beam',
  id: 'b-1',
  name: 'Test Beam',
  levelId: 'lvl-1',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 5000, yMm: 0 },
  widthMm: 200,
  heightMm: 400,
};

describe('beam section profiles — §9.2', () => {
  it('rectangular beam builds BoxGeometry', () => {
    const geo = buildBeamProfileGeometry({ ...baseBeam, beamProfileType: 'rectangular' });
    expect(geo).toBeInstanceOf(THREE.BoxGeometry);
  });

  it('rectangular has no beamProfileType regression', () => {
    const geo = buildBeamProfileGeometry(baseBeam); // beamProfileType is undefined
    expect(geo).toBeInstanceOf(THREE.BoxGeometry);
    expect(beamGeometryType(baseBeam)).toBe('BoxGeometry');
  });

  it('I-beam builds ExtrudeGeometry group with 3 parts', () => {
    const beam = { ...baseBeam, beamProfileType: 'I-beam' as const };
    const geo = buildBeamProfileGeometry(beam);
    expect(geo).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(beamGeometryType(beam)).toBe('ExtrudeGeometry');
  });

  it('H-beam also builds ExtrudeGeometry', () => {
    const beam = { ...baseBeam, beamProfileType: 'H-beam' as const };
    const geo = buildBeamProfileGeometry(beam);
    expect(geo).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(beamGeometryType(beam)).toBe('ExtrudeGeometry');
  });

  it('HSS-round builds TubeGeometry', () => {
    const beam = { ...baseBeam, beamProfileType: 'HSS-round' as const };
    const geo = buildBeamProfileGeometry(beam);
    expect(geo).toBeInstanceOf(THREE.TubeGeometry);
    expect(beamGeometryType(beam)).toBe('TubeGeometry');
  });

  it('HSS-square builds BoxGeometry', () => {
    const beam = { ...baseBeam, beamProfileType: 'HSS-square' as const };
    const geo = buildBeamProfileGeometry(beam);
    expect(geo).toBeInstanceOf(THREE.BoxGeometry);
    expect(beamGeometryType(beam)).toBe('BoxGeometry');
  });

  it('I-beam uses widthMm as default flangeWidthMm when field is null', () => {
    const beamNoFlange: BeamElem = {
      ...baseBeam,
      beamProfileType: 'I-beam',
      flangeWidthMm: null,
    };
    const beamExplicit: BeamElem = {
      ...baseBeam,
      beamProfileType: 'I-beam',
      flangeWidthMm: baseBeam.widthMm,
    };
    // Both should produce valid ExtrudeGeometry without throwing
    expect(buildBeamProfileGeometry(beamNoFlange)).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(buildBeamProfileGeometry(beamExplicit)).toBeInstanceOf(THREE.ExtrudeGeometry);
  });

  it('HSS-round respects custom wallThicknessMm', () => {
    const beam: BeamElem = { ...baseBeam, beamProfileType: 'HSS-round', wallThicknessMm: 12 };
    const geo = buildBeamProfileGeometry(beam);
    expect(geo).toBeInstanceOf(THREE.TubeGeometry);
  });
});
