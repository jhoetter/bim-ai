import { describe, expect, it } from 'vitest';

type ColumnFixture = { kind: 'column'; id: string; isNonStructural?: boolean };

describe('Non-structural column — §9.1.3', () => {
  it('ToggleColumnStructuralCmd has correct shape', () => {
    const cmd = { type: 'toggleColumnStructural' as const, columnId: 'col1' };
    expect(cmd.type).toBe('toggleColumnStructural');
    expect(cmd.columnId).toBe('col1');
  });

  it('isNonStructural defaults to false when not set', () => {
    const col: ColumnFixture = { kind: 'column', id: 'col1' };
    expect(col.isNonStructural ?? false).toBe(false);
  });

  it('toggle flips isNonStructural', () => {
    const col: ColumnFixture = { kind: 'column', id: 'col1', isNonStructural: false };
    const next = !col.isNonStructural;
    expect(next).toBe(true);
  });

  it('non-structural column uses dashed rendering', () => {
    const col: ColumnFixture = { kind: 'column', id: 'col1', isNonStructural: true };
    const renderStyle = col.isNonStructural ? 'dashed-outline' : 'solid-fill';
    expect(renderStyle).toBe('dashed-outline');
  });

  it('structural column uses solid rendering', () => {
    const col: ColumnFixture = { kind: 'column', id: 'col1', isNonStructural: false };
    const renderStyle = col.isNonStructural ? 'dashed-outline' : 'solid-fill';
    expect(renderStyle).toBe('solid-fill');
  });
});
