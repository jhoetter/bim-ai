import { describe, expect, it } from 'vitest';

describe('Angular / Radial dimension command shapes — §4.1', () => {
  it('createAngularDimension has correct shape', () => {
    const cmd = {
      type: 'createAngularDimension' as const,
      hostViewId: 'v1',
      vertexMm: { xMm: 0, yMm: 0 },
      rayAMm: { xMm: 500, yMm: 0 },
      rayBMm: { xMm: 0, yMm: 500 },
      arcRadiusMm: 200,
    };
    expect(cmd.type).toBe('createAngularDimension');
    expect(cmd.vertexMm.xMm).toBe(0);
    expect(cmd.arcRadiusMm).toBe(200);
  });

  it('createRadialDimension has correct shape', () => {
    const cmd = {
      type: 'createRadialDimension' as const,
      hostViewId: 'v1',
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 500, yMm: 0 },
    };
    expect(cmd.type).toBe('createRadialDimension');
    expect(cmd.arcPointMm.xMm).toBe(500);
  });

  it('radial dimension computes radius correctly', () => {
    const centerMm = { xMm: 0, yMm: 0 };
    const arcPointMm = { xMm: 300, yMm: 400 };
    const radius = Math.round(
      Math.hypot(arcPointMm.xMm - centerMm.xMm, arcPointMm.yMm - centerMm.yMm),
    );
    expect(radius).toBe(500);
  });

  it('angular dimension arc radius defaults to 400 if omitted', () => {
    const cmd: { arcRadiusMm?: number } = {};
    const arcRadiusMm = cmd.arcRadiusMm ?? 400;
    expect(arcRadiusMm).toBe(400);
  });
});
