export function applyAttachWallTopCmd(
  elementsById: Record<string, Record<string, unknown>>,
  wallId: string,
  hostId: string,
): Record<string, Record<string, unknown>> {
  const wall = elementsById[wallId];
  if (!wall || wall['kind'] !== 'wall') return elementsById;
  return { ...elementsById, [wallId]: { ...wall, roofAttachmentId: hostId } };
}

export function applyDetachWallTopCmd(
  elementsById: Record<string, Record<string, unknown>>,
  wallId: string,
): Record<string, Record<string, unknown>> {
  const wall = elementsById[wallId];
  if (!wall || wall['kind'] !== 'wall') return elementsById;
  return { ...elementsById, [wallId]: { ...wall, roofAttachmentId: null } };
}
