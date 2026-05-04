import type { Element } from '@bim-ai/core';

import type { PlanAnnotationHintsResolved, PlanGraphicHintsResolved } from './planProjectionWire';
import type { PlanPresentationPreset } from './symbology';

export type PlanSemanticKind =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'room'
  | 'door'
  | 'window'
  | 'stair'
  | 'grid_line'
  | 'room_separation'
  | 'dimension';

/** Map schedule / authoring labels to semantic drawing kinds consumed by symbology. */

export function canonHiddenCategory(cat: string): PlanSemanticKind | undefined {
  const raw = cat.trim().toLowerCase();

  const table: Record<string, PlanSemanticKind> = {
    walls: 'wall',
    wall: 'wall',
    floors: 'floor',
    slabs: 'floor',
    slab: 'floor',
    floor: 'floor',
    roofs: 'roof',
    roof: 'roof',
    rooms: 'room',
    room: 'room',
    doors: 'door',
    door: 'door',
    windows: 'window',
    window: 'window',
    stairs: 'stair',
    stair: 'stair',
    grids: 'grid_line',
    grid: 'grid_line',
    gridlines: 'grid_line',
    grid_line: 'grid_line',
    'grid-lines': 'grid_line',
    'room separation': 'room_separation',
    'room separation line': 'room_separation',
    'room separators': 'room_separation',
    'room separators line': 'room_separation',
    room_separation: 'room_separation',
    room_separator: 'room_separation',
    'room separating': 'room_separation',
    'room-separation': 'room_separation',
    'room-separations': 'room_separation',
    dimensions: 'dimension',
    dimension: 'dimension',
  };

  return table[raw] ?? undefined;
}

export type PlanViewResolvedDisplay = {
  /** Active authoring level derived from pinned plan_view (or fallback). */
  activeLevelId?: string;
  presentation: PlanPresentationPreset;
  hiddenSemanticKinds: ReadonlySet<PlanSemanticKind>;
  planViewElementId?: string;
};

function mergeHiddenFromLabels(labels: Iterable<string>, into: Set<PlanSemanticKind>) {
  for (const lab of labels) {
    const k = canonHiddenCategory(lab);
    if (k) into.add(k);
  }
}

/**
 * Computes level, presentation preset, and per-category hides for PlanCanvas symbology.
 * When a plan_view is active, presentation and pinned level come from that element first.
 */

export function resolvePlanViewDisplay(
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  fallbackLevelId: string | undefined,
  globalPresentation: PlanPresentationPreset,
): PlanViewResolvedDisplay {
  const hidden = new Set<PlanSemanticKind>();

  if (!activePlanViewId) {
    return {
      activeLevelId: fallbackLevelId,
      presentation: globalPresentation,
      hiddenSemanticKinds: hidden,
    };
  }

  const el = elementsById[activePlanViewId];

  if (!el || el.kind !== 'plan_view') {
    return {
      activeLevelId: fallbackLevelId,
      presentation: globalPresentation,
      hiddenSemanticKinds: hidden,
    };
  }

  mergeHiddenFromLabels(el.categoriesHidden ?? [], hidden);

  const tmplId = el.viewTemplateId;
  if (tmplId) {
    const tmpl = elementsById[tmplId];
    if (tmpl && tmpl.kind === 'view_template') {
      mergeHiddenFromLabels(tmpl.hiddenCategories ?? [], hidden);
    }
  }

  const presRaw = el.planPresentation ?? 'default';
  const presentation: PlanPresentationPreset =
    presRaw === 'opening_focus' || presRaw === 'room_scheme' ? presRaw : 'default';

  return {
    activeLevelId: el.levelId,
    presentation,
    hiddenSemanticKinds: hidden,
    planViewElementId: el.id,
  };
}

const PLAN_DETAIL_LINE_WEIGHT_FACTOR: Record<string, number> = {
  coarse: 0.88,
  medium: 1.0,
  fine: 1.14,
};

function presentationLineWeightBase(presentation: PlanPresentationPreset): number {
  if (presentation === 'opening_focus') return 1.18;
  if (presentation === 'room_scheme') return 0.92;
  return 1.0;
}

/** Client fallback when wire omits hints — mirrors server `_plan_graphic_hints_for_pinned_view`. */

