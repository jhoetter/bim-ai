import { describe, expect, it } from 'vitest';
import { initialPaintState, reducePaint } from './toolGrammar';

describe('paint tool grammar — §3.3.4', () => {
  it('activate transitions to active status', () => {
    const initial = initialPaintState();
    expect(initial.status).toBe('idle');

    const { state } = reducePaint(initial, { kind: 'activate' });
    expect(state.status).toBe('active');
  });

  it('hover updates hoveredFaceId and hoveredElementId', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { state } = reducePaint(active, {
      kind: 'hover',
      faceId: 'front',
      elementId: 'el-1',
    });
    expect(state.status).toBe('active');
    if (state.status === 'active') {
      expect(state.hoveredFaceId).toBe('front');
      expect(state.hoveredElementId).toBe('el-1');
    }
  });

  it('click emits PaintFaceCmd with correct elementId/faceId/materialId', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { effect } = reducePaint(active, {
      kind: 'click',
      faceId: 'top',
      elementId: 'floor-42',
      materialId: 'mat-concrete',
    });
    expect(effect.paintFace).toEqual({
      elementId: 'floor-42',
      faceId: 'top',
      materialId: 'mat-concrete',
    });
  });

  it('stays active after click (does not auto-finish)', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { state, effect } = reducePaint(active, {
      kind: 'click',
      faceId: 'top',
      elementId: 'floor-42',
      materialId: 'mat-concrete',
    });
    expect(state.status).toBe('active');
    expect(effect.stillActive).toBe(true);
  });

  it('cancel transitions to idle', () => {
    const { state: active } = reducePaint(initialPaintState(), { kind: 'activate' });
    const { state, effect } = reducePaint(active, { kind: 'cancel' });
    expect(state.status).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});
