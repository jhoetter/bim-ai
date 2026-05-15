import type { ToolId } from '../tools/toolRegistry';

/**
 * Maps element kind strings to the corresponding placement ToolId.
 * Used by "Create Similar" (CS shortcut) to activate the correct tool
 * pre-loaded with the selected element's type.
 */
export const KIND_TO_TOOL: Partial<Record<string, ToolId>> = {
  wall: 'wall',
  door: 'door',
  window: 'window',
  floor: 'floor',
  roof: 'roof',
  column: 'column',
  beam: 'beam',
  room: 'room',
  ceiling: 'ceiling',
  stair: 'stair',
  railing: 'railing',
  grid: 'grid',
};

/**
 * Returns the ToolId for a given element kind, or null if no mapping exists.
 */
export function getToolForElementKind(kind: string): ToolId | null {
  return KIND_TO_TOOL[kind] ?? null;
}

/**
 * Builds the payload needed to activate "Create Similar" for the given element.
 * Returns null if the element kind has no corresponding placement tool.
 */
export function createSimilarPayload(element: {
  kind: string;
  typeId?: string;
}): { toolId: ToolId; typeId: string | undefined } | null {
  const toolId = getToolForElementKind(element.kind);
  if (toolId === null) return null;
  return { toolId, typeId: element.typeId };
}
