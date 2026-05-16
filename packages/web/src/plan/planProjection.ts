import type {
  Element,
  PlanCategoryGraphicCategoryKey,
  PlanCategoryGraphicRow,
  PlanLinePatternToken,
  PlanTagTarget,
} from '@bim-ai/core';
import type { ViewFilter } from '../state/storeTypes';

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
  | 'dimension'
  | 'placed_tag'
  | 'ceiling'
  | 'railing'
  | 'column'
  | 'beam'
  | 'section_cut'
  | 'elevation_view'
  | 'area_boundary'
  | 'reference_plane'
  | 'property_line'
  | 'masking_region'
  | 'detail_line'
  | 'text_note'
  | 'placed_asset'
  | 'family_instance'
  | 'detail_component'
  | 'family_symbolic_line'
  | 'family_opening_projection'
  | 'family_hidden_cut';

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
    tags: 'placed_tag',
    tag: 'placed_tag',
    placed_tags: 'placed_tag',
    placed_tag: 'placed_tag',
    ceilings: 'ceiling',
    ceiling: 'ceiling',
    railings: 'railing',
    railing: 'railing',
    columns: 'column',
    column: 'column',
    beams: 'beam',
    beam: 'beam',
    sections: 'section_cut',
    section_cut: 'section_cut',
    'section marks': 'section_cut',
    section_mark: 'section_cut',
    elevations: 'elevation_view',
    elevation_view: 'elevation_view',
    elevation_mark: 'elevation_view',
    'elevation marks': 'elevation_view',
    'area boundaries': 'area_boundary',
    'area boundary': 'area_boundary',
    area_boundary: 'area_boundary',
    'reference planes': 'reference_plane',
    'reference plane': 'reference_plane',
    reference_plane: 'reference_plane',
    'property lines': 'property_line',
    'property line': 'property_line',
    property_line: 'property_line',
    'masking regions': 'masking_region',
    'masking region': 'masking_region',
    masking_region: 'masking_region',
    'detail lines': 'detail_line',
    'detail line': 'detail_line',
    detail_line: 'detail_line',
    'text notes': 'text_note',
    'text note': 'text_note',
    text_note: 'text_note',
    'placed assets': 'placed_asset',
    'placed asset': 'placed_asset',
    placed_asset: 'placed_asset',
    generic_model: 'placed_asset',
    family_instance: 'family_instance',
    'loaded families': 'family_instance',
    'loaded family': 'family_instance',
    detail_component: 'detail_component',
    'detail components': 'detail_component',
    'detail component': 'detail_component',
    family_symbolic_line: 'family_symbolic_line',
    'family symbolic lines': 'family_symbolic_line',
    'symbolic lines': 'family_symbolic_line',
    family_opening_projection: 'family_opening_projection',
    'opening projection': 'family_opening_projection',
    'opening (projection)': 'family_opening_projection',
    family_hidden_cut: 'family_hidden_cut',
    'hidden lines cut': 'family_hidden_cut',
    'hidden lines (cut)': 'family_hidden_cut',
    furniture: 'placed_asset',
    furnishings: 'placed_asset',
    'generic models': 'placed_asset',
  };

  return table[raw] ?? undefined;
}

