import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeBeamSystemMesh, type BeamSystemElem } from './meshBuilders.beamSystem';

function makeRectSys(widthMm: number, depthMm: number, spacingMm: number): BeamSystemElem {
  return {
    kind: 'beam_system',
    id: 'bs-1',
    levelId: 'lvl-1',
    boundaryPoints: [
      { xMm: 0, yMm: 0 },
      { xMm: widthMm, yMm: 0 },
      { xMm: widthMm, yMm: depthMm },
      { xMm: 0, yMm: depthMm },
    ],
    beamDirection: 0,
    spacingMm,
    materialKey: null,
  };
}

describe('makeBeamSystemMesh', () => {
  it('creates a Group for a 4m x 6m bay at 1200mm spacing', () => {
    const sys = makeRectSys(4000, 6000, 1200);
    const group = makeBeamSystemMesh(sys, 0, null);
    expect(group).toBeInstanceOf(THREE.Group);
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh);
    expect(meshes.length).toBeGreaterThanOrEqual(3);
  });

  it('returns an empty group for fewer than 3 boundary points', () => {
    const sys: BeamSystemElem = {
      kind: 'beam_system',
      id: 'bs-empty',
      levelId: 'lvl-1',
      boundaryPoints: [{ xMm: 0, yMm: 0 }],
      beamDirection: 0,
      spacingMm: 1200,
      materialKey: null,
    };
    const group = makeBeamSystemMesh(sys, 0, null);
    expect(group.children.length).toBe(0);
  });

  it('beams are clipped at the boundary', () => {
    const sys = makeRectSys(4000, 6000, 1200);
    const group = makeBeamSystemMesh(sys, 0, null);
    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        const bb = new THREE.Box3().setFromObject(child);
        expect(bb.min.x).toBeGreaterThanOrEqual(-0.01);
        expect(bb.max.x).toBeLessThanOrEqual(4.01);
      }
    });
  });

  it('rotated direction produces beams along the correct axis', () => {
    const sys: BeamSystemElem = {
      ...makeRectSys(4000, 4000, 1000),
      id: 'bs-rotated',
      beamDirection: 90,
    };
    const group = makeBeamSystemMesh(sys, 0, null);
    expect(group.children.length).toBeGreaterThanOrEqual(3);
  });
});
