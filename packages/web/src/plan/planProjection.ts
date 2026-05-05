import type { Element, PlanTagTarget } from '@bim-ai/core';

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
  return `pres ${formatPlanPresentationStored(pres)} · ${d} · fill ${fill} · tags ${annotationTriEffective(a.openingTagsVisible)}/${annotationTriEffective(a.roomLabelsVisible)} · tagStyles o=${oAbbrev} r=${rAbbrev}`;
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

/** Stable token derived from which elevation clip planes are authored (no separate persisted style enum). */
export function viewpointOrbit3dCutawayStyleToken(
  vp: Extract<Element, { kind: 'viewpoint' }>,
): 'none' | 'cap' | 'floor' | 'box' {
  if (vp.mode !== 'orbit_3d') return 'none';
  const hasCap = vp.viewerClipCapElevMm != null && Number.isFinite(vp.viewerClipCapElevMm);
  const hasFloor =
    vp.viewerClipFloorElevMm != null && Number.isFinite(vp.viewerClipFloorElevMm);
  if (hasCap && hasFloor) return 'box';
  if (hasCap) return 'cap';
  if (hasFloor) return 'floor';
  return 'none';
}

/** Human-readable cutaway / section-box style for HUD (from clip fields only). */
export function viewpointOrbit3dCutawayStyleLabel(vp: Extract<Element, { kind: 'viewpoint' }>): string {
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
  return `clip cap ${capS} · floor ${floorS} · ${hid} hid · cut:${cut}`;
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
