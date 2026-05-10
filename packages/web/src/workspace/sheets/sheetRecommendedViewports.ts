import type { Element } from '@bim-ai/core';

import { normalizeSheetPaperMm } from './sheetPaper';
import type { SheetViewportMmDraft } from './sheetViewportAuthoring';

type SheetEl = Extract<Element, { kind: 'sheet' }>;
type PlaceableView = Extract<
  Element,
  { kind: 'plan_view' } | { kind: 'section_cut' } | { kind: 'schedule' } | { kind: 'viewpoint' }
>;

function viewRefFor(el: PlaceableView): string {
  switch (el.kind) {
    case 'plan_view':
      return `plan:${el.id}`;
    case 'section_cut':
      return `section:${el.id}`;
    case 'schedule':
      return `schedule:${el.id}`;
    case 'viewpoint':
      return `viewpoint:${el.id}`;
  }
}

export function sheetViewRefForElement(el: PlaceableView): string {
  return viewRefFor(el);
}

function sortViews(a: PlaceableView, b: PlaceableView): number {
  const order: Record<PlaceableView['kind'], number> = {
    plan_view: 0,
    section_cut: 1,
    schedule: 2,
    viewpoint: 3,
  };
  const oa = order[a.kind] - order[b.kind];
  return oa !== 0 ? oa : a.name.localeCompare(b.name);
}

function existingRefs(sheet: SheetEl): Set<string> {
  return new Set(
    (sheet.viewportsMm ?? [])
      .map((vp) => {
        const raw = vp as Record<string, unknown>;
        const ref = raw.viewRef ?? raw.view_ref;
        return typeof ref === 'string' ? ref.trim().toLowerCase() : '';
      })
      .filter(Boolean),
  );
}

function normalizePersistedViewport(
  raw: Record<string, unknown>,
  index: number,
): SheetViewportMmDraft {
  const viewRef = typeof raw.viewRef === 'string' ? raw.viewRef : String(raw.view_ref ?? '');
  const viewportId =
    typeof raw.viewportId === 'string'
      ? raw.viewportId
      : typeof raw.viewport_id === 'string'
        ? raw.viewport_id
        : `vp-existing-${index}`;
  return {
    viewportId,
    label: typeof raw.label === 'string' ? raw.label : 'Viewport',
    viewRef,
    detailNumber:
      typeof raw.detailNumber === 'string'
        ? raw.detailNumber
        : typeof raw.detail_number === 'string'
          ? raw.detail_number
          : '',
    scale: typeof raw.scale === 'string' ? raw.scale : '',
    viewportLocked: Boolean(raw.viewportLocked ?? raw.viewport_locked ?? raw.locked),
    viewportRole:
      raw.viewportRole === 'detail_callout' || raw.viewport_role === 'detail_callout'
        ? 'detail_callout'
        : 'standard',
    xMm: Number(raw.xMm ?? raw.x_mm ?? 0),
    yMm: Number(raw.yMm ?? raw.y_mm ?? 0),
    widthMm: Math.max(10, Number(raw.widthMm ?? raw.width_mm ?? raw.wMm ?? raw.w_mm ?? 1000)),
    heightMm: Math.max(10, Number(raw.heightMm ?? raw.height_mm ?? raw.hMm ?? raw.h_mm ?? 1000)),
    cropMinMm: null,
    cropMaxMm: null,
  };
}

export function recommendedViewsForSheet(
  elementsById: Record<string, Element>,
  sheetId: string,
): PlaceableView[] {
  const sheet = elementsById[sheetId];
  if (!sheet || sheet.kind !== 'sheet') return [];
  const seen = existingRefs(sheet);
  return Object.values(elementsById)
    .filter((el): el is PlaceableView => {
      if (
        el.kind !== 'plan_view' &&
        el.kind !== 'section_cut' &&
        el.kind !== 'schedule' &&
        el.kind !== 'viewpoint'
      ) {
        return false;
      }
      if (el.kind === 'viewpoint' && el.mode !== 'orbit_3d') return false;
      return !seen.has(viewRefFor(el).toLowerCase());
    })
    .sort(sortViews);
}

