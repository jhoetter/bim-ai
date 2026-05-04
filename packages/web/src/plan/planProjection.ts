import type { Element } from '@bim-ai/core';

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
