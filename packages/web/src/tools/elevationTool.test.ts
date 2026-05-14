import { describe, expect, it } from 'vitest';

import { getToolRegistry, paletteForMode } from './toolRegistry';

const tIdentity = ((key: string) => key) as never;

describe('VIE-03 — elevation tool registry entry', () => {
  it('registers an elevation tool with EL hotkey', () => {
    const reg = getToolRegistry(tIdentity);
    expect(reg.elevation).toBeDefined();
    expect(reg.elevation.id).toBe('elevation');
    expect(reg.elevation.hotkey).toBe('EL');
  });

  it('shows up in plan palette, not in 3d-only', () => {
    expect(paletteForMode('plan', tIdentity).map((t) => t.id)).toContain('elevation');
    expect(paletteForMode('3d', tIdentity).map((t) => t.id)).not.toContain('elevation');
  });

  it('lives next to the section tool in the palette order', () => {
    const ids = paletteForMode('plan', tIdentity).map((t) => t.id);
    const sIdx = ids.indexOf('section');
    const eIdx = ids.indexOf('elevation');
    expect(sIdx).toBeGreaterThanOrEqual(0);
    expect(eIdx).toBe(sIdx + 1);
  });
});
