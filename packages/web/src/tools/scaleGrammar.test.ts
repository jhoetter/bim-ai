import { describe, it, expect } from 'vitest';
import { initialScaleState, reduceScale, type ScaleState, type ScaleEvent } from './toolGrammar';

function dispatch(state: ScaleState, ...events: ScaleEvent[]): ScaleState {
  return events.reduce((s, ev) => reduceScale(s, ev).state, state);
}

describe('initialScaleState', () => {
  it('starts idle', () => {
    expect(initialScaleState().phase).toBe('idle');
  });
});

describe('reduceScale — activation', () => {
  it('activate → pick-origin', () => {
    const { state } = reduceScale(initialScaleState(), { kind: 'activate' });
    expect(state.phase).toBe('pick-origin');
  });

  it('deactivate → idle + stillActive false', () => {
    const s = dispatch(initialScaleState(), { kind: 'activate' });
    const { state, effect } = reduceScale(s, { kind: 'deactivate' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });

  it('cancel from pick-reference returns to pick-origin', () => {
    const s = dispatch(initialScaleState(), { kind: 'activate' });
    const { state } = reduceScale(s, { kind: 'cancel' });
    expect(state.phase).toBe('pick-origin');
  });
});

describe('reduceScale — numeric flow', () => {
  it('click in pick-origin → enter-factor with correct originMm', () => {
    const s = dispatch(initialScaleState(), { kind: 'activate' });
    const { state } = reduceScale(s, { kind: 'click', xMm: 500, yMm: 1000 });
    expect(state.phase).toBe('enter-factor');
    if (state.phase === 'enter-factor') {
      expect(state.originMm).toEqual({ xMm: 500, yMm: 1000 });
      expect(state.inputValue).toBe('');
    }
  });

  it('set-input updates inputValue', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'set-input', value: '2' },
    );
    if (s.phase === 'enter-factor') expect(s.inputValue).toBe('2');
  });

  it('confirm with valid factor emits commitScale and returns to pick-origin', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 100, yMm: 200 },
      { kind: 'set-input', value: '1.5' },
    );
    const { state, effect } = reduceScale(s, { kind: 'confirm' });
    expect(state.phase).toBe('pick-origin');
    expect(effect.commitScale).toBeDefined();
    expect(effect.commitScale?.factor).toBeCloseTo(1.5);
    expect(effect.commitScale?.originMm).toEqual({ xMm: 100, yMm: 200 });
  });

  it('confirm with invalid factor (0) keeps state unchanged', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'set-input', value: '0' },
    );
    const { state, effect } = reduceScale(s, { kind: 'confirm' });
    expect(state.phase).toBe('enter-factor');
    expect(effect.commitScale).toBeUndefined();
  });

  it('confirm with non-numeric input keeps state unchanged', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'set-input', value: 'abc' },
    );
    const { state } = reduceScale(s, { kind: 'confirm' });
    expect(state.phase).toBe('enter-factor');
  });
});

describe('reduceScale — graphical flow', () => {
  it('click in enter-factor → pick-reference', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
    );
    const { state } = reduceScale(s, { kind: 'click', xMm: 500, yMm: 0 });
    expect(state.phase).toBe('pick-reference');
  });

  it('click in pick-reference → pick-destination with referenceMm', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 1000, yMm: 0 },
    );
    expect(s.phase).toBe('pick-destination');
    if (s.phase === 'pick-destination') {
      expect(s.referenceMm).toEqual({ xMm: 1000, yMm: 0 });
    }
  });

  it('click in pick-destination emits commitGraphicalScale', () => {
    const s = dispatch(
      initialScaleState(),
      { kind: 'activate' },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 0, yMm: 0 },
      { kind: 'click', xMm: 1000, yMm: 0 },
    );
    const { state, effect } = reduceScale(s, { kind: 'click', xMm: 2000, yMm: 0 });
    expect(state.phase).toBe('pick-origin');
    expect(effect.commitGraphicalScale).toBeDefined();
    expect(effect.commitGraphicalScale?.referenceMm).toEqual({ xMm: 1000, yMm: 0 });
    expect(effect.commitGraphicalScale?.destinationMm).toEqual({ xMm: 2000, yMm: 0 });
  });
});
