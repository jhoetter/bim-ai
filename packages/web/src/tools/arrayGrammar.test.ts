import { describe, it, expect } from 'vitest';
import { initialArrayState, reduceArray, type ArrayState, type ArrayEvent } from './toolGrammar';

function dispatch(state: ArrayState, ...events: ArrayEvent[]): ArrayState {
  return events.reduce((s, ev) => reduceArray(s, ev).state, state);
}

describe('initialArrayState', () => {
  it('starts in idle linear mode', () => {
    const s = initialArrayState();
    expect(s.phase).toBe('idle');
    if (s.phase === 'idle') {
      expect(s.mode).toBe('linear');
      expect(s.moveToLast).toBe(true);
    }
  });
});

describe('reduceArray — linear flow', () => {
  it('activate → idle, deactivate → stillActive false', () => {
    const s = initialArrayState();
    const { state: s2, effect: e2 } = reduceArray(s, { kind: 'activate' });
    expect(s2.phase).toBe('idle');
    expect(e2.stillActive).toBe(true);
    const { effect: e3 } = reduceArray(s2, { kind: 'deactivate' });
    expect(e3.stillActive).toBe(false);
  });

  it('idle → pick-start on first click (linear)', () => {
    const s = dispatch(initialArrayState(), { kind: 'click', xMm: 0, yMm: 0 });
    expect(s.phase).toBe('pick-start');
  });

  it('pick-start → pick-end on second click, records startMm', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 1000, yMm: 0 },
    );
    expect(s.phase).toBe('pick-end');
    if (s.phase === 'pick-end') {
      expect(s.startMm).toEqual({ xMm: 1000, yMm: 0 });
    }
  });

  it('pick-end → confirm-linear on third click, default count 3', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 5000, yMm: 0 },
    );
    expect(s.phase).toBe('confirm-linear');
    if (s.phase === 'confirm-linear') {
      expect(s.count).toBe(3);
      expect(s.endMm).toEqual({ xMm: 5000, yMm: 0 });
    }
  });

  it('confirm-linear → commits linear array with correct params', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 5000, yMm: 0 },
    );
    const { state: s2, effect } = reduceArray(s, { kind: 'confirm' });
    expect(effect.commitLinear).toBeDefined();
    expect(effect.commitLinear?.count).toBe(3);
    expect(effect.commitLinear?.endMm).toEqual({ xMm: 5000, yMm: 0 });
    expect(effect.commitLinear?.moveToLast).toBe(true);
    expect(s2.phase).toBe('idle');
  });

  it('set-count updates count in confirm-linear phase', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 5000, yMm: 0 },
      { kind: 'set-count', count: 5 },
    );
    expect(s.phase).toBe('confirm-linear');
    if (s.phase === 'confirm-linear') expect(s.count).toBe(5);
  });

  it('cancel resets to idle', () => {
    const s = dispatch(initialArrayState(), { kind: 'click', xMm: 0, yMm: 0 }, { kind: 'cancel' });
    expect(s.phase).toBe('idle');
  });

  it('toggle-move-to-last flips the flag', () => {
    const s = dispatch(initialArrayState(), { kind: 'toggle-move-to-last' });
    if (s.phase === 'idle') expect(s.moveToLast).toBe(false);
  });
});

describe('reduceArray — radial flow', () => {
  it('set-mode to radial transitions to radial idle', () => {
    const s = dispatch(initialArrayState(), { kind: 'set-mode', mode: 'radial' });
    expect(s.phase).toBe('idle');
    if (s.phase === 'idle') expect(s.mode).toBe('radial');
  });

  it('radial idle → pick-center on click', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'set-mode', mode: 'radial' },
      { kind: 'click', xMm: 0, yMm: 0 },
    );
    expect(s.phase).toBe('pick-center');
  });

  it('pick-center → confirm-radial on click, defaults angleDeg=360, count=3', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'set-mode', mode: 'radial' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 2000, yMm: 3000 },
    );
    expect(s.phase).toBe('confirm-radial');
    if (s.phase === 'confirm-radial') {
      expect(s.centerMm).toEqual({ xMm: 2000, yMm: 3000 });
      expect(s.angleDeg).toBe(360);
      expect(s.count).toBe(3);
    }
  });

  it('set-angle updates angleDeg in confirm-radial', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'set-mode', mode: 'radial' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'set-angle', angleDeg: 90 },
    );
    if (s.phase === 'confirm-radial') expect(s.angleDeg).toBe(90);
  });

  it('confirm-radial commits radial array', () => {
    const s = dispatch(
      initialArrayState(),
      { kind: 'set-mode', mode: 'radial' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 1000, yMm: 0 },
      { kind: 'set-count', count: 4 },
    );
    const { effect } = reduceArray(s, { kind: 'confirm' });
    expect(effect.commitRadial).toBeDefined();
    expect(effect.commitRadial?.count).toBe(4);
    expect(effect.commitRadial?.angleDeg).toBe(360);
  });
});
