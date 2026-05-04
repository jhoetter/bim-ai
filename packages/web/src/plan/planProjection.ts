import type { Element } from '@bim-ai/core';

import type { PlanGraphicHintsResolved } from './planProjectionWire';
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
