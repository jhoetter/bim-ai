import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import { interiorElevationMarkerGripProvider } from './interiorElevationMarkerGripProvider';

const marker: Extract<Element, { kind: 'interior_elevation_marker' }> = {
  kind: 'interior_elevation_marker',
  id: 'iem-1',
  positionMm: { xMm: 3000, yMm: 4000 },
  levelId: 'lvl-0',
  radiusMm: 3000,
  elevationViewIds: {
    north: 'ev-iem-1-n',
    south: 'ev-iem-1-s',
    east: 'ev-iem-1-e',
    west: 'ev-iem-1-w',
  },
};

describe('interiorElevationMarkerGripProvider', () => {
  it('returns one circle grip at positionMm', () => {
    const grips = interiorElevationMarkerGripProvider.grips(marker, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('iem-1:position');
    expect(grips[0]!.positionMm).toEqual({ xMm: 3000, yMm: 4000 });
    expect(grips[0]!.shape).toBe('circle');
    expect(grips[0]!.axis).toBe('free');
  });

  it('onCommit(delta) returns updateElementProperty with correct new positionMm', () => {
    const [grip] = interiorElevationMarkerGripProvider.grips(marker, {});
    const cmd = grip!.onCommit({ xMm: 500, yMm: -200 });
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.elementId).toBe('iem-1');
    expect(cmd.key).toBe('positionMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 3500, yMm: 3800 });
  });

  it('onNumericOverride sets X coordinate leaving Y unchanged', () => {
    const [grip] = interiorElevationMarkerGripProvider.grips(marker, {});
    const cmd = grip!.onNumericOverride(9000);
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed.xMm).toBe(9000);
    expect(parsed.yMm).toBe(4000);
  });
});