export function buildRecommendedSheetViewportDrafts(
  elementsById: Record<string, Element>,
  sheetId: string,
): SheetViewportMmDraft[] {
  const sheet = elementsById[sheetId];
  if (!sheet || sheet.kind !== 'sheet') return [];
  const existing = (sheet.viewportsMm ?? []).map((vp, index) =>
    normalizePersistedViewport(vp as Record<string, unknown>, index),
  );
  const views = recommendedViewsForSheet(elementsById, sheetId);
  if (views.length === 0) return existing;

  const { widthMm, heightMm } = normalizeSheetPaperMm(sheet.paperWidthMm, sheet.paperHeightMm);
  const margin = Math.max(1600, Math.min(widthMm, heightMm) * 0.05);
  const gutter = Math.max(900, Math.min(widthMm, heightMm) * 0.018);
  const usableW = widthMm - margin * 2;
  const usableH = heightMm - margin * 2 - 5200;
  const cols = usableW > 45_000 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(views.length / cols));
  const cellW = (usableW - gutter * (cols - 1)) / cols;
  const cellH = Math.max(2800, (usableH - gutter * (rows - 1)) / rows);

  const next = [...existing];
  views.forEach((view, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const xMm = margin + col * (cellW + gutter);
    const yMm = margin + 3000 + row * (cellH + gutter);
    const ref = viewRefFor(view);
    next.push({
      viewportId: `vp-${sheetId}-${view.id}`.replace(/[^\w-]/g, '-'),
      label: view.name,
      viewRef: ref,
      detailNumber: String(existing.length + i + 1),
      scale: view.kind === 'schedule' ? '' : '1:100',
      viewportLocked: false,
      viewportRole: 'standard',
      xMm,
      yMm,
      widthMm: Math.max(1200, cellW),
      heightMm: Math.max(1200, cellH),
      cropMinMm: null,
      cropMaxMm: null,
    });
  });

  return next;
}

export function recommendedSheetViewportsCommand(
  elementsById: Record<string, Element>,
  sheetId: string,
): {
  type: 'upsertSheetViewports';
  sheetId: string;
  viewportsMm: Record<string, unknown>[];
} | null {
  const drafts = buildRecommendedSheetViewportDrafts(elementsById, sheetId);
  if (drafts.length === 0) return null;
  return {
    type: 'upsertSheetViewports',
    sheetId,
    viewportsMm: drafts.map((d) => ({
      viewportId: d.viewportId,
      label: d.label,
      viewRef: d.viewRef,
      detailNumber: d.detailNumber || undefined,
      scale: d.scale || undefined,
      xMm: Math.round(d.xMm),
      yMm: Math.round(d.yMm),
      widthMm: Math.round(d.widthMm),
      heightMm: Math.round(d.heightMm),
    })),
  };
}

export function placeViewOnSheetCommand(
  elementsById: Record<string, Element>,
  sheetId: string,
  viewId: string,
): {
  type: 'upsertSheetViewports';
  sheetId: string;
  viewportsMm: Record<string, unknown>[];
} | null {
  const sheet = elementsById[sheetId];
  const view = elementsById[viewId];
  if (!sheet || sheet.kind !== 'sheet') return null;
  if (
    !view ||
    (view.kind !== 'plan_view' &&
      view.kind !== 'section_cut' &&
      view.kind !== 'schedule' &&
      view.kind !== 'viewpoint')
  ) {
    return null;
  }
  if (view.kind === 'viewpoint' && view.mode !== 'orbit_3d') return null;

  const ref = viewRefFor(view);
  if (existingRefs(sheet).has(ref.toLowerCase())) {
    return null;
  }

  const existing = (sheet.viewportsMm ?? []).map((vp, index) =>
    normalizePersistedViewport(vp as Record<string, unknown>, index),
  );
  const { widthMm, heightMm } = normalizeSheetPaperMm(sheet.paperWidthMm, sheet.paperHeightMm);
  const margin = Math.max(1600, Math.min(widthMm, heightMm) * 0.05);
  const width = Math.max(12_000, (widthMm - margin * 2) * 0.45);
  const height = view.kind === 'schedule' ? 3600 : Math.max(8000, (heightMm - margin * 2) * 0.25);
  const index = existing.length;
  const col = index % 2;
  const row = Math.floor(index / 2);
  const xMm = margin + col * (width + margin);
  const yMm = margin + 3000 + row * (height + margin * 0.6);
  const next = [
    ...existing,
    {
      viewportId: `vp-${sheetId}-${view.id}`.replace(/[^\w-]/g, '-'),
      label: view.name,
      viewRef: ref,
      detailNumber: String(index + 1),
      scale: view.kind === 'schedule' ? '' : '1:100',
      viewportLocked: false,
      viewportRole: 'standard' as const,
      xMm,
      yMm,
      widthMm: width,
      heightMm: height,
      cropMinMm: null,
      cropMaxMm: null,
    },
  ];
  return {
    type: 'upsertSheetViewports',
    sheetId,
    viewportsMm: next.map((d) => ({
      viewportId: d.viewportId,
      label: d.label,
      viewRef: d.viewRef,
      detailNumber: d.detailNumber || undefined,
      scale: d.scale || undefined,
      xMm: Math.round(d.xMm),
      yMm: Math.round(d.yMm),
      widthMm: Math.round(d.widthMm),
      heightMm: Math.round(d.heightMm),
    })),
  };
}

export function firstSheetId(elementsById: Record<string, Element>): string | null {
  const sheet = Object.values(elementsById)
    .filter((el): el is SheetEl => el.kind === 'sheet')
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  return sheet?.id ?? null;
}
