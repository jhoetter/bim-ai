/**
 * §1.6.10 — mergeOverrides pure function tests.
 */
import { describe, it, expect } from 'vitest';
import type { CategoryVisualOverride } from '@bim-ai/core';

import { mergeOverrides } from './symbology';

// CategoryVisualOverride in practice is extended with a `category` field
// by the per-view VG dialog.
type CVO = CategoryVisualOverride & { category?: string };

describe('mergeOverrides — §1.6.10', () => {
  it('view override shadows global for same category', () => {
    const global: CVO[] = [{ category: 'wall', colorHex: '#000000', hidden: false }];
    const view: CVO[] = [{ category: 'wall', colorHex: '#ff0000', hidden: true }];
    const result = mergeOverrides(
      global as CategoryVisualOverride[],
      view as CategoryVisualOverride[],
    );
    const wallOvr = (result as CVO[]).find((o) => o.category === 'wall');
    expect(wallOvr?.colorHex).toBe('#ff0000');
    expect(wallOvr?.hidden).toBe(true);
  });

  it('global override survives when view has no entry for that category', () => {
    const global: CVO[] = [
      { category: 'wall', colorHex: '#111111' },
      { category: 'floor', colorHex: '#222222' },
    ];
    const view: CVO[] = [{ category: 'wall', colorHex: '#ff0000' }];
    const result = mergeOverrides(
      global as CategoryVisualOverride[],
      view as CategoryVisualOverride[],
    ) as CVO[];
    const floorOvr = result.find((o) => o.category === 'floor');
    expect(floorOvr?.colorHex).toBe('#222222');
  });

  it('empty view overrides returns global overrides unchanged', () => {
    const global: CVO[] = [
      { category: 'wall', colorHex: '#aabbcc' },
      { category: 'door', hidden: true },
    ];
    const result = mergeOverrides(global as CategoryVisualOverride[], []) as CVO[];
    expect(result).toHaveLength(2);
    const wallOvr = result.find((o) => o.category === 'wall');
    expect(wallOvr?.colorHex).toBe('#aabbcc');
  });
});
