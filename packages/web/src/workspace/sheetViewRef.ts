import type { Element } from '@bim-ai/core';

/** Parses `plan:`, `schedule:`, `section:` references from sheet viewports into display titles. */

export function resolveViewportTitleFromRef(
  elementsById: Record<string, Element>,
  viewRefRaw: unknown,
) {
  if (typeof viewRefRaw !== 'string' || !viewRefRaw.includes(':')) {
    return undefined;
  }
  const [kindRaw, refRaw] = viewRefRaw.split(':', 2);
  const kind = kindRaw.trim().toLowerCase();
  const refId = refRaw.trim();
  if (!refId) return undefined;

  const el = elementsById[refId];

  if (kind === 'plan') {
    if (el?.kind === 'plan_view') return el.name ?? refId;
    if (el?.kind === 'level') return `Level ${el.name}`;
    return undefined;
  }
  if (kind === 'schedule') {
    if (el?.kind === 'schedule') return el.name ?? refId;
    return undefined;
  }
  if (kind === 'section' || kind === 'sec') {
    if (el?.kind === 'section_cut') return el.name ?? refId;
    return undefined;
  }
  return undefined;
}
