/**
 * §1.8.1 — TAB cycle through overlapping elements at the cursor.
 *
 * When the user presses Tab in select mode and there are multiple elements
 * under the cursor, this helper advances selection to the next candidate in
 * a deterministic round-robin order. The sort is by element id so repeated
 * presses are stable across renders.
 */

/**
 * Given a sorted list of candidate element ids under the cursor and the
 * currently selected element id (or null if nothing is selected), return
 * the id of the element that should become selected next.
 *
 * - If `hoveredIds` is empty, returns null.
 * - If `currentSelectedId` is null or not in the candidates list, returns
 *   the first candidate.
 * - Otherwise advances to the next candidate, wrapping around.
 */
export function nextTabSelection(
  hoveredIds: string[],
  currentSelectedId: string | null,
): string | null {
  if (hoveredIds.length === 0) return null;
  if (currentSelectedId === null) return hoveredIds[0]!;
  const idx = hoveredIds.indexOf(currentSelectedId);
  if (idx === -1) return hoveredIds[0]!;
  return hoveredIds[(idx + 1) % hoveredIds.length]!;
}
