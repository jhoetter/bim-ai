import { describe, expect, it } from 'vitest';

import type { SnapHit } from './snapEngine';
import {
  activeSnapHit,
  bumpSnapTabCycle,
  initialSnapTabCycle,
  snapCandidatesSignature,
  syncSnapTabCycle,
} from './snapTabCycle';

const HITS: SnapHit[] = [
  { kind: 'endpoint', point: { xMm: 0, yMm: 0 } },
  { kind: 'intersection', point: { xMm: 0, yMm: 0 } },
  { kind: 'perpendicular', point: { xMm: 0, yMm: 0 } },
];

describe('EDT-05 — snapTabCycle', () => {
  it('starts at index 0 with empty signature', () => {
    const s = initialSnapTabCycle();
    expect(s.activeIndex).toBe(0);
    expect(s.signature).toBe('');
  });

  it('produces stable signatures for identical hit lists', () => {
    expect(snapCandidatesSignature(HITS)).toEqual(snapCandidatesSignature([...HITS]));
  });

  it('Tab advances to the next candidate', () => {
    const a = bumpSnapTabCycle(initialSnapTabCycle(), HITS);
    expect(a.activeIndex).toBe(1);
    const b = bumpSnapTabCycle(a, HITS);
    expect(b.activeIndex).toBe(2);
    const c = bumpSnapTabCycle(b, HITS);
    expect(c.activeIndex).toBe(0); // wraps
  });

  it('does not advance when only one candidate exists', () => {
    const single: SnapHit[] = [HITS[0]!];
    const next = bumpSnapTabCycle(initialSnapTabCycle(), single);
    expect(next.activeIndex).toBe(0);
  });

  it('resyncs to index 0 when the candidate-set signature changes', () => {
    const cycled = bumpSnapTabCycle(initialSnapTabCycle(), HITS);
    expect(cycled.activeIndex).toBe(1);
    const newHits: SnapHit[] = [{ kind: 'endpoint', point: { xMm: 999, yMm: 999 } }];
    const synced = syncSnapTabCycle(cycled, newHits);
    expect(synced.activeIndex).toBe(0);
    expect(synced.signature).toBe(snapCandidatesSignature(newHits));
  });

  it('keeps the same state when the signature is unchanged', () => {
    const a = bumpSnapTabCycle(initialSnapTabCycle(), HITS);
    const b = syncSnapTabCycle(a, HITS);
    expect(b).toBe(a);
  });

  it('resolves the active hit modulo length', () => {
    expect(activeSnapHit({ activeIndex: 0, signature: '' }, HITS)?.kind).toBe('endpoint');
    expect(activeSnapHit({ activeIndex: 1, signature: '' }, HITS)?.kind).toBe('intersection');
    expect(activeSnapHit({ activeIndex: 17, signature: '' }, HITS)?.kind).toBe('perpendicular');
    expect(activeSnapHit({ activeIndex: 0, signature: '' }, [])).toBeUndefined();
  });
});
