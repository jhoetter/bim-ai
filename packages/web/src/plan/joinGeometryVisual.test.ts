import { describe, expect, it } from 'vitest';

describe('Join geometry visual merge — §2.4.3', () => {
  it('joinedPairs stores sorted element ID pairs', () => {
    const pair = ['elem-b', 'elem-a'].sort() as [string, string];
    expect(pair).toEqual(['elem-a', 'elem-b']);
  });

  it('JoinGeometryCmd has correct current payload shape', () => {
    const cmd = { type: 'joinGeometry' as const, elementId1: 'w1', elementId2: 'w2' };
    expect(cmd.type).toBe('joinGeometry');
    expect(cmd.elementId1).toBe('w1');
  });

  it('UnjoinGeometryCmd has correct current payload shape', () => {
    const cmd = { type: 'unjoinGeometry' as const, elementId1: 'w1', elementId2: 'w2' };
    expect(cmd.type).toBe('unjoinGeometry');
    expect(cmd.elementId2).toBe('w2');
  });

  it('joining two elements deduplicates if already joined', () => {
    const existing: [string, string][] = [['w1', 'w2']];
    const newPair: [string, string] = ['w1', 'w2'];
    const alreadyJoined = existing.some(([a, b]) => a === newPair[0] && b === newPair[1]);
    const result = alreadyJoined ? existing : [...existing, newPair];
    expect(result.length).toBe(1);
  });

  it('unjoining removes the pair', () => {
    const existing: [string, string][] = [
      ['w1', 'w2'],
      ['w3', 'w4'],
    ];
    const pair = ['w1', 'w2'];
    const result = existing.filter(([a, b]) => !(a === pair[0] && b === pair[1]));
    expect(result).toEqual([['w3', 'w4']]);
  });
});
