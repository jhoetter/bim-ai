/**
 * SKB-23 — per-phase preview rendering filter.
 *
 * Pure helper. Given the active phase filter (from the Zustand store) and
 * an element, decides whether the element should render. The Three.js
 * scene-builder + plan projector both consult `isElementVisibleUnderPhaseFilter`
 * before adding geometry.
 */

export type PhaseFilter = {
  phases: string[];
  includeUntagged: boolean;
} | null;

/**
 * Returns true when the element should render given the active phase
 * filter. With `filter === null` (no filter active), every element
 * renders — this is the default state.
 */
export function isElementVisibleUnderPhaseFilter(
  filter: PhaseFilter,
  element: { phaseId?: string | null } | null | undefined,
): boolean {
  if (!filter) return true;
  if (!element) return false;
  const phase = element.phaseId ?? null;
  if (phase === null) return filter.includeUntagged;
  return filter.phases.includes(phase);
}

/**
 * Convenience: filter an element collection in one shot. Preserves order.
 */
export function applyPhaseFilter<E extends { phaseId?: string | null }>(
  filter: PhaseFilter,
  elements: E[],
): E[] {
  if (!filter) return elements;
  return elements.filter((e) => isElementVisibleUnderPhaseFilter(filter, e));
}
