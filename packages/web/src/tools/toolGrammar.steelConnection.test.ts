import { describe, expect, it } from 'vitest';
import { initialSteelConnectionState, reduceSteelConnection } from './toolGrammar';

describe('reduceSteelConnection', () => {
  it('idle → pick-beam effect contains hostElementId', () => {
    const s = initialSteelConnectionState();
    const { effect } = reduceSteelConnection(s, { kind: 'pick-beam', hostElementId: 'beam-42' });
    expect(effect.createSteelConnection?.hostElementId).toBe('beam-42');
    expect(effect.createSteelConnection?.connectionType).toBe('end_plate');
    expect(effect.stillActive).toBe(true);
  });

  it('pick-beam resets state to idle', () => {
    const s = initialSteelConnectionState();
    const { state } = reduceSteelConnection(s, { kind: 'pick-beam', hostElementId: 'beam-1' });
    expect(state.phase).toBe('idle');
  });

  it('cancel returns to idle with stillActive false', () => {
    const s = initialSteelConnectionState();
    const { state, effect } = reduceSteelConnection(s, { kind: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.createSteelConnection).toBeUndefined();
  });

  it('deactivate returns stillActive false', () => {
    const s = initialSteelConnectionState();
    const { effect } = reduceSteelConnection(s, { kind: 'deactivate' });
    expect(effect.stillActive).toBe(false);
  });
});
