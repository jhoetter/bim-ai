import { describe, expect, it } from 'vitest';

import {
  WALL_CROP_BLOCK_MESSAGE,
  nextWallDraftAfterCommit,
  shouldBlockWallCommitOutsideCrop,
} from './wallDraftLifecycle';

describe('wallDraftLifecycle', () => {
  const cropState = {
    cropMinMm: { xMm: 0, yMm: 0 },
    cropMaxMm: { xMm: 4000, yMm: 3000 },
    cropEnabled: true,
  };

  it('does not block when crop is disabled or missing', () => {
    expect(
      shouldBlockWallCommitOutsideCrop(
        { ...cropState, cropEnabled: false },
        { xMm: -5000, yMm: -5000 },
        { xMm: 9000, yMm: 9000 },
      ),
    ).toBe(false);

    expect(
      shouldBlockWallCommitOutsideCrop(null, { xMm: -5000, yMm: -5000 }, { xMm: 9000, yMm: 9000 }),
    ).toBe(false);
  });

  it('blocks wall commit when either endpoint is outside an enabled crop region', () => {
    expect(
      shouldBlockWallCommitOutsideCrop(cropState, { xMm: 100, yMm: 100 }, { xMm: 3800, yMm: 2800 }),
    ).toBe(false);
    expect(
      shouldBlockWallCommitOutsideCrop(cropState, { xMm: -10, yMm: 100 }, { xMm: 3800, yMm: 2800 }),
    ).toBe(true);
    expect(
      shouldBlockWallCommitOutsideCrop(cropState, { xMm: 100, yMm: 100 }, { xMm: 4100, yMm: 2800 }),
    ).toBe(true);
  });

  it('re-arms deterministic loop continuation only when loop mode is enabled', () => {
    const previousWallForChain = {
      id: 'wall-2',
      pathStart: { xMm: 0, yMm: 0 },
      pathEnd: { xMm: 2000, yMm: 0 },
      actualStart: { xMm: 0, yMm: 0 },
      actualEnd: { xMm: 2000, yMm: 0 },
      cornerEndpoint: 'end' as const,
    };

    expect(
      nextWallDraftAfterCommit({
        loopMode: false,
        endpoint: { xMm: 2000, yMm: 0 },
        previousWallForChain,
      }),
    ).toBeUndefined();

    expect(
      nextWallDraftAfterCommit({
        loopMode: true,
        endpoint: { xMm: 2000, yMm: 0 },
        previousWallForChain,
      }),
    ).toEqual({
      kind: 'wall',
      sx: 2000,
      sy: 0,
      previousWall: previousWallForChain,
    });
  });

  it('keeps a clear explicit user-facing crop block message', () => {
    expect(WALL_CROP_BLOCK_MESSAGE).toContain('active crop region');
  });
});
