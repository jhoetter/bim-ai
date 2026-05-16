import { describe, expect, it } from 'vitest';

import { initialWalkthroughState, reduceWalkthrough } from './toolGrammar';
import { interpolateWalkthrough } from '../viewport/WalkthroughPlaybackPanel';
import type { WalkthroughKeyframe } from '@bim-ai/core';

describe('D3 — walkthrough grammar', () => {
  it('starts with empty keyframes', () => {
    const state = initialWalkthroughState();
    expect(state.keyframes).toHaveLength(0);
  });

  it('captures keyframes on click events', () => {
    let state = initialWalkthroughState();
    const kf1: WalkthroughKeyframe = {
      positionMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 1000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 0,
    };
    const result1 = reduceWalkthrough(state, { kind: 'capture-keyframe', keyframe: kf1 });
    state = result1.state;
    expect(state.keyframes).toHaveLength(1);
    expect(result1.effect.stillActive).toBe(true);

    const kf2: WalkthroughKeyframe = {
      positionMm: { x: 5000, y: 0, z: 0 },
      targetMm: { x: 10000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 5,
    };
    const result2 = reduceWalkthrough(state, { kind: 'capture-keyframe', keyframe: kf2 });
    state = result2.state;
    expect(state.keyframes).toHaveLength(2);
  });

  it('commits on Enter with 2+ keyframes', () => {
    let state = initialWalkthroughState();
    const kf1: WalkthroughKeyframe = {
      positionMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 1000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 0,
    };
    const kf2: WalkthroughKeyframe = {
      positionMm: { x: 5000, y: 0, z: 0 },
      targetMm: { x: 10000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 5,
    };
    state = reduceWalkthrough(state, { kind: 'capture-keyframe', keyframe: kf1 }).state;
    state = reduceWalkthrough(state, { kind: 'capture-keyframe', keyframe: kf2 }).state;
    const commitResult = reduceWalkthrough(state, { kind: 'commit' });
    expect(commitResult.effect.createCameraPath).toBeDefined();
    expect(commitResult.effect.createCameraPath?.keyframes).toHaveLength(2);
    expect(commitResult.effect.stillActive).toBe(false);
    expect(commitResult.state.keyframes).toHaveLength(0);
  });

  it('does not commit with fewer than 2 keyframes', () => {
    const state = initialWalkthroughState();
    const result = reduceWalkthrough(state, { kind: 'commit' });
    expect(result.effect.createCameraPath).toBeUndefined();
    expect(result.effect.stillActive).toBe(false);
  });

  it('cancel resets state', () => {
    let state = initialWalkthroughState();
    const kf: WalkthroughKeyframe = {
      positionMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 1000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 0,
    };
    state = reduceWalkthrough(state, { kind: 'capture-keyframe', keyframe: kf }).state;
    const result = reduceWalkthrough(state, { kind: 'cancel' });
    expect(result.state.keyframes).toHaveLength(0);
    expect(result.effect.stillActive).toBe(false);
  });
});

describe('D3 — walkthrough interpolation', () => {
  const keyframes: WalkthroughKeyframe[] = [
    {
      positionMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 1000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 0,
    },
    {
      positionMm: { x: 10000, y: 0, z: 0 },
      targetMm: { x: 11000, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 10,
    },
  ];

  it('returns first keyframe at t=0', () => {
    const frame = interpolateWalkthrough(keyframes, 0);
    expect(frame?.positionMm.x).toBe(0);
  });

  it('returns last keyframe at t=totalDuration', () => {
    const frame = interpolateWalkthrough(keyframes, 10);
    expect(frame?.positionMm.x).toBe(10000);
  });

  it('linearly interpolates at midpoint', () => {
    const frame = interpolateWalkthrough(keyframes, 5);
    expect(frame?.positionMm.x).toBeCloseTo(5000, 0);
  });

  it('clamps below start time', () => {
    const frame = interpolateWalkthrough(keyframes, -1);
    expect(frame?.positionMm.x).toBe(0);
  });

  it('clamps above end time', () => {
    const frame = interpolateWalkthrough(keyframes, 100);
    expect(frame?.positionMm.x).toBe(10000);
  });

  it('returns null for empty keyframes', () => {
    const frame = interpolateWalkthrough([], 5);
    expect(frame).toBeNull();
  });
});
