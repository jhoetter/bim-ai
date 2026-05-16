import { describe, it, expect } from 'vitest';
import { initialSplitWallState, reduceSplitWall, type SplitWallState } from './toolGrammar';

describe('split wall grammar — §3.3.6', () => {
  it('activate moves to active phase', () => {
    const state = initialSplitWallState();
    const { state: next, effect } = reduceSplitWall(state, { kind: 'activate' });
    expect(next.phase).toBe('active');
    expect(effect.stillActive).toBe(true);
  });

  it('hoverWall updates hoverWallId and hoverPointMm', () => {
    const idle = initialSplitWallState();
    const { state: active } = reduceSplitWall(idle, { kind: 'activate' });
    const pt = { xMm: 1000, yMm: 2000 };
    const { state: next, effect } = reduceSplitWall(active, {
      kind: 'hoverWall',
      wallId: 'wall-1',
      pointMm: pt,
    });
    expect(next.phase).toBe('active');
    if (next.phase === 'active') {
      expect(next.hoverWallId).toBe('wall-1');
      expect(next.hoverPointMm).toEqual(pt);
    }
    expect(effect.previewSplitPoint).toEqual({ wallId: 'wall-1', pointMm: pt });
  });

  it('click emits splitWall effect with wallId and splitPointMm', () => {
    const idle = initialSplitWallState();
    const { state: active } = reduceSplitWall(idle, { kind: 'activate' });
    const pt = { xMm: 500, yMm: 1500 };
    const { effect } = reduceSplitWall(active, {
      kind: 'click',
      wallId: 'wall-2',
      pointMm: pt,
    });
    expect(effect.splitWall).toEqual({ wallId: 'wall-2', splitPointMm: pt });
    expect(effect.stillActive).toBe(true);
  });

  it('cancel returns to idle', () => {
    const idle = initialSplitWallState();
    const { state: active } = reduceSplitWall(idle, { kind: 'activate' });
    const { state: back, effect } = reduceSplitWall(active, { kind: 'cancel' });
    expect(back.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });

  it('stays active after click (repeated-use tool)', () => {
    const idle = initialSplitWallState();
    const { state: active } = reduceSplitWall(idle, { kind: 'activate' });
    const { state: after } = reduceSplitWall(active, {
      kind: 'click',
      wallId: 'wall-3',
      pointMm: { xMm: 0, yMm: 0 },
    });
    expect(after.phase).toBe('active');
  });

  it('hoverClear clears hover state', () => {
    const idle = initialSplitWallState();
    const { state: active } = reduceSplitWall(idle, { kind: 'activate' });
    const { state: hovered } = reduceSplitWall(active, {
      kind: 'hoverWall',
      wallId: 'w1',
      pointMm: { xMm: 100, yMm: 100 },
    });
    const { state: cleared, effect } = reduceSplitWall(hovered, { kind: 'hoverClear' });
    if (cleared.phase === 'active') {
      expect(cleared.hoverWallId).toBeNull();
      expect(cleared.hoverPointMm).toBeNull();
    }
    expect(effect.previewSplitPoint).toBeNull();
  });
});
