import { describe, expect, it } from 'vitest';
import {
  buildPinCommand,
  buildUnpinCommand,
  filterPinnable,
  buildPinToggleCommands,
  PADLOCK_GLYPH_SIZE_PX,
} from './pinUnpin';

describe('buildPinCommand', () => {
  it('returns null for empty array', () => {
    expect(buildPinCommand([])).toBeNull();
  });

  it('returns pin command for non-empty array', () => {
    expect(buildPinCommand(['a', 'b'])).toEqual({
      type: 'pinElements',
      elementIds: ['a', 'b'],
    });
  });

  it('deduplicates element IDs', () => {
    expect(buildPinCommand(['a', 'b', 'a'])).toEqual({
      type: 'pinElements',
      elementIds: ['a', 'b'],
    });
  });

  it('handles a single element', () => {
    expect(buildPinCommand(['x'])).toEqual({ type: 'pinElements', elementIds: ['x'] });
  });
});

describe('buildUnpinCommand', () => {
  it('returns null for empty array', () => {
    expect(buildUnpinCommand([])).toBeNull();
  });

  it('returns unpin command for non-empty array', () => {
    expect(buildUnpinCommand(['a', 'b'])).toEqual({
      type: 'unpinElements',
      elementIds: ['a', 'b'],
    });
  });

  it('deduplicates element IDs', () => {
    expect(buildUnpinCommand(['a', 'b', 'a'])).toEqual({
      type: 'unpinElements',
      elementIds: ['a', 'b'],
    });
  });
});

describe('filterPinnable', () => {
  const getPinState = (id: string): boolean | undefined => {
    if (id === 'pinned-1' || id === 'pinned-2') return true;
    if (id === 'unpinned-1') return false;
    return undefined; // treat as unpinned
  };

  it('splits correctly into pinned and unpinned buckets', () => {
    const result = filterPinnable(['pinned-1', 'unpinned-1', 'pinned-2', 'unknown-1'], getPinState);
    expect(result.pinned).toEqual(['pinned-1', 'pinned-2']);
    expect(result.unpinned).toEqual(['unpinned-1', 'unknown-1']);
  });

  it('returns empty pinned for all-unpinned input', () => {
    const result = filterPinnable(['unpinned-1', 'unknown-1'], getPinState);
    expect(result.pinned).toEqual([]);
    expect(result.unpinned).toEqual(['unpinned-1', 'unknown-1']);
  });

  it('returns empty unpinned for all-pinned input', () => {
    const result = filterPinnable(['pinned-1', 'pinned-2'], getPinState);
    expect(result.pinned).toEqual(['pinned-1', 'pinned-2']);
    expect(result.unpinned).toEqual([]);
  });

  it('handles empty input', () => {
    const result = filterPinnable([], getPinState);
    expect(result.pinned).toEqual([]);
    expect(result.unpinned).toEqual([]);
  });
});

describe('buildPinToggleCommands', () => {
  it('returns empty array for empty elementIds', () => {
    expect(buildPinToggleCommands([], () => undefined)).toEqual([]);
  });

  it('pins all unpinned elements when none are pinned', () => {
    const commands = buildPinToggleCommands(['a', 'b'], () => false);
    expect(commands).toEqual([{ type: 'pinElements', elementIds: ['a', 'b'] }]);
  });

  it('unpins all pinned elements when all are pinned', () => {
    const commands = buildPinToggleCommands(['a', 'b'], () => true);
    expect(commands).toEqual([{ type: 'unpinElements', elementIds: ['a', 'b'] }]);
  });

  it('builds both pin and unpin commands for mixed selection', () => {
    const getPinState = (id: string) => id === 'pinned-1';
    const commands = buildPinToggleCommands(['unpinned-1', 'pinned-1', 'unpinned-2'], getPinState);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({ type: 'pinElements', elementIds: ['unpinned-1', 'unpinned-2'] });
    expect(commands[1]).toEqual({ type: 'unpinElements', elementIds: ['pinned-1'] });
  });
});

describe('PADLOCK_GLYPH_SIZE_PX', () => {
  it('is 12', () => {
    expect(PADLOCK_GLYPH_SIZE_PX).toBe(12);
  });
});
