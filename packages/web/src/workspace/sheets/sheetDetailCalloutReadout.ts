import type { Element } from '@bim-ai/core';

import { parseSheetViewRef, resolveViewportTitleFromRef } from './sheetViewRef';

export type SheetViewportRole = 'standard' | 'detail_callout';

/** Aligns with Python ``read_viewport_role``. */
export function readViewportRoleFromRaw(raw: Record<string, unknown>): SheetViewportRole {
  const v = raw.viewportRole ?? raw.viewport_role;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase().replace(/-/g, '_');
    if (s === 'detail_callout' || s === 'detailcallout') return 'detail_callout';
  }
  return 'standard';
}

/** Closed vocabulary matching ``_detail_callout_unresolved_reason`` (Python). */
export function detailCalloutUnresolvedReason(
  elementsById: Record<string, Element>,
  viewRef: string,
): string {
  const raw = viewRef.trim();
  if (!raw) return 'empty_view_ref';
  const parsed = parseSheetViewRef(raw);
  if (!parsed || parsed.kind === 'unknown') return 'unknown_ref_prefix';
  if (!parsed.refId) return 'unknown_ref_prefix';
  const ttl = resolveViewportTitleFromRef(elementsById, raw);
  if (ttl !== undefined) return '';
  if (parsed.kind === 'plan') return 'unresolved_plan_view';
  if (parsed.kind === 'section') return 'unresolved_section_cut';
  if (parsed.kind === 'schedule') return 'unresolved_schedule';
  if (parsed.kind === 'viewpoint') return 'unresolved_viewpoint';
  return 'unknown_ref_prefix';
}

/** Mirrors Python ``build_placeholder_detail_title``. */
export function buildPlaceholderDetailTitle(
  detailNumber: string,
  resolvedTitle: string | undefined,
  unresolvedReason: string,
): string {
  const base = detailNumber.trim() ? `Detail ${detailNumber.trim()}` : 'Detail';
  if (unresolvedReason) return `${base} — unresolved`;
  if (resolvedTitle?.trim()) return `${base} — ${resolvedTitle.trim()}`;
  return base;
}
