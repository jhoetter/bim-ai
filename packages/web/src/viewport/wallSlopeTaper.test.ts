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

describe('buildWallShapeGeometry — §3.5.7', () => {
  it('slopeDeg 10°: top vertices have nonzero X offset, bottom vertices stay at base X', () => {
    const slopeRad = (10 * Math.PI) / 180;
    const height = 2.8;
    const len = 5;
    const thick = 0.2;
    const geo = buildWallShapeGeometry(len, height, thick, slopeRad, 1);
    const pos = positions(geo);

    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const expectedOffset = height * Math.tan(slopeRad);

    // All top vertices share the same X offset relative to their "unsheared" positions.
    // Bottom vertices span -len/2 .. +len/2; top vertices span -len/2+offset .. +len/2+offset.
    const topXs = topIdxs.map((vi) => pos[vi * 3]!);
    const botXs = botIdxs.map((vi) => pos[vi * 3]!);

    const topXMin = Math.min(...topXs);
    const topXMax = Math.max(...topXs);
    const botXMin = Math.min(...botXs);
    const botXMax = Math.max(...botXs);

    expect(topXMin).toBeCloseTo(botXMin + expectedOffset, 4);
    expect(topXMax).toBeCloseTo(botXMax + expectedOffset, 4);
    expect(topXMin).not.toBeCloseTo(botXMin, 2);
  });

  it('slopeDeg 0°: same geometry as no-slope wall (top X equals bottom X range)', () => {
    const geo = buildWallShapeGeometry(5, 2.8, 0.2, 0, 1);
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

  it('taperRatio 0.5: top Z span is half of base Z span', () => {
    const thick = 0.4;
    const geo = buildWallShapeGeometry(5, 2.8, thick, 0, 0.5);
    const pos = positions(geo);

    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const topZSpan =
      Math.max(...topIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...topIdxs.map((vi) => pos[vi * 3 + 2]!));
    const botZSpan =
      Math.max(...botIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...botIdxs.map((vi) => pos[vi * 3 + 2]!));

    expect(topZSpan).toBeCloseTo(botZSpan * 0.5, 4);
  });

  it('taperRatio 1: top Z span equals base Z span (prismatic box)', () => {
    const thick = 0.3;
    const geo = buildWallShapeGeometry(5, 2.8, thick, 0, 1);
    const pos = positions(geo);

    const topIdxs = topYIndices(pos);
    const botIdxs = bottomYIndices(pos);

    const topZSpan =
      Math.max(...topIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...topIdxs.map((vi) => pos[vi * 3 + 2]!));
    const botZSpan =
      Math.max(...botIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...botIdxs.map((vi) => pos[vi * 3 + 2]!));

    expect(topZSpan).toBeCloseTo(botZSpan, 5);
  });

  it('taperRatio 10: geometry builds without crash and top thickness matches', () => {
    const thick = 0.2;
    const geo = buildWallShapeGeometry(5, 2.8, thick, 0, 10);
    const pos = positions(geo);

    const topIdxs = topYIndices(pos);
    const topZSpan =
      Math.max(...topIdxs.map((vi) => pos[vi * 3 + 2]!)) -
      Math.min(...topIdxs.map((vi) => pos[vi * 3 + 2]!));

    expect(topZSpan).toBeCloseTo(thick * 10, 4);
    expect(pos.length).toBeGreaterThan(0);
  });
});
