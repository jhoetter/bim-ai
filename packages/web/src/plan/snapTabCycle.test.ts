import { describe, expect, it } from 'vitest';

import type { SnapHit } from './snapEngine';
import { applySnapSettings, DEFAULT_SNAP_SETTINGS } from './snapSettings';
import {
  activeSnapHit,
  bumpSnapTabCycle,
  initialSnapTabCycle,
  SNAP_TAB_CYCLE_ORDER,
  snapCandidatesSignature,
  syncSnapTabCycle,
} from './snapTabCycle';

const HITS: SnapHit[] = [
  { kind: 'endpoint', point: { xMm: 0, yMm: 0 } },
  { kind: 'intersection', point: { xMm: 0, yMm: 0 } },
  { kind: 'perpendicular', point: { xMm: 0, yMm: 0 } },
];

/** EDT-05 closeout — fixture covering every kind in cycle order. */
const HITS_FULL: SnapHit[] = [
  { kind: 'endpoint', point: { xMm: 1, yMm: 1 } },
  { kind: 'intersection', point: { xMm: 2, yMm: 2 } },
  { kind: 'perpendicular', point: { xMm: 3, yMm: 3 } },
  { kind: 'extension', point: { xMm: 4, yMm: 4 } },
  { kind: 'parallel', point: { xMm: 5, yMm: 5 } },
  { kind: 'tangent', point: { xMm: 6, yMm: 6 } },
  { kind: 'workplane', point: { xMm: 7, yMm: 7 } },
  { kind: 'grid', point: { xMm: 8, yMm: 8 } },
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

/* ─── EDT-05 closeout — full cycle including new kinds ──────────────── */

describe('EDT-05 closeout — Tab cycle covers parallel / tangent / workplane', () => {
  it('exposes all eight kinds in canonical cycle order', () => {
    expect(SNAP_TAB_CYCLE_ORDER).toEqual([
      'endpoint',
      'intersection',
      'perpendicular',
      'extension',
      'parallel',
      'tangent',
      'workplane',
      'grid',
      'raw',
    ]);
  });

  it('Tab walks every kind including parallel / tangent / workplane', () => {
    let s = initialSnapTabCycle();
    const visited: SnapHit['kind'][] = [];
    for (let i = 0; i < HITS_FULL.length; i++) {
      visited.push(activeSnapHit(s, HITS_FULL)!.kind);
      s = bumpSnapTabCycle(s, HITS_FULL);
    }
    expect(visited).toEqual([
      'endpoint',
      'intersection',
      'perpendicular',
      'extension',
      'parallel',
      'tangent',
      'workplane',
      'grid',
    ]);
  });

  it('respects per-kind toggle — disabled kinds drop out of the cycle', () => {
    // tangent default off — applySnapSettings drops it. parallel and
    // workplane stay in.
    const filtered = applySnapSettings(HITS_FULL, DEFAULT_SNAP_SETTINGS);
    expect(filtered.map((h) => h.kind)).toEqual([
      'endpoint',
      'intersection',
      'perpendicular',
      'extension',
      'parallel',
      'workplane',
      'grid',
    ]);

    // Turning workplane off too should leave parallel as the only new
    // kind in the cycle.
    const noWorkplane = applySnapSettings(HITS_FULL, {
      ...DEFAULT_SNAP_SETTINGS,
      workplane: false,
    });
    expect(noWorkplane.map((h) => h.kind)).toContain('parallel');
    expect(noWorkplane.map((h) => h.kind)).not.toContain('workplane');
    expect(noWorkplane.map((h) => h.kind)).not.toContain('tangent');
  });
});
