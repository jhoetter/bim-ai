/**
 * EDT-02 — locked-state lookup for temp-dimension padlock UI.
 *
 * Walks the world's `constraint` elements and returns the one whose
 * `equal_distance` rule references the same two walls (in either
 * order). Used by `TempDimLayer` to switch the padlock chip from open
 * to filled, and by the click handler to avoid double-locking.
 */
import type { Element } from '@bim-ai/core';

type Constraint = Extract<Element, { kind: 'constraint' }>;

function isConstraint(el: Element): el is Constraint {
  return el.kind === 'constraint';
}

function refIds(refs: Constraint['refsA']): string[] {
  return refs.map((r) => r.elementId).filter((s): s is string => Boolean(s));
}

function pairMatches(c: Constraint, aId: string, bId: string): boolean {
  if (c.rule !== 'equal_distance') return false;
  const a = refIds(c.refsA);
  const b = refIds(c.refsB);
  if (a.length !== 1 || b.length !== 1) return false;
  return (a[0] === aId && b[0] === bId) || (a[0] === bId && b[0] === aId);
}

export function findLockedConstraintFor(
  aId: string,
  bId: string,
  elements: Element[],
): Element | undefined {
  if (!aId || !bId || aId === bId) return undefined;
  for (const el of elements) {
    if (!isConstraint(el)) continue;
    if (pairMatches(el, aId, bId)) return el;
  }
  return undefined;
}
