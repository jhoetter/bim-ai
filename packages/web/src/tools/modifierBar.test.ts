/**
 * CHR-V3-08 — modifierBar.ts unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  getToolModifierDescriptors,
  nextCycleValue,
  TOOL_MODIFIER_DESCRIPTORS,
} from './modifierBar';

describe('getToolModifierDescriptors', () => {
  it('returns empty array for null tool', () => {
    expect(getToolModifierDescriptors(null)).toHaveLength(0);
  });

  it('returns empty array for select tool (no modifiers registered)', () => {
    expect(getToolModifierDescriptors('select')).toHaveLength(0);
  });

  it('returns wall descriptors', () => {
    const descs = getToolModifierDescriptors('wall');
    expect(descs.length).toBeGreaterThan(0);
    const ids = descs.map((d) => d.id);
    expect(ids).toContain('location-line');
    expect(ids).toContain('loop');
    expect(ids).toContain('multiple');
    expect(ids).toContain('tag-on-place');
    expect(ids).toContain('numeric');
    expect(ids).toContain('tab-cycle');
  });

  it('wall location-line descriptor is a sticky cycle with shortcut S', () => {
    const descs = getToolModifierDescriptors('wall');
    const loc = descs.find((d) => d.id === 'location-line');
    expect(loc).toBeDefined();
    expect(loc!.kind).toBe('cycle');
    if (loc!.kind === 'cycle') {
      expect(loc!.shortcut).toBe('S');
      expect(loc!.sticky).toBe(true);
      expect(loc!.defaultValue).toBe('wall-centerline');
      expect(loc!.values).toContain('wall-centerline');
      expect(loc!.values).toContain('finish-face-exterior');
    }
  });

  it('wall loop descriptor is a sticky toggle with shortcut L, default off', () => {
    const descs = getToolModifierDescriptors('wall');
    const loop = descs.find((d) => d.id === 'loop');
    expect(loop).toBeDefined();
    expect(loop!.kind).toBe('toggle');
    if (loop!.kind === 'toggle') {
      expect(loop!.shortcut).toBe('L');
      expect(loop!.sticky).toBe(true);
      expect(loop!.defaultOn).toBe(false);
    }
  });

  it('wall numeric and tab-cycle are always-armed', () => {
    const descs = getToolModifierDescriptors('wall');
    const numeric = descs.find((d) => d.id === 'numeric');
    const tab = descs.find((d) => d.id === 'tab-cycle');
    expect(numeric!.kind).toBe('always-armed');
    expect(tab!.kind).toBe('always-armed');
  });

  it('door has swing-side cycle with shortcut Space', () => {
    const descs = getToolModifierDescriptors('door');
    const swing = descs.find((d) => d.id === 'swing-side');
    expect(swing).toBeDefined();
    expect(swing!.kind).toBe('cycle');
    if (swing!.kind === 'cycle') {
      expect(swing!.shortcut).toBe('Space');
      expect(swing!.values).toContain('left');
      expect(swing!.values).toContain('right');
    }
  });

  it('door multiple defaults to true', () => {
    const descs = getToolModifierDescriptors('door');
    const multi = descs.find((d) => d.id === 'multiple');
    expect(multi).toBeDefined();
    expect(multi!.kind).toBe('toggle');
    if (multi!.kind === 'toggle') {
      expect(multi!.defaultOn).toBe(true);
    }
  });
});

describe('nextCycleValue', () => {
  it('advances to next value in list', () => {
    const descs = getToolModifierDescriptors('wall');
    const loc = descs.find((d) => d.id === 'location-line')!;
    expect(loc.kind).toBe('cycle');
    if (loc.kind === 'cycle') {
      expect(nextCycleValue(loc, 'wall-centerline')).toBe('finish-face-exterior');
      expect(nextCycleValue(loc, 'finish-face-exterior')).toBe('finish-face-interior');
    }
  });

  it('wraps around at the end', () => {
    const descs = getToolModifierDescriptors('wall');
    const loc = descs.find((d) => d.id === 'location-line')!;
    if (loc.kind === 'cycle') {
      const last = loc.values[loc.values.length - 1]!;
      expect(nextCycleValue(loc, last)).toBe(loc.values[0]);
    }
  });

  it('returns first value for unknown current', () => {
    const descs = getToolModifierDescriptors('door');
    const swing = descs.find((d) => d.id === 'swing-side')!;
    if (swing.kind === 'cycle') {
      expect(nextCycleValue(swing, 'unknown')).toBe('left');
    }
  });
});

describe('TOOL_MODIFIER_DESCRIPTORS registry', () => {
  it('select is not registered', () => {
    expect(TOOL_MODIFIER_DESCRIPTORS['select']).toBeUndefined();
  });

  it('all registered tools have at least one descriptor', () => {
    for (const [, descs] of Object.entries(TOOL_MODIFIER_DESCRIPTORS)) {
      expect(descs!.length).toBeGreaterThan(0);
    }
  });
});
