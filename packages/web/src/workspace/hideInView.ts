import type { Element } from '@bim-ai/core';

type ElementsById = Record<string, Element>;

const STRUCTURAL_KINDS = new Set(['plan_view', 'level', 'grid']);

export function applyHideInView(
  elementsById: ElementsById,
  viewId: string,
  elementIds: string[],
): ElementsById {
  const pv = elementsById[viewId];
  if (!pv || pv.kind !== 'plan_view') return elementsById;
  const merged = new Set([...(pv.hiddenElementIds ?? []), ...elementIds]);
  return { ...elementsById, [viewId]: { ...pv, hiddenElementIds: [...merged] } };
}

export function applyIsolateInView(
  elementsById: ElementsById,
  viewId: string,
  elementIds: string[],
): ElementsById {
  const pv = elementsById[viewId];
  if (!pv || pv.kind !== 'plan_view') return elementsById;
  const keepVisible = new Set(elementIds);
  const toHide = Object.values(elementsById)
    .filter((el) => !STRUCTURAL_KINDS.has(el.kind) && !keepVisible.has(el.id))
    .map((el) => el.id);
  return { ...elementsById, [viewId]: { ...pv, hiddenElementIds: toHide } };
}

export function applyResetHiddenInView(elementsById: ElementsById, viewId: string): ElementsById {
  const pv = elementsById[viewId];
  if (!pv || pv.kind !== 'plan_view') return elementsById;
  return { ...elementsById, [viewId]: { ...pv, hiddenElementIds: [] } };
}
