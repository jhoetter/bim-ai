import { describe, expect, it } from 'vitest';
import { initialAttachState, reduceAttach, initialDetachState, reduceDetach } from './toolGrammar';

describe('reduceAttach (WP-C C1a)', () => {
  it('starts idle', () => {
    expect(initialAttachState()).toEqual({ phase: 'idle' });
  });

  it('idle → click wall → picking-target', () => {
    const state = initialAttachState();
    const { state: next, effect } = reduceAttach(state, {
      kind: 'click',
      elementId: 'w1',
      elementKind: 'wall',
    });
    expect(next).toEqual({ phase: 'picking-target', wallId: 'w1' });
    expect(effect.attachWallTop).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('idle → click non-wall → stays idle', () => {
    const state = initialAttachState();
    const { state: next, effect } = reduceAttach(state, {
      kind: 'click',
      elementId: 'r1',
      elementKind: 'roof',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effect.attachWallTop).toBeUndefined();
  });

  it('picking-target → click roof → done with attachWallTop effect', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { state: next, effect } = reduceAttach(picking, {
      kind: 'click',
      elementId: 'r1',
      elementKind: 'roof',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effect.attachWallTop).toEqual({ wallId: 'w1', targetId: 'r1' });
    expect(effect.stillActive).toBe(true);
  });

  it('picking-target → click floor → done with attachWallTop effect', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { effect } = reduceAttach(picking, {
      kind: 'click',
      elementId: 'fl1',
      elementKind: 'floor',
    });
    expect(effect.attachWallTop).toEqual({ wallId: 'w1', targetId: 'fl1' });
  });

  it('picking-target → click ceiling → done with attachWallTop effect', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { effect } = reduceAttach(picking, {
      kind: 'click',
      elementId: 'ceil1',
      elementKind: 'ceiling',
    });
    expect(effect.attachWallTop).toEqual({ wallId: 'w1', targetId: 'ceil1' });
  });

  it('picking-target → click non-target element → stays picking-target', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { state: next, effect } = reduceAttach(picking, {
      kind: 'click',
      elementId: 'w2',
      elementKind: 'wall',
    });
    expect(next).toEqual(picking);
    expect(effect.attachWallTop).toBeUndefined();
  });

  it('picking-target → cancel → back to idle, still active', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { state: next, effect } = reduceAttach(picking, { kind: 'cancel' });
    expect(next).toEqual({ phase: 'idle' });
    expect(effect.attachWallTop).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('deactivate → idle, not active', () => {
    const picking = { phase: 'picking-target' as const, wallId: 'w1' };
    const { state: next, effect } = reduceAttach(picking, { kind: 'deactivate' });
    expect(next).toEqual({ phase: 'idle' });
    expect(effect.stillActive).toBe(false);
  });
});

describe('reduceDetach (WP-C C1a)', () => {
  it('starts idle', () => {
    expect(initialDetachState()).toEqual({ phase: 'idle' });
  });

  it('idle → click wall → emits detachWallTop effect', () => {
    const state = initialDetachState();
    const { state: next, effect } = reduceDetach(state, {
      kind: 'click',
      elementId: 'w1',
      elementKind: 'wall',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effect.detachWallTop).toEqual({ wallId: 'w1' });
    expect(effect.stillActive).toBe(true);
  });

  it('idle → click non-wall → no effect', () => {
    const state = initialDetachState();
    const { effect } = reduceDetach(state, {
      kind: 'click',
      elementId: 'r1',
      elementKind: 'roof',
    });
    expect(effect.detachWallTop).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('cancel → idle, not active', () => {
    const { effect } = reduceDetach(initialDetachState(), { kind: 'cancel' });
    expect(effect.stillActive).toBe(false);
  });
});
