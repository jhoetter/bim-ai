import { describe, expect, it } from 'vitest';
import { reduceCutGeometry } from './toolGrammar';

describe('reduceCutGeometry — §3.3.4', () => {
  it('starts idle', () => {
    const { next } = reduceCutGeometry({ phase: 'idle' }, { kind: 'activate' });
    expect(next.phase).toBe('idle');
  });

  it('transitions to picking-host on first pick', () => {
    const { next } = reduceCutGeometry({ phase: 'idle' }, { kind: 'pick', elementId: 'col1' });
    expect(next.phase).toBe('picking-host');
    expect((next as Extract<typeof next, { phase: 'picking-host' }>).cutterId).toBe('col1');
  });

  it('emits commitCutGeometry on second pick', () => {
    const { next, effect } = reduceCutGeometry(
      { phase: 'picking-host', cutterId: 'col1' },
      { kind: 'pick', elementId: 'wall1' },
    );
    expect(next.phase).toBe('idle');
    expect(effect?.kind).toBe('commitCutGeometry');
    expect(effect?.cutterId).toBe('col1');
    expect(effect?.hostId).toBe('wall1');
  });

  it('cancels back to idle on cancel', () => {
    const { next } = reduceCutGeometry(
      { phase: 'picking-host', cutterId: 'col1' },
      { kind: 'cancel' },
    );
    expect(next.phase).toBe('idle');
  });
});
