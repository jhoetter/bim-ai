import { afterEach, describe, expect, it } from 'vitest';

import {
  GLOBAL_RECENCY_SCOPE,
  paletteRecencyKey,
  paletteRecencyScopeForCommand,
  usePaletteRecencyStore,
} from './paletteRecencyStore';

afterEach(() => {
  usePaletteRecencyStore.setState({ invocations: {} });
});

describe('palette recency scoping', () => {
  it('keeps universal commands global while view-specific commands use active view scope', () => {
    expect(
      paletteRecencyScopeForCommand('theme.toggle', {
        activeMode: 'plan',
        activeViewId: 'plan-a',
      }),
    ).toBe(GLOBAL_RECENCY_SCOPE);
    expect(
      paletteRecencyScopeForCommand('tool.wall', {
        activeMode: 'plan',
        activeViewId: 'plan-a',
      }),
    ).toBe('view:plan-a');
  });

  it('falls back to active mode scope when no active view id exists', () => {
    expect(
      paletteRecencyScopeForCommand('view.3d.fit', {
        activeMode: '3d',
        activeViewId: null,
      }),
    ).toBe('mode:3d');
  });

  it('does not leak scoped command recency across views', () => {
    const store = usePaletteRecencyStore.getState();
    store.recordInvocation('tool.wall', 'view:plan-a');

    expect(store.getRecencyScore('tool.wall', 'view:plan-a')).toBeGreaterThan(0);
    expect(store.getRecencyScore('tool.wall', 'view:plan-b')).toBe(0);
    expect(usePaletteRecencyStore.getState().invocations[paletteRecencyKey('tool.wall')]).toBe(
      undefined,
    );
  });
});
