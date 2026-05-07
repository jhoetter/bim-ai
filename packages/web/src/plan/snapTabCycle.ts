/**
 * EDT-05 — Tab-cycle index controller.
 *
 * Tracks which snap candidate is "active" while the cursor lingers in
 * one place. `bumpOnTab` is called from the Tab keydown handler and
 * advances the cursor. `resetOnMove` is called when the candidate set
 * changes (or its key signature changes) so the cycle starts over at
 * index 0 — otherwise a Tab press from a previous frame would silently
 * select a now-different snap.
 */

import type { SnapHit } from './snapEngine';

export interface SnapTabCycleState {
  activeIndex: number;
  /** Stable signature of the current candidate set. Detect cursor /
   *  candidate-set changes via signature mismatch, not pointer-move
   *  fires, so a stationary cursor with stable hits keeps its index. */
  signature: string;
}

export function initialSnapTabCycle(): SnapTabCycleState {
  return { activeIndex: 0, signature: '' };
}

/** Stable signature for a candidate list. */
export function snapCandidatesSignature(hits: SnapHit[]): string {
  return hits
    .map((h) => `${h.kind}:${Math.round(h.point.xMm)}:${Math.round(h.point.yMm)}`)
    .join('|');
}

/** Reset the index to 0 if the candidate-set signature has changed. */
export function syncSnapTabCycle(prev: SnapTabCycleState, hits: SnapHit[]): SnapTabCycleState {
  const sig = snapCandidatesSignature(hits);
  if (sig === prev.signature) return prev;
  return { activeIndex: 0, signature: sig };
}

/** Advance the active index, wrapping at the end. No-op when only one
 *  (or zero) candidates are available. */
export function bumpSnapTabCycle(prev: SnapTabCycleState, hits: SnapHit[]): SnapTabCycleState {
  if (hits.length <= 1) return prev;
  const sig = snapCandidatesSignature(hits);
  const base = sig === prev.signature ? prev.activeIndex : 0;
  return { activeIndex: (base + 1) % hits.length, signature: sig };
}

/** Resolve the currently-active hit, clamping a stale index silently. */
export function activeSnapHit(state: SnapTabCycleState, hits: SnapHit[]): SnapHit | undefined {
  if (hits.length === 0) return undefined;
  const idx = ((state.activeIndex % hits.length) + hits.length) % hits.length;
  return hits[idx];
}
