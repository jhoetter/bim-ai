import { describe, it, expect } from 'vitest';
import {
  canJoin,
  buildJoinCommand,
  buildUnjoinCommand,
  selectionSupportsJoin,
  buildJoinCommandsForSelection,
} from './joinGeometry';

describe('canJoin', () => {
  it('returns true for two solid element kinds', () => {
    expect(canJoin('wall', 'floor')).toBe(true);
    expect(canJoin('wall', 'wall')).toBe(true);
    expect(canJoin('roof', 'wall')).toBe(true);
    expect(canJoin('ceiling', 'floor')).toBe(true);
    expect(canJoin('column', 'beam')).toBe(true);
  });

  it('returns false when one kind is non-solid (door)', () => {
    expect(canJoin('wall', 'door')).toBe(false);
  });

  it('returns false when both kinds are non-solid', () => {
    expect(canJoin('door', 'window')).toBe(false);
    expect(canJoin('room', 'room')).toBe(false);
  });
});

describe('buildJoinCommand', () => {
  it('sorts IDs canonically so id1 < id2', () => {
    const cmd = buildJoinCommand('z-element', 'a-element');
    expect(cmd.type).toBe('joinGeometry');
    expect(cmd.elementId1).toBe('a-element');
    expect(cmd.elementId2).toBe('z-element');
  });

  it('is stable when IDs are already in order', () => {
    const cmd = buildJoinCommand('alpha', 'beta');
    expect(cmd.elementId1).toBe('alpha');
    expect(cmd.elementId2).toBe('beta');
  });
});

describe('buildUnjoinCommand', () => {
  it('sorts IDs canonically so id1 < id2', () => {
    const cmd = buildUnjoinCommand('z-element', 'a-element');
    expect(cmd.type).toBe('unjoinGeometry');
    expect(cmd.elementId1).toBe('a-element');
    expect(cmd.elementId2).toBe('z-element');
  });
});

describe('selectionSupportsJoin', () => {
  const kindMap: Record<string, string> = {
    w1: 'wall',
    w2: 'wall',
    d1: 'door',
    f1: 'floor',
  };
  const getKind = (id: string) => kindMap[id] ?? 'unknown';

  it('returns true for exactly 2 solid elements', () => {
    expect(selectionSupportsJoin(['w1', 'w2'], getKind)).toBe(true);
    expect(selectionSupportsJoin(['w1', 'f1'], getKind)).toBe(true);
  });

  it('returns false for a single element', () => {
    expect(selectionSupportsJoin(['w1'], getKind)).toBe(false);
  });

  it('returns false when one element is non-solid', () => {
    expect(selectionSupportsJoin(['w1', 'd1'], getKind)).toBe(false);
  });

  it('returns false for more than 2 elements', () => {
    expect(selectionSupportsJoin(['w1', 'w2', 'f1'], getKind)).toBe(false);
  });
});

describe('buildJoinCommandsForSelection', () => {
  const kindMap: Record<string, string> = {
    w1: 'wall',
    w2: 'wall',
    d1: 'door',
  };
  const getKind = (id: string) => kindMap[id] ?? 'unknown';

  it('returns a JoinGeometryCommand for a valid solid pair', () => {
    const cmd = buildJoinCommandsForSelection(['w2', 'w1'], getKind);
    expect(cmd).not.toBeNull();
    expect(cmd?.type).toBe('joinGeometry');
    // IDs should be sorted canonically
    expect(cmd?.elementId1).toBe('w1');
    expect(cmd?.elementId2).toBe('w2');
  });

  it('returns null when selection includes a non-solid element', () => {
    expect(buildJoinCommandsForSelection(['w1', 'd1'], getKind)).toBeNull();
  });

  it('returns null for an empty selection', () => {
    expect(buildJoinCommandsForSelection([], getKind)).toBeNull();
  });

  it('returns null for a single-element selection', () => {
    expect(buildJoinCommandsForSelection(['w1'], getKind)).toBeNull();
  });
});
