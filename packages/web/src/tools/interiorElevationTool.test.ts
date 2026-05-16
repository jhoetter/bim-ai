/**
 * D2 — Interior Elevation Marker tool tests.
 */
import { describe, expect, it } from 'vitest';
import { getToolRegistry, paletteForMode } from './toolRegistry';

const t = ((key: string) => key) as never;

describe('D2 — interior-elevation tool registry entry', () => {
  it('registers an interior-elevation tool with IE hotkey', () => {
    const reg = getToolRegistry(t);
    expect(reg['interior-elevation']).toBeDefined();
    expect(reg['interior-elevation'].id).toBe('interior-elevation');
    expect(reg['interior-elevation'].hotkey).toBe('IE');
  });

  it('appears in plan palette only', () => {
    expect(paletteForMode('plan', t).map((t) => t.id)).toContain('interior-elevation');
    expect(paletteForMode('3d', t).map((t) => t.id)).not.toContain('interior-elevation');
  });

  it('sits right after the elevation tool in the palette order', () => {
    const ids = paletteForMode('plan', t).map((t) => t.id);
    const elIdx = ids.indexOf('elevation');
    const ieIdx = ids.indexOf('interior-elevation');
    expect(elIdx).toBeGreaterThanOrEqual(0);
    expect(ieIdx).toBe(elIdx + 1);
  });
});
