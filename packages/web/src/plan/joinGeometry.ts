export interface JoinGeometryCommand {
  type: 'joinGeometry';
  elementId1: string;
  elementId2: string;
}

export interface UnjoinGeometryCommand {
  type: 'unjoinGeometry';
  elementId1: string;
  elementId2: string;
}

/** Element kinds that participate in solid geometry joins (Revit-parity B7). */
const SOLID_KINDS = new Set(['wall', 'floor', 'roof', 'ceiling', 'column', 'beam']);

/**
 * Returns a JoinGeometryCommand with canonically-sorted IDs (id1 < id2),
 * matching Revit's deterministic join-pair storage.
 */
export function buildJoinCommand(id1: string, id2: string): JoinGeometryCommand {
  const [a, b] = [id1, id2].sort();
  return { type: 'joinGeometry', elementId1: a, elementId2: b };
}

/**
 * Returns an UnjoinGeometryCommand with canonically-sorted IDs (id1 < id2).
 */
export function buildUnjoinCommand(id1: string, id2: string): UnjoinGeometryCommand {
  const [a, b] = [id1, id2].sort();
  return { type: 'unjoinGeometry', elementId1: a, elementId2: b };
}

/**
 * Returns true when both element kinds are solid geometry types that support
 * Revit-style join operations. Non-solid hosted families (door, window, room,
 * etc.) are excluded.
 */
export function canJoin(kind1: string, kind2: string): boolean {
  return SOLID_KINDS.has(kind1) && SOLID_KINDS.has(kind2);
}

/**
 * Returns true when the current selection is exactly two elements whose kinds
 * both support joining.
 */
export function selectionSupportsJoin(
  selectedIds: string[],
  getKind: (id: string) => string,
): boolean {
  if (selectedIds.length !== 2) return false;
  return canJoin(getKind(selectedIds[0]), getKind(selectedIds[1]));
}

/**
 * Returns a JoinGeometryCommand if the selection is a valid joinable pair,
 * or null otherwise. IDs are sorted canonically inside the returned command.
 */
export function buildJoinCommandsForSelection(
  selectedIds: string[],
  getKind: (id: string) => string,
): JoinGeometryCommand | null {
  if (!selectionSupportsJoin(selectedIds, getKind)) return null;
  return buildJoinCommand(selectedIds[0], selectedIds[1]);
}
