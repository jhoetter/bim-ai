import { describe, expect, it } from 'vitest';

import { resolveSnapOverrideShortcut } from './snapOverrideShortcuts';

describe('resolveSnapOverrideShortcut', () => {
  it('starts a two-key sequence on S', () => {
    expect(resolveSnapOverrideShortcut({ key: 's' }, null, 1000)).toEqual({
      nextState: { key: 's', time: 1000 },
      override: null,
    });
  });

  it('resolves a supported second key within the timeout', () => {
    expect(resolveSnapOverrideShortcut({ key: 'I' }, { key: 's', time: 1000 }, 1300)).toEqual({
      nextState: null,
      override: 'intersection',
    });
  });

  it('clears unsupported second keys without activating an override', () => {
    expect(resolveSnapOverrideShortcut({ key: 'q' }, { key: 's', time: 1000 }, 1200)).toEqual({
      nextState: null,
      override: null,
    });
  });

  it('restarts the sequence after the timeout', () => {
    expect(resolveSnapOverrideShortcut({ key: 's' }, { key: 's', time: 1000 }, 1700)).toEqual({
      nextState: { key: 's', time: 1700 },
      override: null,
    });
  });

  it('ignores modified key chords without clearing the pending state', () => {
    expect(
      resolveSnapOverrideShortcut({ key: 'i', ctrlKey: true }, { key: 's', time: 1000 }, 1200),
    ).toEqual({
      nextState: { key: 's', time: 1000 },
      override: null,
    });
  });
});
