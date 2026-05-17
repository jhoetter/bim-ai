import { describe, expect, it } from 'vitest';
import { initialLineworkState, reduceLinework } from '../tools/toolGrammar';

describe('linework override — §3.3.7', () => {
  it('grammar starts in idle state', () => {
    const state = initialLineworkState();
    expect(state.status).toBe('idle');
  });

  it('activating tool transitions to active state', () => {
    const initial = initialLineworkState();
    const { state, effect } = reduceLinework(initial, { kind: 'activate' });
    expect(state.status).toBe('active');
    expect(effect.stillActive).toBe(true);
  });

  it('click in active state emits applyLineworkOverride effect with elementId', () => {
    const initial = initialLineworkState();
    const { state: active } = reduceLinework(initial, { kind: 'activate' });
    const { state, effect } = reduceLinework(active, {
      kind: 'click',
      elementId: 'el-001',
      colorHex: '#ff0000',
      lineWeightPx: 2,
      lineDash: [4, 4],
    });
    expect(state.status).toBe('active');
    expect(effect.stillActive).toBe(true);
    expect(effect.applyLineworkOverride).toBeDefined();
    expect(effect.applyLineworkOverride!.elementId).toBe('el-001');
    expect(effect.applyLineworkOverride!.colorHex).toBe('#ff0000');
    expect(effect.applyLineworkOverride!.lineWeightPx).toBe(2);
    expect(effect.applyLineworkOverride!.lineDash).toEqual([4, 4]);
  });

  it('escape from active state returns to idle', () => {
    const initial = initialLineworkState();
    const { state: active } = reduceLinework(initial, { kind: 'activate' });
    const { state, effect } = reduceLinework(active, { kind: 'cancel' });
    expect(state.status).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});