export function resolvePlanGraphicHints(
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
): PlanGraphicHintsResolved | null {
  if (!activePlanViewId) return null;
  const el = elementsById[activePlanViewId];
  if (!el || el.kind !== 'plan_view') return null;

  let tmpl: Extract<Element, { kind: 'view_template' }> | undefined;
  const tmplId = el.viewTemplateId;
  if (tmplId) {
    const t = elementsById[tmplId];
    if (t?.kind === 'view_template') tmpl = t;
  }

  let detail: string;
  if (el.planDetailLevel) {
    detail = el.planDetailLevel;
  } else if (tmpl?.planDetailLevel) {
    detail = tmpl.planDetailLevel;
  } else {
    detail = 'medium';
  }
  if (PLAN_DETAIL_LINE_WEIGHT_FACTOR[detail] === undefined) detail = 'medium';

  let fill: number;
  if (el.planRoomFillOpacityScale != null && Number.isFinite(el.planRoomFillOpacityScale)) {
    fill = Math.max(0, Math.min(1, el.planRoomFillOpacityScale));
  } else if (
    tmpl?.planRoomFillOpacityScale != null &&
    Number.isFinite(tmpl.planRoomFillOpacityScale)
  ) {
    fill = Math.max(0, Math.min(1, tmpl.planRoomFillOpacityScale));
  } else {
    fill = 1.0;
  }

  const presRaw = el.planPresentation ?? 'default';
  const presentation: PlanPresentationPreset =
    presRaw === 'opening_focus' || presRaw === 'room_scheme' ? presRaw : 'default';
  const lw = presentationLineWeightBase(presentation) * PLAN_DETAIL_LINE_WEIGHT_FACTOR[detail]!;

  return {
    detailLevel: detail,
    lineWeightScale: Math.round(lw * 10000) / 10000,
    roomFillOpacityScale: Math.round(fill * 10000) / 10000,
  };
}

/** Mirrors server `_plan_annotation_hints_for_pinned_view` until wire payloads arrive. */

export function resolvePlanAnnotationHints(
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
): PlanAnnotationHintsResolved {
  const off = (): PlanAnnotationHintsResolved => ({
    openingTagsVisible: false,
    roomLabelsVisible: false,
  });
  if (!activePlanViewId) return off();
  const el = elementsById[activePlanViewId];
  if (!el || el.kind !== 'plan_view') return off();

  let tmpl: Extract<Element, { kind: 'view_template' }> | undefined;
  if (el.viewTemplateId) {
    const t = elementsById[el.viewTemplateId];
    if (t?.kind === 'view_template') tmpl = t;
  }

  let openingTagsVisible: boolean;
  if (el.planShowOpeningTags !== undefined) {
    openingTagsVisible = el.planShowOpeningTags;
  } else {
    openingTagsVisible = tmpl?.planShowOpeningTags ?? false;
  }

  let roomLabelsVisible: boolean;
  if (el.planShowRoomLabels !== undefined) {
    roomLabelsVisible = el.planShowRoomLabels;
  } else {
    roomLabelsVisible = tmpl?.planShowRoomLabels ?? false;
  }

  return { openingTagsVisible, roomLabelsVisible };
}

/** Deterministic inheritance readout for Workspace Inspector (mirrors resolver math). */

export function planViewInheritanceSummaryLines(
  elementsById: Record<string, Element>,
  planViewId: string,
): string[] {
  const el = elementsById[planViewId];
  if (!el || el.kind !== 'plan_view') return [];

  const g = resolvePlanGraphicHints(elementsById, planViewId);
  const a = resolvePlanAnnotationHints(elementsById, planViewId);
  const tmplId = el.viewTemplateId;
  const tmpl =
    tmplId && elementsById[tmplId]?.kind === 'view_template'
      ? elementsById[tmplId]
      : undefined;

  const effDetail = g?.detailLevel ?? 'medium';
  const effFill = g?.roomFillOpacityScale ?? 1;
  const pvDetail =
    el.planDetailLevel === undefined || el.planDetailLevel === null ? 'inherit' : el.planDetailLevel;
  const pvFill = el.planRoomFillOpacityScale == null ? 'inherit' : String(el.planRoomFillOpacityScale);

  const vtDetail =
    tmpl == null ? '—' : tmpl.planDetailLevel == null ? 'inherit→medium' : tmpl.planDetailLevel;
  const vtFill = tmpl == null ? '—' : String(tmpl.planRoomFillOpacityScale);

  const pvOpening =
    el.planShowOpeningTags === undefined ? 'inherit' : el.planShowOpeningTags ? 'on' : 'off';
  const pvLabels =
    el.planShowRoomLabels === undefined ? 'inherit' : el.planShowRoomLabels ? 'on' : 'off';

  return [
    `Graphics: detail=${effDetail}, lineWeight×=${g?.lineWeightScale ?? 1}, roomFill=${effFill}`,
    `Stored plan_view: detail=${pvDetail}, roomFill=${pvFill}`,
    `Template: detail=${vtDetail}, roomFill=${vtFill}`,
    `Opening tags: effective=${a.openingTagsVisible ? 'on' : 'off'}; plan_view=${pvOpening}; template=${tmpl ? (tmpl.planShowOpeningTags ? 'on' : 'off') : '—'}`,
    `Room labels: effective=${a.roomLabelsVisible ? 'on' : 'off'}; plan_view=${pvLabels}; template=${tmpl ? (tmpl.planShowRoomLabels ? 'on' : 'off') : '—'}`,
  ];
}