export type PlanViewResolvedDisplay = {
  /** Active authoring level derived from pinned plan_view (or fallback). */
  activeLevelId?: string;
  presentation: PlanPresentationPreset;
  hiddenSemanticKinds: ReadonlySet<PlanSemanticKind>;
  planViewElementId?: string;
  /** F-102: element IDs individually hidden in this plan view. */
  hiddenElementIds: ReadonlySet<string>;
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
  const hiddenElementIds = new Set<string>();

  if (!activePlanViewId) {
    return {
      activeLevelId: fallbackLevelId,
      presentation: globalPresentation,
      hiddenSemanticKinds: hidden,
      hiddenElementIds,
    };
  }

  const el = elementsById[activePlanViewId];

  if (!el || el.kind !== 'plan_view') {
    return {
      activeLevelId: fallbackLevelId,
      presentation: globalPresentation,
      hiddenSemanticKinds: hidden,
      hiddenElementIds,
    };
  }

  mergeHiddenFromLabels(el.categoriesHidden ?? [], hidden);

  // F-102: populate per-element hidden IDs.
  for (const eid of el.hiddenElementIds ?? []) {
    hiddenElementIds.add(eid);
  }

  const tmplId = el.viewTemplateId;
  if (tmplId) {
    const tmpl = elementsById[tmplId];
    if (tmpl && tmpl.kind === 'view_template') {
      mergeHiddenFromLabels(tmpl.hiddenCategories ?? [], hidden);
    }
  }

  // Merge per-category visibility overrides set via the VV dialog (categoryOverrides.visible=false).
  const overrides = (el.categoryOverrides ?? {}) as Record<
    string,
    { visible?: boolean } | undefined
  >;
  for (const [catKey, ovr] of Object.entries(overrides)) {
    if (ovr?.visible === false) {
      const k = canonHiddenCategory(catKey);
      if (k) hidden.add(k);
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
    hiddenElementIds,
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

export const PLAN_CATEGORY_GRAPHIC_KEYS: readonly PlanCategoryGraphicCategoryKey[] = [
  'wall',
  'floor',
  'roof',
  'room',
  'door',
  'window',
  'stair',
  'grid_line',
  'room_separation',
  'dimension',
];

export type ResolvedPlanCategoryGraphic = {
  lineWeightFactor: number;
  linePatternToken: PlanLinePatternToken;
  lineWeightSource: 'default' | 'template' | 'plan_view';
  linePatternSource: 'default' | 'template' | 'plan_view';
  lineWeightIsDefaulted: boolean;
  linePatternIsDefaulted: boolean;
  visible: boolean;
  lineColor: string | null;
  projectionTransparency: number;
  cutTransparency: number;
  projectionOpacity: number;
  cutOpacity: number;
};

function categoryGraphicsRowMap(rows: PlanCategoryGraphicRow[] | undefined) {
  return new Map((rows ?? []).map((r) => [r.categoryKey, r]));
}

function clampCategoryTransparency(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function transparencyToOpacity(transparency: number): number {
  return Math.round((1 - transparency / 100) * 10000) / 10000;
}

/** Client merge mirror of server `resolve_plan_category_graphics_for_pinned_view`. */

export function resolvePlanCategoryGraphics(
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
): Record<PlanCategoryGraphicCategoryKey, ResolvedPlanCategoryGraphic> | null {
  if (!activePlanViewId) return null;
  const el = elementsById[activePlanViewId];
  if (!el || el.kind !== 'plan_view') return null;

  let tmpl: Extract<Element, { kind: 'view_template' }> | undefined;
  if (el.viewTemplateId) {
    const t = elementsById[el.viewTemplateId];
    if (t?.kind === 'view_template') tmpl = t;
  }
  const tmplMap = categoryGraphicsRowMap(tmpl?.planCategoryGraphics);
  const pvMap = categoryGraphicsRowMap(el.planCategoryGraphics);
  const out = {} as Record<PlanCategoryGraphicCategoryKey, ResolvedPlanCategoryGraphic>;
  for (const key of PLAN_CATEGORY_GRAPHIC_KEYS) {
    let f = 1;
    let pat: PlanLinePatternToken = key === 'room_separation' ? 'dash_short' : 'solid';
    let wSrc: 'default' | 'template' | 'plan_view' = 'default';
    let pSrc: 'default' | 'template' | 'plan_view' = 'default';
    let wDef = true;
    let pDef = true;
    const tr = tmplMap.get(key);
    if (tr) {
      if (tr.lineWeightFactor != null && Number.isFinite(tr.lineWeightFactor)) {
        f = tr.lineWeightFactor;
        wSrc = 'template';
        wDef = false;
      }
      if (tr.linePatternToken) {
        pat = tr.linePatternToken;
        pSrc = 'template';
        pDef = false;
      }
    }
    const pr = pvMap.get(key);
    if (pr) {
      if (pr.lineWeightFactor != null && Number.isFinite(pr.lineWeightFactor)) {
        f = pr.lineWeightFactor;
        wSrc = 'plan_view';
        wDef = false;
      }
      if (pr.linePatternToken) {
        pat = pr.linePatternToken;
        pSrc = 'plan_view';
        pDef = false;
      }
    }
    out[key] = {
      lineWeightFactor: Math.round(f * 10000) / 10000,
      linePatternToken: pat,
      lineWeightSource: wSrc,
      linePatternSource: pSrc,
      lineWeightIsDefaulted: wDef,
      linePatternIsDefaulted: pDef,
      visible: true,
      lineColor: null,
      projectionTransparency: 0,
      cutTransparency: 0,
      projectionOpacity: 1,
      cutOpacity: 1,
    };
  }
  // Apply per-view category overrides (VV dialog).
  const pvEl = elementsById[activePlanViewId];
  if (pvEl?.kind === 'plan_view') {
    const overrides = (pvEl.categoryOverrides ?? {}) as Record<
      string,
      {
        visible?: boolean;
        projection?: {
          lineWeightFactor?: number;
          lineColor?: string | null;
          transparency?: number;
        };
        cut?: {
          transparency?: number;
        };
      }
    >;
    for (const [catKey, ovr] of Object.entries(overrides)) {
      const k = catKey as PlanCategoryGraphicCategoryKey;
      if (!out[k]) continue;
      if (ovr.visible === false) {
        out[k].visible = false;
      }
      if (ovr.projection?.lineWeightFactor != null) {
        out[k].lineWeightFactor = ovr.projection.lineWeightFactor;
      }
      if (ovr.projection?.lineColor != null) {
        out[k].lineColor = ovr.projection.lineColor;
      }
      const projectionTransparency = clampCategoryTransparency(ovr.projection?.transparency);
      if (projectionTransparency != null) {
        out[k].projectionTransparency = projectionTransparency;
        out[k].projectionOpacity = transparencyToOpacity(projectionTransparency);
      }
      const cutTransparency = clampCategoryTransparency(ovr.cut?.transparency);
      if (cutTransparency != null) {
        out[k].cutTransparency = cutTransparency;
        out[k].cutOpacity = transparencyToOpacity(cutTransparency);
      }
    }
  }
  return out;
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

export const BUILTIN_PLAN_TAG_OPENING_ID = 'builtin-plan-tag-opening';
export const BUILTIN_PLAN_TAG_ROOM_ID = 'builtin-plan-tag-room';

export type PlanTagStyleLane = PlanTagTarget;

export type ResolvedPlanTagStyleLane = {
  resolvedStyleId: string;
  resolvedStyleName: string;
  source: 'plan_view' | 'view_template' | 'builtin';
  textSizePt: number;
};

function builtinPlanTagLane(lane: PlanTagStyleLane): ResolvedPlanTagStyleLane {
  return {
    resolvedStyleId: lane === 'opening' ? BUILTIN_PLAN_TAG_OPENING_ID : BUILTIN_PLAN_TAG_ROOM_ID,
    resolvedStyleName: 'Builtin',
    source: 'builtin',
    textSizePt: 10,
  };
}

function resolvedPlanTagFromRef(
  elementsById: Record<string, Element>,
  ref: string | null | undefined,
  lane: PlanTagStyleLane,
  source: ResolvedPlanTagStyleLane['source'],
): ResolvedPlanTagStyleLane {
  if (!ref) return builtinPlanTagLane(lane);
  const style = elementsById[ref];
  if (style?.kind !== 'plan_tag_style' || style.tagTarget !== lane) {
    return builtinPlanTagLane(lane);
  }
  return {
    resolvedStyleId: style.id,
    resolvedStyleName: style.name,
    source,
    textSizePt: style.textSizePt,
  };
}

/** Mirrors server `plan_view` → `view_template` → builtin precedence (WP-C02). */

export function resolvePlanTagStyleLane(
  elementsById: Record<string, Element>,
  planViewId: string | undefined,
  lane: PlanTagStyleLane,
): ResolvedPlanTagStyleLane {
  if (!planViewId) return builtinPlanTagLane(lane);
  const pv = elementsById[planViewId];
  if (!pv || pv.kind !== 'plan_view') return builtinPlanTagLane(lane);

  const pvRef = lane === 'opening' ? pv.planOpeningTagStyleId : pv.planRoomTagStyleId;
  if (pvRef) return resolvedPlanTagFromRef(elementsById, pvRef, lane, 'plan_view');

  let tmpl: Extract<Element, { kind: 'view_template' }> | undefined;
  if (pv.viewTemplateId) {
    const t = elementsById[pv.viewTemplateId];
    if (t?.kind === 'view_template') tmpl = t;
  }
  const tRef =
    lane === 'opening' ? tmpl?.defaultPlanOpeningTagStyleId : tmpl?.defaultPlanRoomTagStyleId;
  if (tRef) return resolvedPlanTagFromRef(elementsById, tRef, lane, 'view_template');

  return builtinPlanTagLane(lane);
}

export function formatPlanTagStyleMatrixCell(r: ResolvedPlanTagStyleLane): string {
  return `${r.resolvedStyleId} · ${r.resolvedStyleName} · ${r.source}`;
}

export function planTemplateDefaultTagStyleCell(
  elementsById: Record<string, Element>,
  tmpl: Extract<Element, { kind: 'view_template' }> | undefined,
  lane: PlanTagStyleLane,
): string {
  if (!tmpl) return '—';
  const tRef =
    lane === 'opening' ? tmpl.defaultPlanOpeningTagStyleId : tmpl.defaultPlanRoomTagStyleId;
  return formatPlanTagStyleMatrixCell(
    resolvedPlanTagFromRef(elementsById, tRef, lane, 'view_template'),
  );
}

export type PlanGraphicsMatrixRow = {
  label: string;
  template: string;
  stored: string;
  effective: string;
  /** Which tier provided the effective value: plan_view, view_template, or system default. */
  effectiveSource?: 'plan_view' | 'view_template' | 'default';
};

/** All category keys in stable display order (mirrors PLAN_CATEGORY_GRAPHIC_KEYS). */
export const PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS: readonly PlanCategoryGraphicCategoryKey[] = [
  'wall',
  'floor',
  'roof',
  'room',
  'door',
  'window',
  'stair',
  'grid_line',
  'room_separation',
  'dimension',
] as const;

/** Per-category source summary for the project browser / advisor. */
export type PlanCategoryGraphicSourceRow = {
  categoryKey: PlanCategoryGraphicCategoryKey;
  lineWeightSource: 'plan_view' | 'view_template' | 'default';
  linePatternSource: 'plan_view' | 'view_template' | 'default';
  effectiveSource: 'plan_view' | 'view_template' | 'default';
  lineWeightFactor: number;
  linePatternToken: string;
};

/** Compact tag/annotation source summary for the project browser. */
export type PlanViewBrowserHierarchyState = {
  viewTemplateId: string | undefined;
  viewTemplateName: string | undefined;
  openingTagSource: 'plan_view' | 'view_template' | 'builtin';
  roomTagSource: 'plan_view' | 'view_template' | 'builtin';
  categoryDefaultCount: number;
  categoryTemplateCount: number;
  categoryPlanViewCount: number;
};

function formatPlanPresentationStored(pres: PlanPresentationPreset): string {
  if (pres === 'opening_focus') return 'opening_focus';
  if (pres === 'room_scheme') return 'room_scheme';
  return 'default';
}

function annotationTriStored(v: boolean | undefined): string {
  if (v === undefined) return 'inherit';
  return v ? 'on' : 'off';
}

function annotationTriEffective(v: boolean): string {
  return v ? 'on' : 'off';
}

function formatCategoryGraphicsMatrixCell(
  rows: PlanCategoryGraphicRow[] | undefined,
  key: PlanCategoryGraphicCategoryKey,
): string {
  const r = rows?.find((x) => x.categoryKey === key);
  if (!r) return 'inherit';
  const parts: string[] = [];
  if (r.lineWeightFactor != null && Number.isFinite(r.lineWeightFactor)) {
    parts.push(`f=${r.lineWeightFactor}`);
  }
  if (r.linePatternToken) {
    parts.push(`pat=${r.linePatternToken}`);
  }
  return parts.length ? parts.join(' ') : 'inherit';
}

function formatCategoryGraphicsEffectiveCell(r: ResolvedPlanCategoryGraphic): string {
  const parts = [`f=${r.lineWeightFactor}`, `pat=${r.linePatternToken}`];
  if (r.projectionTransparency > 0) parts.push(`projTrans=${r.projectionTransparency}%`);
  if (r.cutTransparency > 0) parts.push(`cutTrans=${r.cutTransparency}%`);
  return parts.join(' ');
}

/**
 * Compact Effective · detail/fill/tags line for Project Browser (plan_view rows).
 */

export function planViewProjectBrowserEvidenceLine(
  elementsById: Record<string, Element>,
  planViewId: string,
): string {
  const g = resolvePlanGraphicHints(elementsById, planViewId);
  const a = resolvePlanAnnotationHints(elementsById, planViewId);
  const pres = resolvePlanViewDisplay(elementsById, planViewId, undefined, 'default').presentation;

  const d = g?.detailLevel ?? 'medium';
  const fill = g?.roomFillOpacityScale ?? 1;
  const oSt = resolvePlanTagStyleLane(elementsById, planViewId, 'opening');
  const rSt = resolvePlanTagStyleLane(elementsById, planViewId, 'room');
  const oAbbrev =
    oSt.resolvedStyleId === BUILTIN_PLAN_TAG_OPENING_ID ? 'builtin' : oSt.resolvedStyleId;
  const rAbbrev =
    rSt.resolvedStyleId === BUILTIN_PLAN_TAG_ROOM_ID ? 'builtin' : rSt.resolvedStyleId;
  const cat = resolvePlanCategoryGraphics(elementsById, planViewId);
  const catBit =
    cat == null
      ? ''
      : ` · catWall f=${cat.wall.lineWeightFactor} pat=${cat.wall.linePatternToken} · catGrid pat=${cat.grid_line.linePatternToken}`;
  return `pres ${formatPlanPresentationStored(pres)} · ${d} · fill ${fill} · tags ${annotationTriEffective(a.openingTagsVisible)}/${annotationTriEffective(a.roomLabelsVisible)} · tagStyles o=${oAbbrev} r=${rAbbrev}${catBit}`;
}

/**
 * Per-category source readout for all 10 categories (plan_view / view_template / default).
 * Used for project browser evidence and advisor display (WP-C01/C02/C03).
 */
export function planViewCategoryGraphicsSourceReadout(
  elementsById: Record<string, Element>,
  planViewId: string,
): PlanCategoryGraphicSourceRow[] {
  const cat = resolvePlanCategoryGraphics(elementsById, planViewId);
  if (cat == null) return [];

  return PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS.map((key) => {
    const r = cat[key];
    const wSrc =
      r.lineWeightSource === 'plan_view'
        ? 'plan_view'
        : r.lineWeightSource === 'template'
          ? 'view_template'
          : 'default';
    const pSrc =
      r.linePatternSource === 'plan_view'
        ? 'plan_view'
        : r.linePatternSource === 'template'
          ? 'view_template'
          : 'default';
    const effSrc =
      wSrc === 'plan_view' || pSrc === 'plan_view'
        ? 'plan_view'
        : wSrc === 'view_template' || pSrc === 'view_template'
          ? 'view_template'
          : 'default';
    return {
      categoryKey: key,
      lineWeightSource: wSrc,
      linePatternSource: pSrc,
      effectiveSource: effSrc,
      lineWeightFactor: r.lineWeightFactor,
      linePatternToken: r.linePatternToken,
    };
  });
}

/**
 * Compact browser hierarchy state summarising template link and tag/category source counts.
 * Feeds the project browser template-bucket summary for v1 review (WP-C05).
 */
export function planViewBrowserHierarchyState(
  elementsById: Record<string, Element>,
  planViewId: string,
): PlanViewBrowserHierarchyState {
  const el = elementsById[planViewId];
  const pv = el?.kind === 'plan_view' ? el : undefined;

  const tmplId = pv?.viewTemplateId;
  const tmplEl = tmplId ? elementsById[tmplId] : undefined;
  const tmpl = tmplEl?.kind === 'view_template' ? tmplEl : undefined;

  const oSt = resolvePlanTagStyleLane(elementsById, planViewId, 'opening');
  const rSt = resolvePlanTagStyleLane(elementsById, planViewId, 'room');

  const catRows = planViewCategoryGraphicsSourceReadout(elementsById, planViewId);
  const catDefaultCount = catRows.filter((r) => r.effectiveSource === 'default').length;
  const catTemplateCount = catRows.filter((r) => r.effectiveSource === 'view_template').length;
  const catPlanViewCount = catRows.filter((r) => r.effectiveSource === 'plan_view').length;

  return {
    viewTemplateId: tmpl?.id,
    viewTemplateName: tmpl?.name,
    openingTagSource: oSt.source,
    roomTagSource: rSt.source,
    categoryDefaultCount: catDefaultCount,
    categoryTemplateCount: catTemplateCount,
    categoryPlanViewCount: catPlanViewCount,
  };
}

/** Template | stored plan_view | effective matrix for Inspector production review. */

export function planViewGraphicsMatrixRows(
  elementsById: Record<string, Element>,
  planViewId: string,
): PlanGraphicsMatrixRow[] {
  const el = elementsById[planViewId];
  if (!el || el.kind !== 'plan_view') return [];

  const tmplId = el.viewTemplateId;
  const tmpl =
    tmplId && elementsById[tmplId]?.kind === 'view_template'
      ? (elementsById[tmplId] as Extract<Element, { kind: 'view_template' }>)
      : undefined;

  const display = resolvePlanViewDisplay(elementsById, planViewId, undefined, 'default');
  const g = resolvePlanGraphicHints(elementsById, planViewId);
  const a = resolvePlanAnnotationHints(elementsById, planViewId);

  const presEff = formatPlanPresentationStored(display.presentation);

  const vtDetail =
    tmpl == null ? '—' : tmpl.planDetailLevel == null ? 'inherit→medium' : tmpl.planDetailLevel;
  const pvDetail =
    el.planDetailLevel === undefined || el.planDetailLevel === null
      ? 'inherit'
      : el.planDetailLevel;
  const effDetail = g?.detailLevel ?? 'medium';

  const vtFill = tmpl == null ? '—' : String(tmpl.planRoomFillOpacityScale ?? 1);
  const pvFill =
    el.planRoomFillOpacityScale == null ? 'inherit' : String(el.planRoomFillOpacityScale);
  const effFill = String(g?.roomFillOpacityScale ?? 1);

  const vtOpening = tmpl == null ? '—' : annotationTriEffective(tmpl.planShowOpeningTags ?? false);
  const pvOpening = annotationTriStored(el.planShowOpeningTags);
  const effOpening = annotationTriEffective(a.openingTagsVisible);

  const vtLabels = tmpl == null ? '—' : annotationTriEffective(tmpl.planShowRoomLabels ?? false);
  const pvLabels = annotationTriStored(el.planShowRoomLabels);
  const effLabels = annotationTriEffective(a.roomLabelsVisible);

  const tmplOpenStyle = planTemplateDefaultTagStyleCell(elementsById, tmpl, 'opening');
  const tmplRoomStyle = planTemplateDefaultTagStyleCell(elementsById, tmpl, 'room');

  const pvOpenRef = el.planOpeningTagStyleId;
  const openStored = pvOpenRef
    ? formatPlanTagStyleMatrixCell(
        resolvedPlanTagFromRef(elementsById, pvOpenRef, 'opening', 'plan_view'),
      )
    : 'inherit';
  const openEff = formatPlanTagStyleMatrixCell(
    resolvePlanTagStyleLane(elementsById, planViewId, 'opening'),
  );

  const pvRoomRef = el.planRoomTagStyleId;
  const roomStored = pvRoomRef
    ? formatPlanTagStyleMatrixCell(
        resolvedPlanTagFromRef(elementsById, pvRoomRef, 'room', 'plan_view'),
      )
    : 'inherit';
  const roomEff = formatPlanTagStyleMatrixCell(
    resolvePlanTagStyleLane(elementsById, planViewId, 'room'),
  );

  const tmplHiddenRaw = tmpl?.hiddenCategories?.length ?? 0;
  const pvHiddenRaw = el.categoriesHidden?.length ?? 0;
  const effHiddenKinds = String(display.hiddenSemanticKinds.size);

  const catEff = resolvePlanCategoryGraphics(elementsById, planViewId);

  return [
    {
      label: 'Presentation',
      template: '—',
      stored: presEff,
      effective: presEff,
    },
    {
      label: 'Detail level',
      template: vtDetail,
      stored: pvDetail,
      effective: effDetail,
    },
    {
      label: 'Room fill',
      template: vtFill,
      stored: pvFill,
      effective: effFill,
    },
    {
      label: 'Line weight ×',
      template: '—',
      stored: '—',
      effective: String(g?.lineWeightScale ?? 1),
    },
    ...PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS.map((key) => {
      const defaultPat = key === 'room_separation' ? 'dash_short' : 'solid';
      const resolved = catEff?.[key];
      const effStr = resolved
        ? formatCategoryGraphicsEffectiveCell(resolved)
        : `f=1 pat=${defaultPat}`;
      const src = resolved
        ? (() => {
            if (
              resolved.lineWeightSource === 'plan_view' ||
              resolved.linePatternSource === 'plan_view'
            )
              return 'plan_view' as const;
            if (
              resolved.lineWeightSource === 'template' ||
              resolved.linePatternSource === 'template'
            )
              return 'view_template' as const;
            return 'default' as const;
          })()
        : ('default' as const);
      return {
        label: `Cat ${key}`,
        template:
          tmpl == null ? '—' : formatCategoryGraphicsMatrixCell(tmpl.planCategoryGraphics, key),
        stored: formatCategoryGraphicsMatrixCell(el.planCategoryGraphics, key),
        effective: effStr,
        effectiveSource: src,
      };
    }),
    {
      label: 'Opening tags',
      template: vtOpening,
      stored: pvOpening,
      effective: effOpening,
    },
    {
      label: 'Room labels',
      template: vtLabels,
      stored: pvLabels,
      effective: effLabels,
    },
    {
      label: 'Opening tag style',
      template: tmplOpenStyle,
      stored: openStored,
      effective: openEff,
    },
    {
      label: 'Room tag style',
      template: tmplRoomStyle,
      stored: roomStored,
      effective: roomEff,
    },
    {
      label: 'Hidden categories',
      template: tmpl == null ? '—' : String(tmplHiddenRaw),
      stored: String(pvHiddenRaw),
      effective: `${effHiddenKinds} kinds`,
    },
  ];
}

function viewTemplateDetailEffective(tmpl: Extract<Element, { kind: 'view_template' }>): string {
  if (tmpl.planDetailLevel === undefined || tmpl.planDetailLevel === null) return 'medium';
  const d = tmpl.planDetailLevel;
  return PLAN_DETAIL_LINE_WEIGHT_FACTOR[d] === undefined ? 'medium' : d;
}

/**
 * Matrix rows when inspecting a view_template alone (template column "—"; stored defaults;
 * detail `effective` is the resolved level used for line-weight math).
 */

export function viewTemplateGraphicsMatrixRows(
  elementsById: Record<string, Element>,
  viewTemplateId: string,
): PlanGraphicsMatrixRow[] {
  const el = elementsById[viewTemplateId];
  if (!el || el.kind !== 'view_template') return [];

  const effDetail = viewTemplateDetailEffective(el);

  const fill = Math.max(
    0,
    Math.min(1, el.planRoomFillOpacityScale != null ? el.planRoomFillOpacityScale : 1),
  );
  const pres: PlanPresentationPreset = 'default';
  const lw = presentationLineWeightBase(pres) * PLAN_DETAIL_LINE_WEIGHT_FACTOR[effDetail]!;

  const openingEff = annotationTriEffective(el.planShowOpeningTags ?? false);
  const labelsEff = annotationTriEffective(el.planShowRoomLabels ?? false);

  const fillStr = String(Math.round(fill * 10000) / 10000);
  const detailStored =
    el.planDetailLevel === undefined || el.planDetailLevel === null
      ? 'inherit→medium'
      : el.planDetailLevel;

  const hiddenCount = el.hiddenCategories?.length ?? 0;

  const vtOpenStyle = formatPlanTagStyleMatrixCell(
    resolvedPlanTagFromRef(
      elementsById,
      el.defaultPlanOpeningTagStyleId,
      'opening',
      'view_template',
    ),
  );
  const vtRoomStyle = formatPlanTagStyleMatrixCell(
    resolvedPlanTagFromRef(elementsById, el.defaultPlanRoomTagStyleId, 'room', 'view_template'),
  );

  const dash = '—';

  return [
    {
      label: 'Presentation',
      template: dash,
      stored: dash,
      effective: dash,
    },
    {
      label: 'Detail level',
      template: dash,
      stored: detailStored,
      effective: effDetail,
    },
    {
      label: 'Room fill',
      template: dash,
      stored: fillStr,
      effective: fillStr,
    },
    {
      label: 'Line weight ×',
      template: dash,
      stored: dash,
      effective: String(Math.round(lw * 10000) / 10000),
    },
    {
      label: 'Opening tags',
      template: dash,
      stored: openingEff,
      effective: openingEff,
    },
    {
      label: 'Room labels',
      template: dash,
      stored: labelsEff,
      effective: labelsEff,
    },
    {
      label: 'Opening tag style',
      template: dash,
      stored: vtOpenStyle,
      effective: vtOpenStyle,
    },
    {
      label: 'Room tag style',
      template: dash,
      stored: vtRoomStyle,
      effective: vtRoomStyle,
    },
    {
      label: 'Hidden categories',
      template: dash,
      stored: String(hiddenCount),
      effective: `${hiddenCount} kinds`,
    },
  ];
}

/**
 * Compact clip + hidden-kind summary for Project Browser (orbit_3d viewpoints).
 */

const ORBIT_HIDDEN_KINDS_MAX_CHARS = 72;

export type OrbitViewCutawayStyleToken = 'none' | 'cap' | 'floor' | 'box';

function viewpointPersistedCutawayStyle(
  vp: Extract<Element, { kind: 'viewpoint' }>,
): OrbitViewCutawayStyleToken | undefined {
  const s = vp.cutawayStyle;
  if (s === 'none' || s === 'cap' || s === 'floor' || s === 'box') return s;
  return undefined;
}

/** Stable cut token: prefers persisted `cutawayStyle` when set; else derived from clip elevations. */
export function viewpointOrbit3dCutawayStyleToken(
  vp: Extract<Element, { kind: 'viewpoint' }>,
): OrbitViewCutawayStyleToken {
  if (vp.mode !== 'orbit_3d') return 'none';
  const persisted = viewpointPersistedCutawayStyle(vp);
  if (persisted !== undefined) return persisted;
  const hasCap = vp.viewerClipCapElevMm != null && Number.isFinite(vp.viewerClipCapElevMm);
  const hasFloor = vp.viewerClipFloorElevMm != null && Number.isFinite(vp.viewerClipFloorElevMm);
  if (hasCap && hasFloor) return 'box';
  if (hasCap) return 'cap';
  if (hasFloor) return 'floor';
  return 'none';
}

/** Human-readable cutaway / section-box style (explicit `cutawayStyle` when set, else clip-derived). */
export function viewpointOrbit3dCutawayStyleLabel(
  vp: Extract<Element, { kind: 'viewpoint' }>,
): string {
  const t = viewpointOrbit3dCutawayStyleToken(vp);
  switch (t) {
    case 'none':
      return 'No elevation clip';
    case 'cap':
      return 'Cap clip only';
    case 'floor':
      return 'Floor clip only';
    case 'box':
      return 'Box clip (cap + floor)';
    default: {
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

/** Hidden 3D semantic kinds (shown as “categories” in UX copy). */
export function viewpointOrbit3dHiddenKindsReadout(
  vp: Extract<Element, { kind: 'viewpoint' }>,
): string {
  if (vp.mode !== 'orbit_3d') return '—';
  const kinds = vp.hiddenSemanticKinds3d;
  if (kinds == null || kinds.length === 0) return '—';
  const joined = kinds.join(', ');
  if (joined.length <= ORBIT_HIDDEN_KINDS_MAX_CHARS) return `${kinds.length}: ${joined}`;
  return `${kinds.length}: ${joined.slice(0, ORBIT_HIDDEN_KINDS_MAX_CHARS - 1)}…`;
}

export function viewpointOrbit3dEvidenceLine(vp: Extract<Element, { kind: 'viewpoint' }>): string {
  if (vp.mode !== 'orbit_3d') return '';
  const cap = vp.viewerClipCapElevMm;
  const floor = vp.viewerClipFloorElevMm;
  const hid = vp.hiddenSemanticKinds3d?.length ?? 0;
  const capS = cap == null ? '∅' : String(cap);
  const floorS = floor == null ? '∅' : String(floor);
  const cut = viewpointOrbit3dCutawayStyleToken(vp);
  const sbEnabled = vp.sectionBoxEnabled;
  const sbMin = vp.sectionBoxMinMm;
  const sbMax = vp.sectionBoxMaxMm;
  let sbTok = '';
  if (sbEnabled != null) {
    if (sbEnabled && sbMin != null && sbMax != null) {
      sbTok = ` · sbox[${sbMin.xMm},${sbMin.yMm},${sbMin.zMm}→${sbMax.xMm},${sbMax.yMm},${sbMax.zMm}]`;
    } else {
      sbTok = ` · sbox:${sbEnabled ? 'on' : 'off'}`;
    }
  }
  const overlayTok = vp.planOverlayEnabled
    ? ` · overlay:${vp.planOverlaySourcePlanViewId ?? 'auto'}@${vp.planOverlayOffsetMm ?? 'auto'}`
    : '';
  return `clip cap ${capS} · floor ${floorS} · ${hid} hid · cut:${cut}${sbTok}${overlayTok}`;
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
    tmplId && elementsById[tmplId]?.kind === 'view_template' ? elementsById[tmplId] : undefined;

  const effDetail = g?.detailLevel ?? 'medium';
  const effFill = g?.roomFillOpacityScale ?? 1;
  const pvDetail =
    el.planDetailLevel === undefined || el.planDetailLevel === null
      ? 'inherit'
      : el.planDetailLevel;
  const pvFill =
    el.planRoomFillOpacityScale == null ? 'inherit' : String(el.planRoomFillOpacityScale);

  const vtDetail =
    tmpl == null ? '—' : tmpl.planDetailLevel == null ? 'inherit→medium' : tmpl.planDetailLevel;
  const vtFill = tmpl == null ? '—' : String(tmpl.planRoomFillOpacityScale);

  const pvOpening =
    el.planShowOpeningTags === undefined ? 'inherit' : el.planShowOpeningTags ? 'on' : 'off';
  const pvLabels =
    el.planShowRoomLabels === undefined ? 'inherit' : el.planShowRoomLabels ? 'on' : 'off';

  const pvOpenRef =
    el.planOpeningTagStyleId === undefined || el.planOpeningTagStyleId === null
      ? 'inherit'
      : el.planOpeningTagStyleId;
  const pvRoomRef =
    el.planRoomTagStyleId === undefined || el.planRoomTagStyleId === null
      ? 'inherit'
      : el.planRoomTagStyleId;

  const effOpen = resolvePlanTagStyleLane(elementsById, planViewId, 'opening');
  const effRoom = resolvePlanTagStyleLane(elementsById, planViewId, 'room');

  return [
    `Graphics: detail=${effDetail}, lineWeight×=${g?.lineWeightScale ?? 1}, roomFill=${effFill}`,
    `Stored plan_view: detail=${pvDetail}, roomFill=${pvFill}`,
    `Template: detail=${vtDetail}, roomFill=${vtFill}`,
    `Opening tags: effective=${a.openingTagsVisible ? 'on' : 'off'}; plan_view=${pvOpening}; template=${tmpl ? (tmpl.planShowOpeningTags ? 'on' : 'off') : '—'}`,
    `Room labels: effective=${a.roomLabelsVisible ? 'on' : 'off'}; plan_view=${pvLabels}; template=${tmpl ? (tmpl.planShowRoomLabels ? 'on' : 'off') : '—'}`,
    `Opening tag style: effective=${formatPlanTagStyleMatrixCell(effOpen)}; plan_view.stored=${pvOpenRef === 'inherit' ? 'inherit' : String(pvOpenRef)}; template.default=${tmpl?.defaultPlanOpeningTagStyleId ?? '—'}`,
    `Room tag style: effective=${formatPlanTagStyleMatrixCell(effRoom)}; plan_view.stored=${pvRoomRef === 'inherit' ? 'inherit' : String(pvRoomRef)}; template.default=${tmpl?.defaultPlanRoomTagStyleId ?? '—'}`,
  ];
}

/* ────────────────────────────────────────────────────────────────────── */
/* View filter evaluation                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export function evaluateViewFilters(
  element: Element,
  filters: ViewFilter[],
): {
  visible: boolean;
  lineColor?: string | null;
  lineWeightFactor?: number;
  fillColor?: string | null;
} {
  let visible = true;
  let lineColor: string | null | undefined;
  let lineWeightFactor: number | undefined;
  let fillColor: string | null | undefined;

  for (const filter of filters) {
    const matches = filter.rules.every((rule) => {
      const val = (element as Record<string, unknown>)[rule.field];
      const strVal = val != null ? String(val) : '';
      switch (rule.operator) {
        case 'equals':
          return strVal === rule.value;
        case 'not-equals':
          return strVal !== rule.value;
        case 'contains':
          return strVal.includes(rule.value);
        case 'not-contains':
          return !strVal.includes(rule.value);
        default:
          return false;
      }
    });
    if (matches) {
      if (filter.override.visible === false) visible = false;
      if (filter.override.projection?.lineColor !== undefined)
        lineColor = filter.override.projection.lineColor;
      if (filter.override.projection?.lineWeightFactor != null)
        lineWeightFactor = filter.override.projection.lineWeightFactor;
      if (filter.override.projection?.fillColor !== undefined)
        fillColor = filter.override.projection.fillColor;
    }
  }
  return { visible, lineColor, lineWeightFactor, fillColor };
}

export type PlanRegionOverlay = {
  id: string;
  name: string;
  levelId: string;
  outlineMm: { xMm: number; yMm: number }[];
  cutPlaneOffsetMm: number;
};

export function extractPlanRegionOverlays(
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
): PlanRegionOverlay[] {
  if (!activeLevelId) return [];
  const out: PlanRegionOverlay[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'plan_region' && el.levelId === activeLevelId) {
      out.push({
        id: el.id,
        name: el.name,
        levelId: el.levelId,
        outlineMm: el.outlineMm,
        cutPlaneOffsetMm: el.cutPlaneOffsetMm ?? -500,
      });
    }
  }
  return out;
}

export function pointInPolygonMm(
  polygon: { xMm: number; yMm: number }[],
  xMm: number,
  yMm: number,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.xMm;
    const yi = polygon[i]!.yMm;
    const xj = polygon[j]!.xMm;
    const yj = polygon[j]!.yMm;
    if (yi > yMm !== yj > yMm && xMm < ((xj - xi) * (yMm - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── D3: View Range helpers ────────────────────────────────────────────────

/** Resolved view-range values for a plan_view element. All mm values are relative to the level elevation. */
export type ResolvedViewRange = {
  viewRangeTopMm: number;
  cutPlaneOffsetMm: number;
  viewRangeBottomMm: number;
  viewDepth: number;
};

/** Default view-range constants (Revit-like defaults). */
export const VIEW_RANGE_DEFAULTS: ResolvedViewRange = {
  viewRangeTopMm: 3000,
  cutPlaneOffsetMm: 1200,
  viewRangeBottomMm: 0,
  viewDepth: 0,
};

/**
 * Read view-range fields from a plan_view element, falling back to defaults.
 * Returns the defaults if the element is not found or not a plan_view.
 */
export function resolveViewRange(
  elementsById: Record<string, Element>,
  planViewId: string | undefined,
): ResolvedViewRange {
  if (!planViewId) return { ...VIEW_RANGE_DEFAULTS };
  const el = elementsById[planViewId];
  if (!el || el.kind !== 'plan_view') return { ...VIEW_RANGE_DEFAULTS };
  return {
    viewRangeTopMm: el.viewRangeTopMm ?? VIEW_RANGE_DEFAULTS.viewRangeTopMm,
    cutPlaneOffsetMm: el.cutPlaneOffsetMm ?? VIEW_RANGE_DEFAULTS.cutPlaneOffsetMm,
    viewRangeBottomMm: el.viewRangeBottomMm ?? VIEW_RANGE_DEFAULTS.viewRangeBottomMm,
    viewDepth: el.viewDepth ?? VIEW_RANGE_DEFAULTS.viewDepth,
  };
}

/**
 * Returns true if an element's sill height (mm above level) is at or above the cut plane.
 * Elements at or above the cut plane are not sliced through and therefore do not produce
 * cut-pattern symbols in plan view.
 */
export function isAboveCutPlane(sillHeightMm: number, cutPlaneOffsetMm: number): boolean {
  return sillHeightMm >= cutPlaneOffsetMm;
}
