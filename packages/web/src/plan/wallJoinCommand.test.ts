import { describe, expect, it } from 'vitest';

describe('SetWallJoinCmd — §3.5.5', () => {
  it('has correct shape', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'miter' as const,
    };
    expect(cmd.type).toBe('setWallJoin');
    expect(cmd.wallIds).toHaveLength(2);
    expect(cmd.variant).toBe('miter');
  });

  it('accepts butt variant', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'butt' as const,
    };
    expect(cmd.variant).toBe('butt');
  });

  it('accepts square variant', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'square' as const,
    };
    expect(cmd.variant).toBe('square');
  });
});
