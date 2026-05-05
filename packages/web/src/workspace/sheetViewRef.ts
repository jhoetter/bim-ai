import type { Element } from '@bim-ai/core';

export type SheetViewRefKind = 'plan' | 'section' | 'schedule' | 'viewpoint' | 'unknown';

export type ParsedSheetViewRef = {
  /** Stable vocabulary for agents (`sec:`/`vp:` normalized to `section:`/`viewpoint:`). */
  normalizedRef: string;
  rawRef: string;
  kind: SheetViewRefKind;
  refId: string;
};

/** Parses sheet viewport `plan:` / `section:` / `schedule:` / `viewpoint:` refs (accepts `sec:` / `vp:` aliases). */

export function parseSheetViewRef(viewRefRaw: unknown): ParsedSheetViewRef | null {
  if (typeof viewRefRaw !== 'string') return null;
  const rawRef = viewRefRaw.trim();
  if (!rawRef) {
    return { rawRef: '', normalizedRef: '', kind: 'unknown', refId: '' };
  }
  const colon = rawRef.indexOf(':');
  if (colon < 0) {
    return { rawRef, normalizedRef: rawRef, kind: 'unknown', refId: '' };
  }
  const kindRaw = rawRef.slice(0, colon).trim().toLowerCase();
  const refId = rawRef.slice(colon + 1).trim();

  let kind: SheetViewRefKind = 'unknown';
  let prefix = kindRaw;

  if (kindRaw === 'plan') {
    kind = 'plan';
  } else if (kindRaw === 'section' || kindRaw === 'sec') {
    kind = 'section';
    prefix = 'section';
  } else if (kindRaw === 'schedule') {
    kind = 'schedule';
  } else if (kindRaw === 'viewpoint' || kindRaw === 'vp') {
    kind = 'viewpoint';
    prefix = 'viewpoint';
  }

  const normalizedRef = refId && kind !== 'unknown' ? `${prefix}:${refId}` : rawRef;
  return { rawRef, normalizedRef, kind, refId };
}

/** Parses `plan:`, `schedule:`, `section:`, `viewpoint:` references from sheet viewports into display titles. */

export function resolveViewportTitleFromRef(
  elementsById: Record<string, Element>,
  viewRefRaw: unknown,
) {
  const parsed = parseSheetViewRef(viewRefRaw);
  if (!parsed || !parsed.refId || parsed.kind === 'unknown') {
    return undefined;
  }
  const { refId, kind } = parsed;
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
  if (kind === 'section') {
    if (el?.kind === 'section_cut') return el.name ?? refId;
    return undefined;
  }
  if (kind === 'viewpoint') {
    if (el?.kind === 'viewpoint') return el.name ?? refId;
    return undefined;
  }
  return undefined;
}
