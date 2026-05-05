import { describe, expect, it } from 'vitest';
import { alignmentForPick, compassLabelFromAzimuth } from './viewCubeAlignment';

describe('alignmentForPick — spec §15.4', () => {
  it('FRONT face → azimuth 0, elevation 0, Y-up', () => {
    const a = alignmentForPick({ kind: 'face', face: 'FRONT' });
    expect(a.azimuth).toBe(0);
    expect(a.elevation).toBe(0);
    expect(a.up).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('BACK face → azimuth π', () => {
    expect(alignmentForPick({ kind: 'face', face: 'BACK' }).azimuth).toBeCloseTo(Math.PI, 6);
  });

  it('TOP face → elevation ≈ π/2 with Z-up', () => {
    const a = alignmentForPick({ kind: 'face', face: 'TOP' });
    expect(a.elevation).toBeGreaterThan(Math.PI / 2 - 0.01);
    expect(a.up).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('BOTTOM face → elevation ≈ -π/2', () => {
    expect(alignmentForPick({ kind: 'face', face: 'BOTTOM' }).elevation).toBeLessThan(
      -Math.PI / 2 + 0.01,
    );
  });

  it('TOP-NE corner → azimuth π/4, elevation atan(1/√2)', () => {
    const a = alignmentForPick({ kind: 'corner', corner: 'TOP-NE' });
    expect(a.azimuth).toBeCloseTo(Math.PI / 4, 6);
    expect(a.elevation).toBeCloseTo(Math.atan(1 / Math.SQRT2), 6);
  });

  it('BOTTOM-SW corner mirrors TOP-SW elevation', () => {
    const top = alignmentForPick({ kind: 'corner', corner: 'TOP-SW' });
    const bottom = alignmentForPick({ kind: 'corner', corner: 'BOTTOM-SW' });
    expect(bottom.azimuth).toBe(top.azimuth);
    expect(bottom.elevation).toBeCloseTo(-top.elevation, 6);
  });

  it('FRONT-TOP edge → azimuth 0, elevation π/4', () => {
    const a = alignmentForPick({ kind: 'edge', edge: 'FRONT-TOP' });
    expect(a.azimuth).toBe(0);
    expect(a.elevation).toBeCloseTo(Math.PI / 4, 6);
  });

  it('FRONT-RIGHT edge (face-diagonal) → azimuth π/4, elevation 0', () => {
    const a = alignmentForPick({ kind: 'edge', edge: 'FRONT-RIGHT' });
    expect(a.azimuth).toBeCloseTo(Math.PI / 4, 6);
    expect(a.elevation).toBe(0);
  });

  it('home → spec default ~ NE-iso', () => {
    const a = alignmentForPick({ kind: 'home' });
    expect(a.azimuth).toBeCloseTo(Math.PI / 4, 6);
    expect(a.elevation).toBeCloseTo(0.45, 2);
  });
});

describe('compassLabelFromAzimuth', () => {
  it('returns N at azimuth 0', () => {
    expect(compassLabelFromAzimuth(0)).toBe('N');
  });
  it('returns E at azimuth π/2', () => {
    expect(compassLabelFromAzimuth(Math.PI / 2)).toBe('E');
  });
  it('returns S at azimuth ±π', () => {
    expect(compassLabelFromAzimuth(Math.PI)).toBe('S');
    expect(compassLabelFromAzimuth(-Math.PI + 0.01)).toBe('S');
  });
  it('returns W at azimuth -π/2', () => {
    expect(compassLabelFromAzimuth(-Math.PI / 2)).toBe('W');
  });
});
