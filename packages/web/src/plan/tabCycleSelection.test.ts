import { describe, expect, it } from 'vitest';

import { nextTabSelection } from './tabCycleSelection';

describe('TAB cycle selection — §1.8.1', () => {
  const candidates = ['elem-a', 'elem-b', 'elem-c'];

  it('returns first candidate when nothing selected', () => {
    expect(nextTabSelection(candidates, null)).toBe('elem-a');
  });

  it('advances to next candidate on repeated calls', () => {
    expect(nextTabSelection(candidates, 'elem-a')).toBe('elem-b');
    expect(nextTabSelection(candidates, 'elem-b')).toBe('elem-c');
  });

  it('wraps around to first candidate after last', () => {
    expect(nextTabSelection(candidates, 'elem-c')).toBe('elem-a');
  });

  it('returns null when no candidates', () => {
    expect(nextTabSelection([], null)).toBeNull();
    expect(nextTabSelection([], 'elem-a')).toBeNull();
  });

  it('returns first candidate when selected id is not in candidates', () => {
    expect(nextTabSelection(candidates, 'unknown-id')).toBe('elem-a');
  });
});
