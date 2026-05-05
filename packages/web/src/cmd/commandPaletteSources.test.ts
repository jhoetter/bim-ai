import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE_HINTS,
  parseQuery,
  rankCandidates,
  type CommandCandidate,
} from './commandPaletteSources';

const fixtures: CommandCandidate[] = [
  { id: 'tool.wall', kind: 'tool', label: 'Wall tool', hint: 'W' },
  { id: 'tool.door', kind: 'tool', label: 'Door tool', hint: 'D' },
  { id: 'view.plan', kind: 'view', label: 'Ground plan' },
  { id: 'view.3d', kind: 'view', label: 'Default Orbit' },
  { id: 'el.wall.eg-south', kind: 'element', label: 'EG South facade', keywords: 'wall' },
  { id: 'set.snap.midpoint', kind: 'setting', label: 'Snap: midpoint off' },
  { id: 'agent.review', kind: 'agent', label: 'Run Agent Review' },
];

describe('parseQuery — §18 prefix grammar', () => {
  it('detects > tool prefix', () => {
    expect(parseQuery('>wall')).toEqual({ raw: '>wall', filter: 'tool', needle: 'wall' });
  });
  it('detects @ element prefix', () => {
    expect(parseQuery('@south')).toEqual({ raw: '@south', filter: 'element', needle: 'south' });
  });
  it('detects : setting prefix', () => {
    expect(parseQuery(':snap')).toEqual({ raw: ':snap', filter: 'setting', needle: 'snap' });
  });
  it('returns null filter for prefix-less input', () => {
    expect(parseQuery('plan').filter).toBeNull();
  });
});

describe('rankCandidates — §18', () => {
  it('returns highest-scoring exact-prefix matches first', () => {
    const ranked = rankCandidates(fixtures, parseQuery('wall'));
    expect(ranked[0]?.id).toBe('tool.wall');
  });
  it('honors prefix filter', () => {
    const ranked = rankCandidates(fixtures, parseQuery('>door'));
    expect(ranked.every((r) => r.kind === 'tool')).toBe(true);
    expect(ranked[0]?.id).toBe('tool.door');
  });
  it('uses subsequence matching for sparse needles', () => {
    const ranked = rankCandidates(fixtures, parseQuery('df'));
    expect(ranked.find((r) => r.id === 'view.3d')).toBeDefined();
  });
  it('boosts recent ids to the top', () => {
    const ranked = rankCandidates(fixtures, parseQuery(''), {
      recentIds: ['agent.review'],
    });
    expect(ranked[0]?.id).toBe('agent.review');
  });
  it('limits recents to 5 ids', () => {
    const ranked = rankCandidates(fixtures, parseQuery(''), {
      recentIds: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'agent.review'],
    });
    // agent.review is now position 7 → no boost; sort falls back to priority.
    expect(ranked[0]?.kind).toBe('tool');
  });
  it('returns empty when nothing matches', () => {
    expect(rankCandidates(fixtures, parseQuery('zzzzz'))).toEqual([]);
  });
});

describe('EMPTY_STATE_HINTS', () => {
  it('has at most 5 hints per §18', () => {
    expect(EMPTY_STATE_HINTS.length).toBeLessThanOrEqual(5);
  });
});
