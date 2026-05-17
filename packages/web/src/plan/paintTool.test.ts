import { describe, expect, it } from 'vitest';
import { initialPaintState, reducePaint } from '../tools/toolGrammar';

describe('paint tool grammar — §3.3.4', () => {
  it('starts in idle state', () => {
    const initial = initialPaintState();
    expect(initial.status).toBe('idle');
  });

  it('tool activate transitions to active state', () => {
    const initial = initialPaintState();
    const { state } = reducePaint(initial, { kind: 'activate' });
    expect(state.status).toBe('active');
  });

  it('face click emits paintFace effect with elementId, faceId, and materialId', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { effect } = reducePaint(active, {
      kind: 'click',
      faceId: 'top',
      elementId: 'floor-1',
      materialId: 'mat-tile',
    });
    expect(effect.paintFace).toBeDefined();
    expect(effect.paintFace!.elementId).toBe('floor-1');
    expect(effect.paintFace!.faceId).toBe('top');
    expect(effect.paintFace!.materialId).toBe('mat-tile');
    expect(effect.stillActive).toBe(true);
  });

  it('Escape returns to idle', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { state, effect } = reducePaint(active, { kind: 'cancel' });
    expect(state.status).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});
