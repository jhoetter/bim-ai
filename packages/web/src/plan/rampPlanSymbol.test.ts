import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { rampPlanSymbol } from './rampPlanSymbol';

type RampElem = Extract<Element, { kind: 'ramp' }>;

function makeRamp(overrides: Partial<RampElem> = {}): RampElem {
  return {
    kind: 'ramp',
    id: 'ramp-1',
    name: 'Test Ramp',
    levelId: 'lvl-0',
    topLevelId: 'lvl-1',
    widthMm: 2000,
    runMm: 6000,
    runAngleDeg: 0,
    insertionXMm: 0,
    insertionYMm: 0,
    hasRailingLeft: false,
    hasRailingRight: false,
    slopePercent: 8.33,
    ...overrides,
  };
}

describe('rampPlanSymbol', () => {
  it('returns a THREE.Group for a standard ramp', () => {
    const result = rampPlanSymbol(makeRamp());
    expect(result).toBeInstanceOf(THREE.Group);
  });

  it('sets bimPickId on the group', () => {
    const group = rampPlanSymbol(makeRamp({ id: 'ramp-abc' }));
    expect(group.userData.bimPickId).toBe('ramp-abc');
  });

  it('produces children (outline + arrow lines)', () => {
    const group = rampPlanSymbol(makeRamp());
    expect(group.children.length).toBeGreaterThan(1);
  });

  it('emits a console.warn for ramps steeper than 8.33%', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rampPlanSymbol(makeRamp({ slopePercent: 10 }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('slopePercent=10%'));
    warnSpy.mockRestore();
  });

  it('does NOT warn for ramps at exactly 8.33%', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rampPlanSymbol(makeRamp({ slopePercent: 8.33 }));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles non-zero runAngleDeg without throwing', () => {
    expect(() => rampPlanSymbol(makeRamp({ runAngleDeg: 45 }))).not.toThrow();
  });
});
