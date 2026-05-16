import { describe, expect, it } from 'vitest';
import { buildWallShapeGeometry } from './meshBuilders';

const EPS = 1e-5;

function positions(geo: ReturnType<typeof buildWallShapeGeometry>): Float32Array {
  return geo.attributes.position!.array as Float32Array;
}

function topYIndices(posArr: Float32Array): number[] {
  const maxY = Math.max(...Array.from(posArr).filter((_, i) => i % 3 === 1));
  const indices: number[] = [];
  for (let i = 0; i < posArr.length; i += 3) {
    if (Math.abs(posArr[i + 1]! - maxY) < EPS) indices.push(i / 3);
  }
  return indices;
}

function bottomYIndices(posArr: Float32Array): number[] {
  const minY = Math.min(...Array.from(posArr).filter((_, i) => i % 3 === 1));
  const indices: number[] = [];
  for (let i = 0; i < posArr.length; i += 3) {
    if (Math.abs(posArr[i + 1]! - minY) < EPS) indices.push(i / 3);
  }
  return indices;
}

// Mirrors makeWallMesh conversion of wall fields → buildWallShapeGeometry params
function geomFor(params: {
  lengthM: number;
  heightM: number;
  thicknessMm: number;
  slopeAngleDeg?: number | null;
  topThicknessMm?: number | null;
}): ReturnType<typeof buildWallShapeGeometry> {
  const { lengthM, heightM, thicknessMm, slopeAngleDeg, topThicknessMm } = params;
  const slopeRad =
    slopeAngleDeg != null && slopeAngleDeg !== 0 ? (slopeAngleDeg * Math.PI) / 180 : 0;
  const taperRatio =
    topThicknessMm != null && topThicknessMm > 0 ? topThicknessMm / thicknessMm : 1;
  return buildWallShapeGeometry(lengthM, heightM, thicknessMm / 1000, slopeRad, taperRatio);
}

describe('sloped wall geometry — §3.5.7', () => {
  it('plumb wall (slopeAngleDeg=0) top vertices are directly above base', () => {
    const geo = geomFor({ lengthM: 5, heightM: 3, thicknessMm: 200, slopeAngleDeg: 0 });
    const pos = positions(geo);
    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const topXMin = Math.min(...topIdxs.map((vi) => pos[vi * 3]!));
    const topXMax = Math.max(...topIdxs.map((vi) => pos[vi * 3]!));
    const botXMin = Math.min(...botIdxs.map((vi) => pos[vi * 3]!));
    const botXMax = Math.max(...botIdxs.map((vi) => pos[vi * 3]!));

    expect(topXMin).toBeCloseTo(botXMin, 5);
    expect(topXMax).toBeCloseTo(botXMax, 5);
  });

  it('positive slopeAngleDeg shifts top vertices along wall direction', () => {
    const angleDeg = 15;
    const heightM = 3;
    const geo = geomFor({ lengthM: 5, heightM, thicknessMm: 200, slopeAngleDeg: angleDeg });
    const pos = positions(geo);
    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const expectedShift = heightM * Math.tan((angleDeg * Math.PI) / 180);
    const topXMin = Math.min(...topIdxs.map((vi) => pos[vi * 3]!));
    const botXMin = Math.min(...botIdxs.map((vi) => pos[vi * 3]!));

    expect(topXMin).toBeCloseTo(botXMin + expectedShift, 4);
  });

  it('tapered wall: top thickness < base thickness', () => {
    const thicknessMm = 400;
    const topThicknessMm = 200;
    const geo = geomFor({ lengthM: 5, heightM: 3, thicknessMm, topThicknessMm });
    const pos = positions(geo);
    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const topZSpan =
      Math.max(...topIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...topIdxs.map((vi) => pos[vi * 3 + 2]!));
    const botZSpan =
      Math.max(...botIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...botIdxs.map((vi) => pos[vi * 3 + 2]!));

    expect(topZSpan).toBeCloseTo(topThicknessMm / 1000, 4);
    expect(topZSpan).toBeLessThan(botZSpan);
  });

  it('taper is symmetric: both Z faces shrink equally', () => {
    const thicknessMm = 400;
    const topThicknessMm = 200;
    const geo = geomFor({ lengthM: 5, heightM: 3, thicknessMm, topThicknessMm });
    const pos = positions(geo);
    const topIdxs = topYIndices(pos);

    const topZMin = Math.min(...topIdxs.map((vi) => pos[vi * 3 + 2]!));
    const topZMax = Math.max(...topIdxs.map((vi) => pos[vi * 3 + 2]!));
    const topZCenter = (topZMin + topZMax) / 2;

    // Center of top face should remain at Z=0 (symmetric inward shrink)
    expect(topZCenter).toBeCloseTo(0, 4);
  });

  it('no-op when slopeAngleDeg is null', () => {
    const geo = geomFor({ lengthM: 5, heightM: 3, thicknessMm: 200, slopeAngleDeg: null });
    const pos = positions(geo);
    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const topXMin = Math.min(...topIdxs.map((vi) => pos[vi * 3]!));
    const botXMin = Math.min(...botIdxs.map((vi) => pos[vi * 3]!));

    // Null slope → same as 0° → no X offset on top vertices
    expect(topXMin).toBeCloseTo(botXMin, 5);
  });
});
