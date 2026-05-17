import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { applyHideInView, applyIsolateInView, applyResetHiddenInView } from './hideInView';

const pv = (id: string, hidden: string[] = []): Element =>
  ({ kind: 'plan_view', id, levelId: 'lvl-1', hiddenElementIds: hidden }) as Extract<
    Element,
    { kind: 'plan_view' }
  >;

const wall = (id: string): Element =>
  ({
    kind: 'wall',
    id,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 1000, yMm: 0 },
    thicknessMm: 200,
    levelId: 'lvl-1',
  }) as unknown as Extract<Element, { kind: 'wall' }>;

const level = (id: string): Element =>
  ({ kind: 'level', id, name: 'Ground', elevationMm: 0 }) as Extract<Element, { kind: 'level' }>;

function makeElements(): Record<string, Element> {
  return {
    'pv-1': pv('pv-1'),
    'wall-a': wall('wall-a'),
    'wall-b': wall('wall-b'),
    'wall-c': wall('wall-c'),
    'lvl-1': level('lvl-1'),
  };
}

describe('hide / isolate / reset in view — §1.6.10', () => {
  it('hide_in_view appends element IDs to hiddenElementIds', () => {
    const result = applyHideInView(makeElements(), 'pv-1', ['wall-a']);
    const pv1 = result['pv-1'] as Extract<Element, { kind: 'plan_view' }>;
    expect(pv1.hiddenElementIds).toContain('wall-a');
  });

  it('hide_in_view deduplicates if element already hidden', () => {
    const base = { ...makeElements(), 'pv-1': pv('pv-1', ['wall-a']) };
    const result = applyHideInView(base, 'pv-1', ['wall-a', 'wall-b']);
    const pv1 = result['pv-1'] as Extract<Element, { kind: 'plan_view' }>;
    expect(pv1.hiddenElementIds?.filter((id) => id === 'wall-a')).toHaveLength(1);
    expect(pv1.hiddenElementIds).toContain('wall-b');
  });

  it('isolate_in_view hides all elements not in the given set', () => {
    const result = applyIsolateInView(makeElements(), 'pv-1', ['wall-a']);
    const pv1 = result['pv-1'] as Extract<Element, { kind: 'plan_view' }>;
    expect(pv1.hiddenElementIds).toContain('wall-b');
    expect(pv1.hiddenElementIds).toContain('wall-c');
    expect(pv1.hiddenElementIds).not.toContain('wall-a');
    expect(pv1.hiddenElementIds).not.toContain('pv-1');
    expect(pv1.hiddenElementIds).not.toContain('lvl-1');
  });

  it('reset_hidden_in_view clears hiddenElementIds to empty array', () => {
    const base = { ...makeElements(), 'pv-1': pv('pv-1', ['wall-a', 'wall-b']) };
    const result = applyResetHiddenInView(base, 'pv-1');
    const pv1 = result['pv-1'] as Extract<Element, { kind: 'plan_view' }>;
    expect(pv1.hiddenElementIds).toEqual([]);
  });
});
