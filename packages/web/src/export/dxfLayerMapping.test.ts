import { describe, expect, it } from 'vitest';

function resolveLayerName(defaultName: string, mapping?: Record<string, string>): string {
  return mapping?.[defaultName] ?? defaultName;
}

describe('DXF layer name mapping — §12.4.2', () => {
  it('returns default name when no mapping', () => {
    expect(resolveLayerName('A-WALL')).toBe('A-WALL');
  });

  it('returns override when mapping provided', () => {
    expect(resolveLayerName('A-WALL', { 'A-WALL': 'WAND' })).toBe('WAND');
  });

  it('returns default for unmapped layers', () => {
    expect(resolveLayerName('A-DOOR', { 'A-WALL': 'WAND' })).toBe('A-DOOR');
  });

  it('SetDxfLayerMappingCmd has correct shape', () => {
    const cmd = {
      type: 'setDxfLayerMapping' as const,
      mapping: { 'A-WALL': 'WAND', 'A-DOOR': 'TÜR' },
    };
    expect(cmd.type).toBe('setDxfLayerMapping');
    expect(cmd.mapping['A-WALL']).toBe('WAND');
  });

  it('merges mapping with existing', () => {
    const existing = { 'A-WALL': 'WAND' };
    const update = { 'A-DOOR': 'TÜR' };
    const merged = { ...existing, ...update };
    expect(merged['A-WALL']).toBe('WAND');
    expect(merged['A-DOOR']).toBe('TÜR');
  });
});
