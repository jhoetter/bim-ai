import { describe, expect, it } from 'vitest';

import { checkHeadHeightClearances, type ClearanceViolation } from './openingClearance';

describe('checkHeadHeightClearances — §8.4', () => {
  it('returns empty array when no elements on level', () => {
    const result = checkHeadHeightClearances('L1', {});
    expect(result).toEqual([]);
  });

  it('returns empty array when elements are on a different level', () => {
    const door = {
      kind: 'door' as const,
      id: 'd1',
      name: 'Door 1',
      wallId: 'w1',
      levelId: 'L2',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 1800 },
    };
    const result = checkHeadHeightClearances('L1', { d1: door as never });
    expect(result).toHaveLength(0);
  });

  it('flags door with heightMm below 2100', () => {
    const door = {
      kind: 'door' as const,
      id: 'd1',
      name: 'Door 1',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 1800 },
    };
    const result = checkHeadHeightClearances('L1', { d1: door as never });
    expect(result).toHaveLength(1);
    expect(result[0]!.elementId).toBe('d1');
    expect(result[0]!.clearanceMm).toBe(1800);
  });

  it('does not flag door with heightMm >= 2100', () => {
    const door = {
      kind: 'door' as const,
      id: 'd2',
      name: 'Door 2',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 2100 },
    };
    const result = checkHeadHeightClearances('L1', { d2: door as never });
    expect(result).toHaveLength(0);
  });

  it('does not flag door with default height (2100)', () => {
    const door = {
      kind: 'door' as const,
      id: 'd3',
      name: 'Door 3',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
    };
    const result = checkHeadHeightClearances('L1', { d3: door as never });
    expect(result).toHaveLength(0);
  });

  it('violation message contains element kind and measurements', () => {
    const door = {
      kind: 'door' as const,
      id: 'd4',
      name: 'Door 4',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 1950 },
    };
    const result = checkHeadHeightClearances('L1', { d4: door as never });
    expect(result).toHaveLength(1);
    const v = result[0] as ClearanceViolation;
    expect(v.message).toContain('1950mm');
    expect(v.message).toContain('2100mm');
    expect(v.kind).toBe('door');
    expect(v.requiredMm).toBe(2100);
  });

  it('ignores elements on other levels', () => {
    const door1 = {
      kind: 'door' as const,
      id: 'd5',
      name: 'Door 5',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 1800 },
    };
    const door2 = {
      kind: 'door' as const,
      id: 'd6',
      name: 'Door 6',
      wallId: 'w2',
      levelId: 'L2',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 1800 },
    };
    const result = checkHeadHeightClearances('L1', {
      d5: door1 as never,
      d6: door2 as never,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.elementId).toBe('d5');
  });

  it('flags window where sillHeightMm + heightMm < 2100', () => {
    const win = {
      kind: 'window' as const,
      id: 'w1',
      name: 'Win 1',
      wallId: 'wall1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 500,
      heightMm: 800,
    };
    const result = checkHeadHeightClearances('L1', { w1: win as never });
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('window');
    expect(result[0]!.clearanceMm).toBe(1300);
  });

  it('does not flag window where sillHeightMm + heightMm >= 2100', () => {
    const win = {
      kind: 'window' as const,
      id: 'w2',
      name: 'Win 2',
      wallId: 'wall1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 900,
      heightMm: 1200,
    };
    const result = checkHeadHeightClearances('L1', { w2: win as never });
    expect(result).toHaveLength(0);
  });

  it('uses custom requiredDoorMm threshold', () => {
    const door = {
      kind: 'door' as const,
      id: 'd7',
      name: 'Door 7',
      wallId: 'w1',
      levelId: 'L1',
      alongT: 0.5,
      widthMm: 900,
      overrideParams: { heightMm: 2000 },
    };
    // With default 2100 threshold -> violation
    expect(checkHeadHeightClearances('L1', { d7: door as never })).toHaveLength(1);
    // With custom 1900 threshold -> no violation
    expect(checkHeadHeightClearances('L1', { d7: door as never }, 1900)).toHaveLength(0);
  });
});
