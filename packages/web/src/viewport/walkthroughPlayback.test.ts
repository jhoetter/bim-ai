import { describe, expect, it } from 'vitest';

import type { CameraPathElem, WalkthroughKeyframe } from '@bim-ai/core';

import { interpolateKeyframes } from './WalkthroughPlaybackPanel';

const kf0: WalkthroughKeyframe = {
  positionMm: { x: 0, y: 0, z: 0 },
  targetMm: { x: 1000, y: 0, z: 0 },
  fovDeg: 60,
  timeSec: 0,
};

const kf1: WalkthroughKeyframe = {
  positionMm: { x: 2000, y: 0, z: 0 },
  targetMm: { x: 3000, y: 0, z: 0 },
  fovDeg: 90,
  timeSec: 10,
};

const keyframes = [kf0, kf1];

describe('walkthrough RAF playback — §14.6', () => {
  it('lerps position between two keyframes at alpha=0.5', () => {
    const frame = interpolateKeyframes(keyframes, 5);
    expect(frame).not.toBeNull();
    expect(frame!.positionMm.x).toBeCloseTo(1000, 5);
    expect(frame!.targetMm.x).toBeCloseTo(2000, 5);
    expect(frame!.fovDeg).toBeCloseTo(75, 5);
  });

  it('lerps correctly at alpha=0 (first keyframe exact)', () => {
    const frame = interpolateKeyframes(keyframes, 0);
    expect(frame).not.toBeNull();
    expect(frame!.positionMm.x).toBe(0);
    expect(frame!.targetMm.x).toBe(1000);
    expect(frame!.fovDeg).toBe(60);
  });

  it('lerps correctly at alpha=1 (second keyframe exact)', () => {
    const frame = interpolateKeyframes(keyframes, 10);
    expect(frame).not.toBeNull();
    expect(frame!.positionMm.x).toBe(2000);
    expect(frame!.targetMm.x).toBe(3000);
    expect(frame!.fovDeg).toBe(90);
  });

  it('clamps to last keyframe when time exceeds path duration', () => {
    const frame = interpolateKeyframes(keyframes, 999);
    expect(frame).not.toBeNull();
    expect(frame!.positionMm.x).toBe(2000);
    expect(frame!.timeSec).toBe(10);
  });

  it('export produces valid JSON with all keyframes', () => {
    const path: CameraPathElem = {
      kind: 'camera_path',
      id: 'path-1',
      name: 'My Walkthrough',
      keyframes,
    };
    const json = JSON.stringify(path, null, 2);
    const parsed = JSON.parse(json) as CameraPathElem;
    expect(parsed.name).toBe('My Walkthrough');
    expect(parsed.keyframes).toHaveLength(2);
    expect(parsed.keyframes[0]!.positionMm.x).toBe(0);
    expect(parsed.keyframes[1]!.positionMm.x).toBe(2000);
  });
});
