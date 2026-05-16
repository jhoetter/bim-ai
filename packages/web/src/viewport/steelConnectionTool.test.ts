import { describe, expect, it } from 'vitest';
import { initialSteelConnectionState, reduceSteelConnection } from '../tools/toolGrammar';

describe('steel connection grammar — §9.5.1', () => {
  it('activate transitions from idle to pick-host', () => {
    const s = initialSteelConnectionState();
    const { state, effect } = reduceSteelConnection(s, { kind: 'activate' });
    expect(state.phase).toBe('pick-host');
    expect(effect.stillActive).toBe(true);
    expect(effect.createSteelConnection).toBeUndefined();
  });

  it('activate defaults connectionType to end_plate', () => {
    const s = initialSteelConnectionState();
    const { state } = reduceSteelConnection(s, { kind: 'activate' });
    if (state.phase === 'pick-host') {
      expect(state.connectionType).toBe('end_plate');
    } else {
      throw new Error('expected pick-host phase');
    }
  });

  it('click in pick-host transitions to pick-target with hostElementId', () => {
    const s0 = initialSteelConnectionState();
    const { state: s1 } = reduceSteelConnection(s0, { kind: 'activate' });
    const { state, effect } = reduceSteelConnection(s1, {
      kind: 'click',
      pickedElementId: 'beam-10',
    });
    expect(state.phase).toBe('pick-target');
    if (state.phase === 'pick-target') {
      expect(state.hostElementId).toBe('beam-10');
    }
    expect(effect.stillActive).toBe(true);
    expect(effect.createSteelConnection).toBeUndefined();
  });

  it('second click emits createSteelConnection effect', () => {
    const s0 = initialSteelConnectionState();
    const { state: s1 } = reduceSteelConnection(s0, { kind: 'activate' });
    const { state: s2 } = reduceSteelConnection(s1, {
      kind: 'click',
      pickedElementId: 'beam-10',
    });
    const { state, effect } = reduceSteelConnection(s2, {
      kind: 'click',
      pickedElementId: 'col-5',
    });
    expect(state.phase).toBe('idle');
    expect(effect.createSteelConnection).toBeDefined();
    expect(effect.createSteelConnection?.hostElementId).toBe('beam-10');
    expect(effect.createSteelConnection?.targetElementId).toBe('col-5');
    expect(effect.createSteelConnection?.connectionType).toBe('end_plate');
    expect(effect.createSteelConnection?.positionT).toBe(1.0);
    expect(effect.stillActive).toBe(true);
  });

  it('cancel from pick-host returns to idle', () => {
    const s0 = initialSteelConnectionState();
    const { state: s1 } = reduceSteelConnection(s0, { kind: 'activate' });
    const { state, effect } = reduceSteelConnection(s1, { kind: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.createSteelConnection).toBeUndefined();
  });

  it('cancel from pick-target returns to idle', () => {
    const s0 = initialSteelConnectionState();
    const { state: s1 } = reduceSteelConnection(s0, { kind: 'activate' });
    const { state: s2 } = reduceSteelConnection(s1, {
      kind: 'click',
      pickedElementId: 'beam-1',
    });
    const { state, effect } = reduceSteelConnection(s2, { kind: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.createSteelConnection).toBeUndefined();
  });
});
