import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  angularDimensionGripProvider,
  radialDimensionGripProvider,
  diameterDimensionGripProvider,
  arcLengthDimensionGripProvider,
  spotElevationGripProvider,
  spotCoordinateGripProvider,
  spotSlopeGripProvider,
} from './spotAnnotationGripProvider';

const angularDim: Extract<Element, { kind: 'angular_dimension' }> = {
  kind: 'angular_dimension',
  id: 'ad-1',
  hostViewId: 'pv-1',
  vertexMm: { xMm: 500, yMm: 500 },
  rayAMm: { xMm: 1000, yMm: 500 },
  rayBMm: { xMm: 500, yMm: 1000 },
};

const radialDim: Extract<Element, { kind: 'radial_dimension' }> = {
  kind: 'radial_dimension',
  id: 'rd-1',
  hostViewId: 'pv-1',
  centerMm: { xMm: 0, yMm: 0 },
  arcPointMm: { xMm: 1000, yMm: 0 },
};

const diameterDim: Extract<Element, { kind: 'diameter_dimension' }> = {
  kind: 'diameter_dimension',
  id: 'dd-1',
  hostViewId: 'pv-1',
  centerMm: { xMm: 0, yMm: 0 },
  arcPointMm: { xMm: 1000, yMm: 0 },
};

const arcLengthDim: Extract<Element, { kind: 'arc_length_dimension' }> = {
  kind: 'arc_length_dimension',
  id: 'ald-1',
  hostViewId: 'pv-1',
  centerMm: { xMm: 0, yMm: 0 },
  radiusMm: 1000,
  startAngleDeg: 0,
  endAngleDeg: 90,
};

const spotElev: Extract<Element, { kind: 'spot_elevation' }> = {
  kind: 'spot_elevation',
  id: 'se-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 2000, yMm: 3000 },
  elevationMm: 0,
};

const spotCoord: Extract<Element, { kind: 'spot_coordinate' }> = {
  kind: 'spot_coordinate',
  id: 'sc-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 100, yMm: 200 },
  northMm: 100,
  eastMm: 200,
};

const spotSlope: Extract<Element, { kind: 'spot_slope' }> = {
  kind: 'spot_slope',
  id: 'ss-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 400, yMm: 500 },
  slopePct: 5,
};

describe('angularDimensionGripProvider', () => {
  it('emits one vertex grip (square, free)', () => {
    const grips = angularDimensionGripProvider.grips(angularDim, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('ad-1:vertex');
    expect(grips[0]!.positionMm).toEqual({ xMm: 500, yMm: 500 });
    expect(grips[0]!.shape).toBe('square');
    expect(grips[0]!.axis).toBe('free');
  });

  it('onCommit moves vertexMm by delta', () => {
    const [grip] = angularDimensionGripProvider.grips(angularDim, {});
    const cmd = grip!.onCommit({ xMm: 100, yMm: -50 });
    expect(cmd.key).toBe('vertexMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 600, yMm: 450 });
  });
});

describe('radialDimensionGripProvider', () => {
  it('emits one arc grip at arcPointMm', () => {
    const grips = radialDimensionGripProvider.grips(radialDim, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('rd-1:arc');
    expect(grips[0]!.positionMm).toEqual({ xMm: 1000, yMm: 0 });
  });

  it('onCommit moves arcPointMm by delta', () => {
    const [grip] = radialDimensionGripProvider.grips(radialDim, {});
    const cmd = grip!.onCommit({ xMm: 200, yMm: 50 });
    expect(cmd.key).toBe('arcPointMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 1200, yMm: 50 });
  });
});

describe('diameterDimensionGripProvider', () => {
  it('emits one arc grip at arcPointMm', () => {
    const grips = diameterDimensionGripProvider.grips(diameterDim, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('dd-1:arc');
    expect(grips[0]!.positionMm).toEqual({ xMm: 1000, yMm: 0 });
  });

  it('onCommit moves arcPointMm by delta', () => {
    const [grip] = diameterDimensionGripProvider.grips(diameterDim, {});
    const cmd = grip!.onCommit({ xMm: -100, yMm: 0 });
    expect(cmd.key).toBe('arcPointMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 900, yMm: 0 });
  });
});

describe('arcLengthDimensionGripProvider', () => {
  it('emits one center grip', () => {
    const grips = arcLengthDimensionGripProvider.grips(arcLengthDim, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('ald-1:center');
    expect(grips[0]!.positionMm).toEqual({ xMm: 0, yMm: 0 });
  });

  it('onCommit moves centerMm by delta', () => {
    const [grip] = arcLengthDimensionGripProvider.grips(arcLengthDim, {});
    const cmd = grip!.onCommit({ xMm: 50, yMm: 75 });
    expect(cmd.key).toBe('centerMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 50, yMm: 75 });
  });
});

describe('spotElevationGripProvider', () => {
  it('emits one position grip at positionMm', () => {
    const grips = spotElevationGripProvider.grips(spotElev, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('se-1:position');
    expect(grips[0]!.positionMm).toEqual({ xMm: 2000, yMm: 3000 });
  });

  it('onCommit moves positionMm by delta', () => {
    const [grip] = spotElevationGripProvider.grips(spotElev, {});
    const cmd = grip!.onCommit({ xMm: 500, yMm: -1000 });
    expect(cmd.key).toBe('positionMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 2500, yMm: 2000 });
  });
});

describe('spotCoordinateGripProvider', () => {
  it('emits one position grip', () => {
    const grips = spotCoordinateGripProvider.grips(spotCoord, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('sc-1:position');
    expect(grips[0]!.positionMm).toEqual({ xMm: 100, yMm: 200 });
  });

  it('onCommit updates positionMm with delta', () => {
    const [grip] = spotCoordinateGripProvider.grips(spotCoord, {});
    const cmd = grip!.onCommit({ xMm: 10, yMm: 20 });
    expect(cmd.key).toBe('positionMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 110, yMm: 220 });
  });
});

describe('spotSlopeGripProvider', () => {
  it('emits one position grip', () => {
    const grips = spotSlopeGripProvider.grips(spotSlope, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('ss-1:position');
    expect(grips[0]!.positionMm).toEqual({ xMm: 400, yMm: 500 });
  });

  it('onCommit updates positionMm with delta', () => {
    const [grip] = spotSlopeGripProvider.grips(spotSlope, {});
    const cmd = grip!.onCommit({ xMm: -100, yMm: 50 });
    expect(cmd.key).toBe('positionMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 300, yMm: 550 });
  });
});
