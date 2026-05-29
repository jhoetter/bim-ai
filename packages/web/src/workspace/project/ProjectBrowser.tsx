import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { DisciplineTag, Element } from '@bim-ai/core';
import { DEFAULT_DISCIPLINE_BY_KIND } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { applyCommand } from '../../lib/api';
import { useViewTemplateStore } from '../../collab/viewTemplateStore';
import { PropagationToast } from './PropagationToast';
import {
  duplicateFamilyTypeCommand,
  ProjectBrowserFamiliesGroup,
  type ProjectBrowserFamilyTypeElement,
} from './ProjectBrowserFamiliesGroup';

import {
  planViewBrowserHierarchyState,
  planViewProjectBrowserEvidenceLine,
  viewpointOrbit3dEvidenceLine,
} from '../../plan/planProjection';
import { NewSheetDialog } from '../../plan/NewSheetDialog';
import {
  planLevelEvidenceToken,
  scheduleProjectBrowserEvidenceLine,
  sectionCutBrowserTooltipTitle,
  sectionCutProjectBrowserEvidenceLine,
  sheetProjectBrowserEvidenceLine,
  siteProjectBrowserEvidenceLine,
} from '../evidence';
import { useBimStore } from '../../state/store';

const AREA_SCHEMES = [
  { value: 'gross_building', label: 'Gross Building' },
  { value: 'net', label: 'Net' },
  { value: 'rentable', label: 'Rentable' },
] as const;

type AreaSchemeValue = (typeof AREA_SCHEMES)[number]['value'];
type PlanViewSubtypeValue = NonNullable<Extract<Element, { kind: 'plan_view' }>['planViewSubtype']>;

/**
 * TH-UI-004 — Source-evidence state badge for reverse-BIM source-derived views.
 *
 * Renders a compact pill on section / exterior / detail rows so agents and humans
 * can see at a glance whether the row has a source link, a captured screenshot,
 * an overlay comparison, open findings, or has been accepted.
 *
 * For this overnight tracker pass the state is a heuristic stub: it inspects the
 * element name and any markerGroupId/parentViewId hints. A first-class
 * `source_view_evidence` element kind is the structured backing (see tracker
 * finding TH-X-F006). Once that lands, this component will read from the joined
 * evidence record instead of guessing.
 */
type SourceEvidenceState =
  | 'missing_source_link'
  | 'source_linked'
  | 'screenshot_captured'
  | 'overlay_compared'
  | 'findings_open'
  | 'accepted';

const SOURCE_EVIDENCE_STATE_LABEL: Record<SourceEvidenceState, string> = {
  missing_source_link: 'no src',
  source_linked: 'src linked',
  screenshot_captured: 'shot',
  overlay_compared: 'overlay',
  findings_open: 'findings',
  accepted: 'accepted',
};

const SOURCE_EVIDENCE_STATE_TITLE: Record<SourceEvidenceState, string> = {
  missing_source_link:
    'No source link recorded yet — reverse-BIM acceptance requires sourceDocumentId + page reference.',
  source_linked: 'Source link recorded; screenshot/overlay not yet captured.',
  screenshot_captured: 'Model screenshot captured; source overlay comparison pending.',
  overlay_compared: 'Source overlay comparison run; findings (if any) not yet dispositioned.',
  findings_open: 'Open evidence findings remain — acceptance blocked.',
  accepted: 'Evidence accepted for this view.',
};

/**
 * Build a lookup table from viewElementId to its joined source_view_evidence
 * element. TH-X-F006 — the project-browser pill prefers this real backing over
 * the legacy name heuristic. Returns undefined for views that do not have an
 * evidence record yet so the caller can fall back.
 */
function buildSourceEvidenceByViewId(
  elementsById: Record<string, Element>,
): Map<string, Element & { kind: 'source_view_evidence' }> {
  const map = new Map<string, Element & { kind: 'source_view_evidence' }>();
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'source_view_evidence') {
      map.set(el.viewElementId, el as Element & { kind: 'source_view_evidence' });
    }
  }
  return map;
}

function deriveSourceEvidenceState(args: {
  name: string;
  viewId?: string;
  evidenceByViewId?: Map<string, Element & { kind: 'source_view_evidence' }>;
  markerGroupId?: string | null;
  parentViewId?: string | null;
}): SourceEvidenceState {
  // Real-backing preferred (TH-X-F006): if a joined source_view_evidence
  // element exists for this view, use its status directly.
  if (args.viewId && args.evidenceByViewId) {
    const evidence = args.evidenceByViewId.get(args.viewId);
    if (evidence) return evidence.status;
  }
  // Legacy fallback while no evidence record exists yet — heuristic on the
  // view name + markerGroupId.
  const haystack = (args.name ?? '').toLowerCase();
  if (haystack.includes('[accepted]')) return 'accepted';
  if (haystack.includes('[findings]')) return 'findings_open';
  if (haystack.includes('[overlay]')) return 'overlay_compared';
  if (haystack.includes('[shot]') || haystack.includes('[screenshot]'))
    return 'screenshot_captured';
  if (
    haystack.includes('src:') ||
    haystack.includes('src=') ||
    /\bp\d+\b/.test(haystack) ||
    (args.markerGroupId ?? '').startsWith('src-')
  ) {
    return 'source_linked';
  }
  return 'missing_source_link';
}

function SourceEvidencePill({
  state,
  category,
  viewId,
}: {
  state: SourceEvidenceState;
  category: 'section' | 'exterior' | 'detail';
  viewId: string;
}): JSX.Element {
  const colorClass =
    state === 'accepted'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : state === 'findings_open'
        ? 'bg-rose-100 text-rose-700 border-rose-300'
        : state === 'overlay_compared'
          ? 'bg-sky-100 text-sky-700 border-sky-300'
          : state === 'screenshot_captured'
            ? 'bg-amber-100 text-amber-700 border-amber-300'
            : state === 'source_linked'
              ? 'bg-slate-100 text-slate-700 border-slate-300'
              : 'bg-zinc-100 text-zinc-600 border-zinc-300';
  return (
    <span
      data-th-ui-evidence-state={state}
      data-th-ui-evidence-category={category}
      data-th-ui-evidence-view-id={viewId}
      title={SOURCE_EVIDENCE_STATE_TITLE[state]}
      className={`ml-1 inline-block rounded border px-1 py-0 text-[8px] uppercase leading-tight ${colorClass}`}
    >
      {SOURCE_EVIDENCE_STATE_LABEL[state]}
    </span>
  );
}

const DISCIPLINE_GROUPS = [
  { key: 'arch', label: 'Architecture' },
  { key: 'struct', label: 'Structural' },
  { key: 'mep', label: 'MEP' },
  { key: 'coordination', label: 'Coordination' },
] as const;

type PlanViewDisciplineGroup = (typeof DISCIPLINE_GROUPS)[number]['key'];

function normalizePlanViewDiscipline(raw: string | undefined): PlanViewDisciplineGroup {
  if (raw === 'struct' || raw === 'structure' || raw === 'structural') return 'struct';
  if (raw === 'mep' || raw === 'mechanical' || raw === 'electrical' || raw === 'plumbing') {
    return 'mep';
  }
  if (raw === 'coordination' || raw === 'coord') return 'coordination';
  return 'arch';
}

function defaultSubdisciplineForGroup(group: PlanViewDisciplineGroup): string {
  if (group === 'struct') return 'Structural';
  if (group === 'mep') return 'MEP';
  if (group === 'coordination') return 'Coordination';
  return 'Architecture';
}

function subdisciplineTestToken(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'none'
  );
}

function planViewSubtypeLabel(subtype: PlanViewSubtypeValue | undefined): string {
  if (subtype === 'lighting_plan') return 'Lighting Plans';
  if (subtype === 'power_plan') return 'Power Plans';
  if (subtype === 'coordination_plan') return 'Coordination Plans';
  if (subtype === 'area_plan') return 'Area Plans';
  if (subtype === 'ceiling_plan') return 'Reflected Ceiling Plans';
  return 'Floor Plans';
}

function planViewSubtypeTestToken(subtype: PlanViewSubtypeValue | undefined): string {
  if (subtype === 'ceiling_plan') return 'ceiling-plans';
  return subtype ?? 'floor_plan';
}

function phaseLabelForPlanView(
  elementsById: Record<string, Element>,
  pv: Extract<Element, { kind: 'plan_view' }>,
): string {
  const phaseId = pv.phaseId;
  if (!phaseId) return 'No Phase';
  const phase = elementsById[phaseId];
  if (phase?.kind === 'phase') return phase.name ?? phase.id;
  return phaseId;
}

function phaseTestToken(label: string): string {
  return subdisciplineTestToken(label);
}

function defaultViewTemplateForPlanSubtype(
  elementsById: Record<string, Element>,
  subtype: PlanViewSubtypeValue | undefined,
): Extract<Element, { kind: 'view_template' }> | null {
  const wanted = subtype ?? 'floor_plan';
  const templates = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template',
  );
  const scored = templates
    .map((template) => {
      const haystack = `${template.id} ${template.name}`.toLowerCase();
      let score = 0;
      if (wanted === 'lighting_plan') {
        if (haystack.includes('lighting')) score += 8;
        if (haystack.includes('electrical')) score += 3;
      } else if (wanted === 'power_plan') {
        if (haystack.includes('power')) score += 8;
        if (haystack.includes('electrical')) score += 3;
      } else if (wanted === 'coordination_plan') {
        if (haystack.includes('coordination')) score += 8;
        if (haystack.includes('coord')) score += 4;
      } else if (wanted === 'area_plan') {
        if (haystack.includes('area')) score += 8;
      } else {
        if (haystack.includes('floor')) score += 6;
        if (haystack.includes('architect')) score += 3;
        if (haystack.includes('arch')) score += 2;
      }
      return { template, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name));
  return scored[0]?.template ?? null;
}

function newDupPlanViewId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

function shortTemplateTagRef(
  elementsById: Record<string, Element>,
  ref: string | null | undefined,
  lane: 'opening' | 'room',
): string {
  if (ref == null || ref === '') return '∅';
  const e = elementsById[ref];
  if (e?.kind !== 'plan_tag_style' || e.tagTarget !== lane) return '!';
  return e.id.length > 12 ? `${e.id.slice(0, 10)}…` : e.id;
}

function viewTemplateEvidenceLine(
  elementsById: Record<string, Element>,
  vt: Extract<Element, { kind: 'view_template' }>,
): string {
  const d =
    vt.planDetailLevel === undefined || vt.planDetailLevel === null
      ? 'inherit→medium'
      : vt.planDetailLevel;
  const fill = vt.planRoomFillOpacityScale ?? 1;
  const ot = (vt.planShowOpeningTags ?? false) ? 'on' : 'off';
  const rl = (vt.planShowRoomLabels ?? false) ? 'on' : 'off';
  const oRef = shortTemplateTagRef(elementsById, vt.defaultPlanOpeningTagStyleId, 'opening');
  const rRef = shortTemplateTagRef(elementsById, vt.defaultPlanRoomTagStyleId, 'room');
  const matrix = vt.templateControlMatrix ?? {};
  const excludedCount = Object.values(matrix).filter((row) => row?.included === false).length;
  const includedLabel = Object.keys(matrix).length ? ` · included ${5 - excludedCount}/5` : '';
  return `${vt.scale} · ${d} · fill ${fill} · tags ${ot}/${rl} · tagDef o:${oRef} r:${rRef}${includedLabel}`;
}

function projectBrowserScheduleCategory(schedule: Extract<Element, { kind: 'schedule' }>): string {
  const filters = schedule.filters as Record<string, unknown> | undefined;
  return String(filters?.category ?? '').trim();
}

function projectBrowserScheduleSheetStats(
  elementsById: Record<string, Element>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'sheet') continue;
    for (const raw of el.viewportsMm ?? []) {
      const rec = raw as Record<string, unknown>;
      const viewRef = String(rec.viewRef ?? rec.view_ref ?? '').trim();
      if (!viewRef.startsWith('schedule:')) continue;
      const id = viewRef.slice('schedule:'.length);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function planViewTooltip(
  pv: Extract<Element, { kind: 'plan_view' }>,
  elementsById: Record<string, Element>,
): string {
  const parts = [`plan_view (${pv.name})`];
  parts.push(planLevelEvidenceToken(elementsById, pv.levelId));
  parts.push(`discipline: ${pv.discipline ?? 'architecture'}`);
  if (pv.viewSubdiscipline) parts.push(`sub-discipline: ${pv.viewSubdiscipline}`);
  const tid = pv.viewTemplateId;
  if (tid) {
    const t = elementsById[tid];
    parts.push(t?.kind === 'view_template' ? `template: ${t.name}` : `templateRef: ${tid}`);
  }
  parts.push(planViewProjectBrowserEvidenceLine(elementsById, pv.id));
  const h = planViewBrowserHierarchyState(elementsById, pv.id);
  parts.push(
    `catSrc: def=${h.categoryDefaultCount} tmpl=${h.categoryTemplateCount} pv=${h.categoryPlanViewCount}`,
  );
  parts.push(`tagSrc: o=${h.openingTagSource} r=${h.roomTagSource}`);
  return parts.join(' · ');
}

/** Lightweight project-browser band: plan views grouped separately from mixed explorer. */

export function ProjectBrowser(props: {
  elementsById: Record<string, Element>;
  /** Emit `upsertPlanView` duplicates (WP-C01/C03). */
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  /** §12.1.1: IFC link client-side commands (addIfcLink, removeIfcLink, toggleIfcLinkVisibility). */
  onSemanticCommand?: (cmd: Record<string, unknown>) => void | Promise<void>;
}) {
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const setActiveViewpointId = useBimStore((s) => s.setActiveViewpointId);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const applyOrbitViewpointPreset = useBimStore((s) => s.applyOrbitViewpointPreset);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const modelId = useBimStore((s) => s.modelId);
  const groupRegistry = useBimStore((s) => s.groupRegistry);
  const setGroupEditModeDefinitionId = useBimStore((s) => s.setGroupEditModeDefinitionId);
  const lastPropagation = useViewTemplateStore((s) => s.lastPropagation);
  const dismissPropagation = useViewTemplateStore((s) => s.dismissPropagation);
  const vtStore = useViewTemplateStore();
  const [vtCollapsed, setVtCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [areaPlanInputOpen, setAreaPlanInputOpen] = useState(false);
  const [areaPlanDraft, setAreaPlanDraft] = useState('');
  const [areaPlanScheme, setAreaPlanScheme] = useState<AreaSchemeValue>('gross_building');
  const [areaPlanLevelId, setAreaPlanLevelId] = useState('');
  const [vtNameInputOpen, setVtNameInputOpen] = useState(false);
  const [vtNameDraft, setVtNameDraft] = useState('');
  const [elevationInputOpen, setElevationInputOpen] = useState(false);
  const [elevationDraft, setElevationDraft] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [groupCtxMenu, setGroupCtxMenu] = useState<{
    defId: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    if (!groupCtxMenu) return;
    const close = () => setGroupCtxMenu(null);
    const closeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGroupCtxMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeKey);
    };
  }, [groupCtxMenu]);

  const { planViewsSorted, planViewBuckets, bucketKeys } = useMemo(() => {
    const sorted = Object.values(props.elementsById)
      .filter((e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view')
      .sort((a, b) => a.name.localeCompare(b.name));
    // F-098: only bucket non-area-plan views for the Floor Plans section template grouping
    const floorOnly = sorted.filter(
      (pv) => !pv.planViewSubtype || pv.planViewSubtype !== 'area_plan',
    );
    const buckets = new Map<string, Extract<Element, { kind: 'plan_view' }>[]>();
    for (const pv of floorOnly) {
      const k = pv.viewTemplateId ?? 'none';
      const arr = buckets.get(k) ?? [];
      arr.push(pv);
      buckets.set(k, arr);
    }
    const keys = [...buckets.keys()].sort();
    return { planViewsSorted: sorted, planViewBuckets: buckets, bucketKeys: keys };
  }, [props.elementsById]);

  /** F-098: split plan views into regular floor plans, area plans, and ceiling plans. */
  const { floorPlanViews, areaPlans, ceilingPlans } = useMemo(() => {
    // D7: ceiling_plan is kept separate so it can appear under "Deckenansichten".
    const isCeiling = (pv: Extract<Element, { kind: 'plan_view' }>) =>
      (pv.planViewSubtype as string | undefined) === 'ceiling_plan';
    const floor = planViewsSorted.filter(
      (pv) => !pv.planViewSubtype || (pv.planViewSubtype !== 'area_plan' && !isCeiling(pv)),
    );
    const area = planViewsSorted.filter((pv) => pv.planViewSubtype === 'area_plan');
    const ceiling = planViewsSorted.filter(isCeiling);
    return { floorPlanViews: floor, areaPlans: area, ceilingPlans: ceiling };
  }, [planViewsSorted]);

  const levelsSorted = useMemo(
    () =>
      Object.values(props.elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm || a.name.localeCompare(b.name)),
    [props.elementsById],
  );

  /** TH-X-F006 — lookup table from viewElementId to the joined evidence row. */
  const sourceEvidenceByViewId = useMemo(
    () => buildSourceEvidenceByViewId(props.elementsById),
    [props.elementsById],
  );

  const areaPlanBuckets = useMemo(() => {
    const buckets: Record<AreaSchemeValue, Extract<Element, { kind: 'plan_view' }>[]> = {
      gross_building: [],
      net: [],
      rentable: [],
    };
    for (const pv of areaPlans) {
      const scheme =
        pv.areaScheme === 'net' || pv.areaScheme === 'rentable' ? pv.areaScheme : 'gross_building';
      buckets[scheme].push(pv);
    }
    return buckets;
  }, [areaPlans]);

  /** F-032: group plan views by discipline for Project Browser section headers. */
  const planViewDiscBuckets = useMemo(() => {
    const buckets: Record<PlanViewDisciplineGroup, Extract<Element, { kind: 'plan_view' }>[]> = {
      arch: [],
      struct: [],
      mep: [],
      coordination: [],
    };
    for (const pv of floorPlanViews) {
      const key = normalizePlanViewDiscipline(pv.discipline as string | undefined);
      buckets[key].push(pv);
    }
    return buckets;
  }, [floorPlanViews]);

  const hasDisciplineGrouping = floorPlanViews.some(
    (pv) =>
      normalizePlanViewDiscipline(pv.discipline as string | undefined) !== 'arch' ||
      !!pv.viewSubdiscipline ||
      !!pv.phaseId ||
      (pv.planViewSubtype != null && pv.planViewSubtype !== 'floor_plan'),
  );

  /** DSC-V3-01: group physical elements into arch / struct / mep buckets. */
  const disciplineBuckets = useMemo(() => {
    const buckets: Record<DisciplineTag, { id: string; kind: string; name: string }[]> = {
      arch: [],
      struct: [],
      mep: [],
    };
    for (const el of Object.values(props.elementsById)) {
      if (!('discipline' in el)) continue;
      const elWithKind = el as { kind: string; id: string; discipline?: DisciplineTag | null };
      const defaultDisc =
        DEFAULT_DISCIPLINE_BY_KIND[elWithKind.kind as keyof typeof DEFAULT_DISCIPLINE_BY_KIND];
      if (!defaultDisc) continue; // not a physical element with discipline support
      const disc: DisciplineTag = elWithKind.discipline ?? defaultDisc;
      const nameVal = (el as { name?: string }).name;
      buckets[disc].push({ id: el.id, kind: elWithKind.kind, name: nameVal ?? el.id });
    }
    return buckets;
  }, [props.elementsById]);

  const hasDisciplineElements =
    disciplineBuckets.arch.length > 0 ||
    disciplineBuckets.struct.length > 0 ||
    disciplineBuckets.mep.length > 0;

  const showPlanTemplateBuckets = bucketKeys.length >= 2;

  const templateBucketLabel = (tid: string) => {
    if (tid === 'none') return 'No template';
    const t = props.elementsById[tid];
    return t?.kind === 'view_template' ? t.name : tid;
  };

  const viewpoints3d = Object.values(props.elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'viewpoint' }> =>
        e.kind === 'viewpoint' && e.mode === 'orbit_3d',
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const viewpointsPlan = Object.values(props.elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'viewpoint' }> =>
        e.kind === 'viewpoint' && (e.mode === 'plan_2d' || e.mode === 'plan_canvas'),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const sectionCuts = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut')
    .sort((a, b) => a.name.localeCompare(b.name));

  // VIE-03: dedicated Elevations group, distinct from sections.
  const elevationViews = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'elevation_view' }> => e.kind === 'elevation_view')
    .sort((a, b) => a.name.localeCompare(b.name));

  // TH-UI-002: dedicated Detail Views group for architectural detail / callout views.
  // Reverse-BIM source pages such as eave, ridge, dormer, balcony, stair, wall/floor/roof
  // assembly, foundation, drainage interface, and facade opening details land here. The
  // group currently filters plan_view by planViewSubtype === 'callout' so the existing
  // data model can host them without a schema migration; future work can promote details
  // to a first-class kind once authoring stabilises.
  const detailViews = Object.values(props.elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'plan_view' }> =>
        e.kind === 'plan_view' && e.planViewSubtype === 'callout',
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const schedules = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule')
    .sort((a, b) => a.name.localeCompare(b.name));
  const scheduleSheetStats = useMemo(
    () => projectBrowserScheduleSheetStats(props.elementsById),
    [props.elementsById],
  );

  const sheets = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet')
    .sort((a, b) => a.name.localeCompare(b.name));

  const viewTemplates = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template')
    .sort((a, b) => a.name.localeCompare(b.name));

  const legends = Object.values(props.elementsById)
    .filter(
      (
        e,
      ): e is Extract<
        Element,
        { kind: 'window_legend_view' | 'color_fill_legend' | 'pipe_legend' | 'duct_legend' }
      > =>
        e.kind === 'window_legend_view' ||
        e.kind === 'color_fill_legend' ||
        e.kind === 'pipe_legend' ||
        e.kind === 'duct_legend',
    )
    .sort((a, b) => {
      const an = 'name' in a ? a.name : 'title' in a ? (a.title ?? a.id) : a.id;
      const bn = 'name' in b ? b.name : 'title' in b ? (b.title ?? b.id) : b.id;
      return an.localeCompare(bn);
    });

  const detailGroups = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'detail_group' }> => e.kind === 'detail_group')
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));

  const sites = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'site' }> => e.kind === 'site')
    .sort((a, b) => a.name.localeCompare(b.name));

  // FED-01 polish: collapsible "Links" group lists every link_model row.
  const linkModels = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'link_model' }> => e.kind === 'link_model')
    .sort((a, b) => a.name.localeCompare(b.name));

  // §12.1.1 — Linked IFC subtree
  const ifcLinks = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'link_ifc' }> => e.kind === 'link_ifc')
    .sort((a, b) => a.name.localeCompare(b.name));

  // F-003: Families section — wall_type, floor_type, roof_type
  const wallTypes = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'wall_type' }> => e.kind === 'wall_type')
    .sort((a, b) => a.name.localeCompare(b.name));

  const floorTypes = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type')
    .sort((a, b) => a.name.localeCompare(b.name));

  const roofTypes = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'roof_type' }> => e.kind === 'roof_type')
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasAnyDoc =
    planViewsSorted.length > 0 ||
    ceilingPlans.length > 0 ||
    viewpoints3d.length > 0 ||
    viewpointsPlan.length > 0 ||
    sectionCuts.length > 0 ||
    elevationViews.length > 0 ||
    schedules.length > 0 ||
    viewTemplates.length > 0 ||
    legends.length > 0 ||
    detailGroups.length > 0 ||
    sites.length > 0 ||
    linkModels.length > 0;

  if (!hasAnyDoc && sheets.length === 0) {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="font-semibold text-muted">Project browser</div>
        <ProjectBrowserSheetsGroup sheets={sheets} />
        <div className="text-[10px] text-muted">No documented views yet.</div>
      </div>
    );
  }

  const dupPlanView = (pv: Extract<Element, { kind: 'plan_view' }>) => {
    const cmd: Record<string, unknown> = {
      type: 'upsertPlanView',
      id: newDupPlanViewId(pv.id ? `${pv.id}-copy` : 'pv-copy'),
      name: `${pv.name} (copy)`,
      levelId: pv.levelId,
      planPresentation: pv.planPresentation ?? 'default',
      discipline: pv.discipline ?? 'architecture',
    };
    const fallbackTemplate = defaultViewTemplateForPlanSubtype(
      props.elementsById,
      pv.planViewSubtype ?? 'floor_plan',
    );
    if (pv.viewTemplateId) cmd.viewTemplateId = pv.viewTemplateId;
    else if (fallbackTemplate) cmd.viewTemplateId = fallbackTemplate.id;
    if (pv.planDetailLevel) cmd.planDetailLevel = pv.planDetailLevel;
    if (pv.planRoomFillOpacityScale != null && Number.isFinite(pv.planRoomFillOpacityScale)) {
      cmd.planRoomFillOpacityScale = pv.planRoomFillOpacityScale;
    }
    if (pv.planShowOpeningTags !== undefined) cmd.planShowOpeningTags = pv.planShowOpeningTags;
    if (pv.planShowRoomLabels !== undefined) cmd.planShowRoomLabels = pv.planShowRoomLabels;
    if (pv.planOpeningTagStyleId) cmd.planOpeningTagStyleId = pv.planOpeningTagStyleId;
    if (pv.planRoomTagStyleId) cmd.planRoomTagStyleId = pv.planRoomTagStyleId;
    if (pv.viewSubdiscipline) cmd.viewSubdiscipline = pv.viewSubdiscipline;
    if (pv.planViewSubtype) cmd.planViewSubtype = pv.planViewSubtype;
    if (pv.areaScheme) cmd.areaScheme = pv.areaScheme;
    if (pv.underlayLevelId) cmd.underlayLevelId = pv.underlayLevelId;
    if (pv.phaseId) cmd.phaseId = pv.phaseId;
    if (pv.categoriesHidden?.length) cmd.categoriesHidden = [...pv.categoriesHidden];
    const cmin = pv.cropMinMm;
    if (
      cmin &&
      typeof cmin === 'object' &&
      typeof cmin.xMm === 'number' &&
      typeof cmin.yMm === 'number'
    ) {
      cmd.cropMinMm = { xMm: cmin.xMm, yMm: cmin.yMm };
    }
    const cmax = pv.cropMaxMm;
    if (
      cmax &&
      typeof cmax === 'object' &&
      typeof cmax.xMm === 'number' &&
      typeof cmax.yMm === 'number'
    ) {
      cmd.cropMaxMm = { xMm: cmax.xMm, yMm: cmax.yMm };
    }
    if (
      pv.viewRangeBottomMm != null &&
      typeof pv.viewRangeBottomMm === 'number' &&
      Number.isFinite(pv.viewRangeBottomMm)
    ) {
      cmd.viewRangeBottomMm = pv.viewRangeBottomMm;
    }
    if (
      pv.viewRangeTopMm != null &&
      typeof pv.viewRangeTopMm === 'number' &&
      Number.isFinite(pv.viewRangeTopMm)
    ) {
      cmd.viewRangeTopMm = pv.viewRangeTopMm;
    }
    if (
      pv.cutPlaneOffsetMm != null &&
      typeof pv.cutPlaneOffsetMm === 'number' &&
      Number.isFinite(pv.cutPlaneOffsetMm)
    ) {
      cmd.cutPlaneOffsetMm = pv.cutPlaneOffsetMm;
    }
    props.onUpsertSemantic?.(cmd);
  };

  const renderPlanViewRow = (
    pv: Extract<Element, { kind: 'plan_view' }>,
    opts: { areaLabel?: string; duplicateTitle?: string } = {},
  ) => (
    <li key={pv.id} className="flex flex-col gap-0.5">
      {renamingId === pv.id ? (
        <input
          autoFocus
          type="text"
          data-testid={`plan-view-rename-input-${pv.id}`}
          value={renameDraft}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          onChange={(e) => setRenameDraft(e.currentTarget.value)}
          onBlur={() => void commitRename(pv.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commitRename(pv.id);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
        />
      ) : (
        <Btn
          type="button"
          variant="quiet"
          className="w-full px-2 py-0.5 text-left text-[10px]"
          title={planViewTooltip(pv, props.elementsById)}
          onClick={() => activatePlanView(pv.id)}
          onDoubleClick={() => {
            setRenamingId(pv.id);
            setRenameDraft(pv.name);
          }}
        >
          {opts.areaLabel ? `area_plan · ${opts.areaLabel} · ${pv.name}` : `plan_view · ${pv.name}`}
        </Btn>
      )}
      <div
        className="pl-2 font-mono text-[9px] leading-tight text-muted"
        data-bim-plan-view-evidence={pv.id}
      >
        {planLevelEvidenceToken(props.elementsById, pv.levelId)} ·{' '}
        {planViewProjectBrowserEvidenceLine(props.elementsById, pv.id)}
      </div>
      {(() => {
        const h = planViewBrowserHierarchyState(props.elementsById, pv.id);
        const hasNonDefault = h.categoryTemplateCount > 0 || h.categoryPlanViewCount > 0;
        const tagNonBuiltin = h.openingTagSource !== 'builtin' || h.roomTagSource !== 'builtin';
        if (!hasNonDefault && !tagNonBuiltin) return null;
        return (
          <div
            className="pl-2 font-mono text-[9px] leading-tight text-muted/70"
            data-bim-plan-view-hierarchy={pv.id}
          >
            {hasNonDefault
              ? `catSrc tmpl=${h.categoryTemplateCount} pv=${h.categoryPlanViewCount}`
              : null}
            {hasNonDefault && tagNonBuiltin ? ' · ' : null}
            {tagNonBuiltin ? `tagSrc o=${h.openingTagSource} r=${h.roomTagSource}` : null}
          </div>
        );
      })()}
      {props.onUpsertSemantic ? (
        <button
          type="button"
          className="pl-2 text-left text-[9px] text-muted underline"
          title={
            opts.duplicateTitle ?? 'Creates a duplicated plan_view with the same pinned settings'
          }
          onClick={() => dupPlanView(pv)}
        >
          Duplicate…
        </button>
      ) : null}
      {deleteConfirmId === pv.id ? (
        <span className="flex items-center gap-1 pl-2">
          <button
            type="button"
            data-testid={`plan-view-delete-confirm-${pv.id}`}
            className="text-[9px] text-red-700 underline"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(null);
              void applyCommand(modelId!, {
                type: 'deleteElement',
                elementId: pv.id,
              });
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="text-[9px] text-muted underline"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(null);
            }}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          data-testid={`plan-view-delete-${pv.id}`}
          title={`Delete this ${opts.areaLabel ? 'area plan' : 'plan'} view`}
          className="pl-2 text-left text-[9px] text-muted underline hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmId(pv.id);
          }}
        >
          Delete…
        </button>
      )}
    </li>
  );

  async function commitRename(viewId: string) {
    if (renamingId !== viewId) return;
    const trimmed = renameDraft.trim();
    const current = props.elementsById[viewId];
    const currentName =
      current && 'name' in current ? String((current as { name?: string }).name ?? '') : '';
    if (trimmed && trimmed !== currentName && modelId) {
      await applyCommand(modelId, {
        type: 'updateElementProperty',
        elementId: viewId,
        key: 'name',
        value: trimmed,
      });
    }
    setRenamingId(null);
    setRenameDraft('');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft('');
  }

  const renameFamilyType = async (id: string, name: string) => {
    if (!modelId) return;
    await applyCommand(modelId, {
      type: 'updateElementProperty',
      elementId: id,
      key: 'name',
      value: name,
    });
  };

  const duplicateFamilyType = async (item: ProjectBrowserFamilyTypeElement) => {
    const cmd = duplicateFamilyTypeCommand(item);
    if (props.onUpsertSemantic) {
      props.onUpsertSemantic(cmd);
      return;
    }
    if (modelId) await applyCommand(modelId, cmd);
  };

  const applyViewpointQuick = (vp: Extract<Element, { kind: 'viewpoint' }>) => {
    if (vp.mode === 'orbit_3d') {
      setViewerMode('orbit_3d');
      setActiveViewpointId(vp.id);
      const clip: Parameters<typeof applyOrbitViewpointPreset>[0] = {};
      if ('viewerClipCapElevMm' in vp && vp.viewerClipCapElevMm !== undefined)
        clip.capElevMm = vp.viewerClipCapElevMm;
      if ('viewerClipFloorElevMm' in vp && vp.viewerClipFloorElevMm !== undefined)
        clip.floorElevMm = vp.viewerClipFloorElevMm;
      if (vp.hiddenSemanticKinds3d?.length) clip.hideSemanticKinds = [...vp.hiddenSemanticKinds3d];
      if (Object.keys(clip).length) applyOrbitViewpointPreset(clip);
      setOrbitCameraFromViewpointMm({
        position: vp.camera.position,
        target: vp.camera.target,
        up: vp.camera.up,
      });
      return;
    }
    setActiveViewpointId(undefined);
    activatePlanView(undefined);
    useBimStore.getState().select(vp.id);
    if (vp.mode === 'plan_canvas' || vp.mode === 'plan_2d') setViewerMode('plan_canvas');
  };

  return (
    <div className="space-y-2 text-[11px]">
      <div className="font-semibold text-muted">Project browser</div>
      {floorPlanViews.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Floor plans</div>
          <div className="space-y-0.5">
            {hasDisciplineGrouping
              ? // F-032/F-099: discipline/sub-discipline grouped rendering.
                DISCIPLINE_GROUPS.map(({ key, label }) => {
                  const discViews = planViewDiscBuckets[key];
                  if (discViews.length === 0) return null;
                  const subBuckets = new Map<string, Extract<Element, { kind: 'plan_view' }>[]>();
                  for (const pv of discViews) {
                    const sub = pv.viewSubdiscipline || defaultSubdisciplineForGroup(key);
                    const rows = subBuckets.get(sub) ?? [];
                    rows.push(pv);
                    subBuckets.set(sub, rows);
                  }
                  return (
                    <div key={key} className="space-y-0.5" data-bim-disc-group={key}>
                      <div className="pl-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                        {label}
                      </div>
                      {[...subBuckets.entries()].map(([subLabel, views]) => {
                        const typeBuckets = new Map<
                          PlanViewSubtypeValue | undefined,
                          Extract<Element, { kind: 'plan_view' }>[]
                        >();
                        for (const pv of views) {
                          const subtype = pv.planViewSubtype ?? 'floor_plan';
                          const rows = typeBuckets.get(subtype) ?? [];
                          rows.push(pv);
                          typeBuckets.set(subtype, rows);
                        }
                        return (
                          <div
                            key={`${key}-${subLabel}`}
                            className="space-y-0.5"
                            data-testid={`project-browser-subdiscipline-${key}-${subdisciplineTestToken(subLabel)}`}
                          >
                            <div className="pl-4 text-[9px] font-semibold text-muted">
                              {subLabel}
                            </div>
                            {[...typeBuckets.entries()].map(([subtype, typeViews]) => {
                              const phaseBuckets = new Map<
                                string,
                                Extract<Element, { kind: 'plan_view' }>[]
                              >();
                              for (const pv of typeViews) {
                                const phase = phaseLabelForPlanView(props.elementsById, pv);
                                const rows = phaseBuckets.get(phase) ?? [];
                                rows.push(pv);
                                phaseBuckets.set(phase, rows);
                              }
                              return (
                                <div
                                  key={`${key}-${subLabel}-${subtype ?? 'floor_plan'}`}
                                  className="space-y-0.5"
                                  data-testid={`project-browser-view-type-${planViewSubtypeTestToken(subtype)}`}
                                >
                                  <div className="pl-6 text-[9px] font-semibold text-muted">
                                    {planViewSubtypeLabel(subtype)}
                                  </div>
                                  {[...phaseBuckets.entries()].map(([phase, phaseViews]) => (
                                    <div
                                      key={`${key}-${subLabel}-${subtype ?? 'floor_plan'}-${phase}`}
                                      className="space-y-0.5"
                                      data-testid={`project-browser-phase-${phaseTestToken(phase)}`}
                                    >
                                      <div className="pl-8 text-[9px] text-muted">{phase}</div>
                                      <ul className="space-y-0.5">
                                        {phaseViews.map((pv) => renderPlanViewRow(pv))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              : // Default: group by view template bucket (existing behaviour)
                bucketKeys.map((tid) => (
                  <div key={tid} className="space-y-0.5">
                    {showPlanTemplateBuckets ? (
                      <div className="pl-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                        {templateBucketLabel(tid)}
                      </div>
                    ) : null}
                    <ul className="space-y-0.5">
                      {(planViewBuckets.get(tid) ?? []).map((pv) => (
                        <li key={pv.id} className="flex flex-col gap-0.5">
                          {renamingId === pv.id ? (
                            <input
                              autoFocus
                              type="text"
                              data-testid={`plan-view-rename-input-${pv.id}`}
                              value={renameDraft}
                              className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                              onChange={(e) => setRenameDraft(e.currentTarget.value)}
                              onBlur={() => void commitRename(pv.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitRename(pv.id);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                            />
                          ) : (
                            <Btn
                              type="button"
                              variant="quiet"
                              className="w-full px-2 py-0.5 text-left text-[10px]"
                              title={planViewTooltip(pv, props.elementsById)}
                              onClick={() => activatePlanView(pv.id)}
                              onDoubleClick={() => {
                                setRenamingId(pv.id);
                                setRenameDraft(pv.name);
                              }}
                            >
                              plan_view · {pv.name}
                            </Btn>
                          )}
                          <div
                            className="pl-2 font-mono text-[9px] leading-tight text-muted"
                            data-bim-plan-view-evidence={pv.id}
                          >
                            {planLevelEvidenceToken(props.elementsById, pv.levelId)} ·{' '}
                            {planViewProjectBrowserEvidenceLine(props.elementsById, pv.id)}
                          </div>
                          {(() => {
                            const h = planViewBrowserHierarchyState(props.elementsById, pv.id);
                            const hasNonDefault =
                              h.categoryTemplateCount > 0 || h.categoryPlanViewCount > 0;
                            const tagNonBuiltin =
                              h.openingTagSource !== 'builtin' || h.roomTagSource !== 'builtin';
                            if (!hasNonDefault && !tagNonBuiltin) return null;
                            return (
                              <div
                                className="pl-2 font-mono text-[9px] leading-tight text-muted/70"
                                data-bim-plan-view-hierarchy={pv.id}
                              >
                                {hasNonDefault
                                  ? `catSrc tmpl=${h.categoryTemplateCount} pv=${h.categoryPlanViewCount}`
                                  : null}
                                {hasNonDefault && tagNonBuiltin ? ' · ' : null}
                                {tagNonBuiltin
                                  ? `tagSrc o=${h.openingTagSource} r=${h.roomTagSource}`
                                  : null}
                              </div>
                            );
                          })()}
                          {props.onUpsertSemantic ? (
                            <button
                              type="button"
                              className="pl-2 text-left text-[9px] text-muted underline"
                              title="Creates a duplicated plan_view with the same pinned settings"
                              onClick={() => dupPlanView(pv)}
                            >
                              Duplicate…
                            </button>
                          ) : null}
                          {deleteConfirmId === pv.id ? (
                            <span className="flex items-center gap-1 pl-2">
                              <button
                                type="button"
                                className="text-[9px] text-red-700 underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                  void applyCommand(modelId!, {
                                    type: 'deleteElement',
                                    elementId: pv.id,
                                  });
                                }}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                className="text-[9px] text-muted underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              data-testid={`plan-view-delete-${pv.id}`}
                              title="Delete this plan view"
                              className="pl-2 text-left text-[9px] text-muted underline hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(pv.id);
                              }}
                            >
                              Delete…
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
          </div>
        </div>
      ) : null}

      {/* F-098: dedicated Area Plans section */}
      <div className="space-y-1" data-testid="project-browser-area-plans-group">
        <div className="flex items-center gap-1">
          <div className="flex-1 text-[10px] uppercase tracking-wide text-muted">
            Area Plans {areaPlans.length > 0 ? `(${areaPlans.length})` : ''}
          </div>
          {areaPlanInputOpen ? (
            <div className="flex items-center gap-1">
              <select
                aria-label="Area plan scheme"
                data-testid="area-plan-new-scheme"
                className="w-24 rounded border border-border bg-background px-1 py-0 text-[9px] text-foreground"
                value={areaPlanScheme}
                onChange={(e) => setAreaPlanScheme(e.target.value as AreaSchemeValue)}
              >
                {AREA_SCHEMES.map((scheme) => (
                  <option key={scheme.value} value={scheme.value}>
                    {scheme.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Area plan level"
                data-testid="area-plan-new-level"
                className="w-20 rounded border border-border bg-background px-1 py-0 text-[9px] text-foreground"
                value={areaPlanLevelId || levelsSorted[0]?.id || ''}
                onChange={(e) => setAreaPlanLevelId(e.target.value)}
              >
                {levelsSorted.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
              <input
                autoFocus
                type="text"
                aria-label="Area plan name"
                value={areaPlanDraft}
                onChange={(e) => setAreaPlanDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const name = areaPlanDraft.trim();
                    const levelId = areaPlanLevelId || levelsSorted[0]?.id || '';
                    setAreaPlanInputOpen(false);
                    setAreaPlanDraft('');
                    if (!name || !modelId || !levelId) return;
                    const newId = `ap-${Date.now().toString(36)}`;
                    const defaultTemplate = defaultViewTemplateForPlanSubtype(
                      props.elementsById,
                      'area_plan',
                    );
                    await applyCommand(modelId, {
                      type: 'upsertPlanView',
                      id: newId,
                      name,
                      levelId,
                      planPresentation: 'default',
                      discipline: 'architecture',
                      planViewSubtype: 'area_plan',
                      areaScheme: areaPlanScheme,
                      ...(defaultTemplate ? { viewTemplateId: defaultTemplate.id } : {}),
                    });
                  } else if (e.key === 'Escape') {
                    setAreaPlanInputOpen(false);
                    setAreaPlanDraft('');
                  }
                }}
                className="w-24 rounded border border-border bg-background px-1 py-0 text-[9px] text-foreground"
                placeholder="Plan name…"
              />
            </div>
          ) : (
            <button
              type="button"
              className="text-[9px] text-muted hover:text-foreground"
              data-testid="area-plan-new"
              title="Create new Area Plan view"
              onClick={() => {
                if (!modelId) return;
                setAreaPlanLevelId(levelsSorted[0]?.id || '');
                setAreaPlanInputOpen(true);
              }}
            >
              +
            </button>
          )}
        </div>
        {areaPlans.length === 0 ? (
          <p className="pl-2 text-[10px] text-muted">
            No area plan views yet — click + to create one.
          </p>
        ) : (
          <div className="space-y-1">
            {AREA_SCHEMES.map((scheme) => {
              const rows = areaPlanBuckets[scheme.value];
              if (rows.length === 0) return null;
              return (
                <div key={scheme.value} data-testid={`area-plan-scheme-${scheme.value}`}>
                  <div className="pl-2 text-[9px] font-semibold uppercase text-muted">
                    {scheme.label} ({rows.length})
                  </div>
                  <ul className="space-y-0.5">
                    {rows.map((pv) => (
                      <li key={pv.id} className="flex flex-col gap-0.5">
                        {renamingId === pv.id ? (
                          <input
                            autoFocus
                            type="text"
                            data-testid={`plan-view-rename-input-${pv.id}`}
                            value={renameDraft}
                            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                            onChange={(e) => setRenameDraft(e.currentTarget.value)}
                            onBlur={() => void commitRename(pv.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void commitRename(pv.id);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                          />
                        ) : (
                          <Btn
                            type="button"
                            variant="quiet"
                            className="w-full px-2 py-0.5 text-left text-[10px]"
                            title={planViewTooltip(pv, props.elementsById)}
                            onClick={() => activatePlanView(pv.id)}
                            onDoubleClick={() => {
                              setRenamingId(pv.id);
                              setRenameDraft(pv.name);
                            }}
                          >
                            area_plan · {scheme.label} · {pv.name}
                          </Btn>
                        )}
                        <div
                          className="pl-2 font-mono text-[9px] leading-tight text-muted"
                          data-bim-plan-view-evidence={pv.id}
                        >
                          {planLevelEvidenceToken(props.elementsById, pv.levelId)} ·{' '}
                          {planViewProjectBrowserEvidenceLine(props.elementsById, pv.id)}
                        </div>
                        {props.onUpsertSemantic ? (
                          <button
                            type="button"
                            className="pl-2 text-left text-[9px] text-muted underline"
                            title="Creates a duplicated area plan view with the same pinned settings"
                            onClick={() => dupPlanView(pv)}
                          >
                            Duplicate…
                          </button>
                        ) : null}
                        {deleteConfirmId === pv.id ? (
                          <span className="flex items-center gap-1 pl-2">
                            <button
                              type="button"
                              className="text-[9px] text-red-700 underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                                void applyCommand(modelId!, {
                                  type: 'deleteElement',
                                  elementId: pv.id,
                                });
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="text-[9px] text-muted underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                              }}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-testid={`plan-view-delete-${pv.id}`}
                            title="Delete this area plan view"
                            className="pl-2 text-left text-[9px] text-muted underline hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(pv.id);
                            }}
                          >
                            Delete…
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D7: Deckenansichten — Reflected Ceiling Plan views */}
      {ceilingPlans.length > 0 ? (
        <div className="space-y-1" data-testid="project-browser-ceiling-plans-group">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Deckenansichten ({ceilingPlans.length})
          </div>
          <ul className="space-y-0.5">
            {ceilingPlans.map((pv) =>
              renderPlanViewRow(pv, { duplicateTitle: 'Duplicate this ceiling plan view' }),
            )}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1" data-testid="browser-view-templates-section">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex flex-1 items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
            onClick={() => setVtCollapsed((v) => !v)}
          >
            <span>{vtCollapsed ? '▸' : '▾'}</span>
            View Templates ({viewTemplates.length})
          </button>
          {vtNameInputOpen ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                aria-label="View template name"
                value={vtNameDraft}
                onChange={(e) => setVtNameDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const name = vtNameDraft.trim();
                    setVtNameInputOpen(false);
                    setVtNameDraft('');
                    if (!name || !modelId) return;
                    const newId = `vt-${Date.now().toString(36)}`;
                    await vtStore.createTemplate(modelId, newId, name);
                  } else if (e.key === 'Escape') {
                    setVtNameInputOpen(false);
                    setVtNameDraft('');
                  }
                }}
                onBlur={() => {
                  setVtNameInputOpen(false);
                  setVtNameDraft('');
                }}
                className="w-24 rounded border border-border bg-background px-1 py-0 text-[9px] text-foreground"
                placeholder="Template name…"
              />
            </div>
          ) : (
            <button
              type="button"
              className="text-[9px] text-muted hover:text-foreground"
              data-testid="view-template-new"
              title="Create new view template"
              onClick={() => {
                if (!modelId) return;
                setVtNameInputOpen(true);
              }}
            >
              + New
            </button>
          )}
        </div>
        {!vtCollapsed && viewTemplates.length === 0 && (
          <p className="pl-2 text-[10px] text-muted">
            No templates yet — click + New to create one.
          </p>
        )}
        {!vtCollapsed && viewTemplates.length > 0 && (
          <ul className="space-y-0.5">
            {viewTemplates.map((vt) => {
              const planViews = Object.values(props.elementsById).filter(
                (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
              );
              const usedCount = planViews.filter((pv) => pv.viewTemplateId === vt.id).length;
              return (
                <li
                  key={vt.id}
                  className="flex flex-col gap-0.5"
                  data-testid={`browser-view-template-row-${vt.id}`}
                >
                  <div className="flex items-center gap-1 px-1">
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-[10px]"
                      title={`view_template · ${vt.name} · ${viewTemplateEvidenceLine(props.elementsById, vt)}`}
                      onClick={() => useBimStore.getState().select(vt.id)}
                    >
                      <span className="text-muted">⬡</span> {vt.name}
                    </button>
                    {usedCount > 0 && (
                      <span
                        data-testid={`browser-vt-use-count-${vt.id}`}
                        className="text-[9px] text-muted"
                      >
                        {usedCount} view{usedCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <details className="relative">
                      <summary
                        className="cursor-pointer list-none text-[9px] text-muted hover:text-foreground"
                        data-testid={`browser-vt-apply-${vt.id}`}
                      >
                        Apply ▾
                      </summary>
                      <ul className="absolute right-0 z-50 min-w-[140px] rounded border bg-[var(--color-surface-strong)] py-1 shadow-md">
                        {planViews.map((pv) => (
                          <li key={pv.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-1 text-left text-[10px] hover:bg-surface-strong"
                              onClick={async () => {
                                void props.onSemanticCommand?.({
                                  type: 'applyViewTemplate',
                                  planViewId: pv.id,
                                  templateId: vt.id,
                                });
                                if (!modelId) return;
                                await vtStore.applyTemplate(modelId, pv.id, vt.id);
                              }}
                            >
                              {pv.name}
                            </button>
                          </li>
                        ))}
                        {planViews.length === 0 && (
                          <li className="px-3 py-1 text-[10px] text-muted">No plan views</li>
                        )}
                      </ul>
                    </details>
                    <button
                      type="button"
                      className="text-[9px] text-muted hover:text-foreground"
                      title="Edit template — opens in right-rail inspector"
                      onClick={() => useBimStore.getState().select(vt.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[9px] text-muted hover:text-foreground"
                      title="Duplicate template"
                      onClick={async () => {
                        if (!modelId) return;
                        const newId = `${vt.id}-copy-${Date.now().toString(36)}`;
                        await vtStore.createTemplate(modelId, newId, `${vt.name} (copy)`, {
                          scale: typeof vt.scale === 'number' ? vt.scale : undefined,
                          detailLevel: vt.detailLevel ?? undefined,
                          phase: vt.phase ?? undefined,
                          phaseFilter: vt.phaseFilter ?? undefined,
                        });
                      }}
                    >
                      Dup
                    </button>
                    <button
                      type="button"
                      className="text-[9px] text-muted hover:text-foreground"
                      title="Delete template"
                      onClick={async () => {
                        if (!modelId) return;
                        await vtStore.deleteTemplate(modelId, vt.id);
                      }}
                    >
                      Del
                    </button>
                  </div>
                  <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                    {viewTemplateEvidenceLine(props.elementsById, vt)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lastPropagation && (
        <PropagationToast
          propagation={lastPropagation}
          onDismiss={dismissPropagation}
          onViewList={() => {
            const first = lastPropagation.affected[0];
            if (first) useBimStore.getState().select(first);
          }}
        />
      )}

      <ProjectBrowserSheetsGroup sheets={sheets} />

      {legends.length ? (
        <div className="space-y-1" data-testid="project-browser-legends-group">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted">
            <span>Legends</span>
            <span className="rounded border border-border bg-background px-1 py-0 text-[9px]">
              {legends.length}
            </span>
          </div>
          <ul className="space-y-0.5">
            {legends.map((legend) => {
              const label =
                legend.kind === 'window_legend_view'
                  ? legend.name
                  : legend.kind === 'color_fill_legend'
                    ? legend.title
                    : (legend.title ?? legend.id);
              const parentSheetId =
                'parentSheetId' in legend
                  ? (legend.parentSheetId as string | undefined)
                  : undefined;
              const scope = 'scope' in legend ? (legend.scope as string | undefined) : undefined;
              const host =
                'hostViewId' in legend
                  ? `host=${legend.hostViewId}`
                  : parentSheetId
                    ? `sheet=${parentSheetId}`
                    : `scope=${scope ?? '—'}`;
              return (
                <li key={legend.id} className="flex flex-col gap-0.5">
                  <Btn
                    type="button"
                    variant="quiet"
                    className="w-full px-2 py-0.5 text-left text-[10px]"
                    title={`${legend.kind} · ${label} · ${host}`}
                    onClick={() => useBimStore.getState().select(legend.id)}
                  >
                    <span className="text-muted">{legend.kind} ·</span> {label}
                  </Btn>
                  <div className="pl-2 font-mono text-[9px] leading-tight text-muted">{host}</div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {detailGroups.length ? (
        <div className="space-y-1" data-testid="project-browser-groups-group">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted">
            <span>Groups</span>
            <span className="rounded border border-border bg-background px-1 py-0 text-[9px]">
              {detailGroups.length}
            </span>
          </div>
          <ul className="space-y-0.5">
            {detailGroups.map((group) => (
              <li key={group.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title={`detail_group · ${group.name ?? group.id} · host=${group.hostViewId}`}
                  onClick={() => useBimStore.getState().select(group.id)}
                >
                  <span className="text-muted">detail_group ·</span> {group.name ?? group.id}
                </Btn>
                <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                  host={group.hostViewId} · members={group.memberIds.length}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {schedules.length ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted">
            <span>Schedules</span>
            <span className="rounded border border-border bg-background px-1 py-0 text-[9px]">
              {schedules.length}
            </span>
          </div>
          <ul className="space-y-0.5">
            {schedules.map((schRow) => {
              const viewportCount = scheduleSheetStats.get(schRow.id) ?? 0;
              const category = projectBrowserScheduleCategory(schRow);
              return (
                <li key={schRow.id} className="flex flex-col gap-0.5">
                  <Btn
                    type="button"
                    variant="quiet"
                    className="w-full px-2 py-0.5 text-left text-[10px]"
                    title={`Select schedule (${schRow.name}) in explorer / inspector`}
                    onClick={() => useBimStore.getState().select(schRow.id)}
                  >
                    <span className="text-muted">schedule ·</span> {schRow.name}
                  </Btn>
                  <div className="flex flex-wrap gap-1 pl-2 text-[9px] leading-tight text-muted">
                    {category ? (
                      <span className="rounded border border-border bg-background px-1">
                        {category}
                      </span>
                    ) : null}
                    <span
                      className={[
                        'rounded border px-1',
                        viewportCount > 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                      ].join(' ')}
                    >
                      {viewportCount > 0 ? `${viewportCount} on sheet` : 'not on sheet'}
                    </span>
                  </div>
                  <div
                    className="pl-2 font-mono text-[9px] leading-tight text-muted"
                    data-bim-schedule-evidence={schRow.id}
                  >
                    {scheduleProjectBrowserEvidenceLine(props.elementsById, schRow)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sectionCuts.length ? (
        <div className="space-y-1" data-th-ui="sections-group">
          <div
            className="text-[10px] uppercase tracking-wide text-muted"
            title="Interior/cut views (section_cut). Exterior orthographic views live in the separate Exterior Views group below."
          >
            Sections
          </div>
          <ul className="space-y-0.5">
            {sectionCuts.map((sc) => (
              <li key={sc.id} className="flex flex-col gap-0.5">
                {renamingId === sc.id ? (
                  <input
                    autoFocus
                    type="text"
                    data-testid={`section-cut-rename-input-${sc.id}`}
                    value={renameDraft}
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                    onChange={(e) => setRenameDraft(e.currentTarget.value)}
                    onBlur={() => void commitRename(sc.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitRename(sc.id);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="w-full px-2 py-0.5 text-left text-[10px] underline decoration-muted underline-offset-2"
                      title={sectionCutBrowserTooltipTitle(props.elementsById, sc)}
                      onClick={() => useBimStore.getState().select(sc.id)}
                      onDoubleClick={() => {
                        setRenamingId(sc.id);
                        setRenameDraft(sc.name);
                      }}
                    >
                      <span className="text-muted">section_cut ·</span> {sc.name}
                      <SourceEvidencePill
                        state={deriveSourceEvidenceState({
                          name: sc.name,
                          viewId: sc.id,
                          evidenceByViewId: sourceEvidenceByViewId,
                        })}
                        category="section"
                        viewId={sc.id}
                      />
                    </button>
                    {deleteConfirmId === sc.id ? (
                      <span className="flex items-center gap-1 pl-2">
                        <button
                          type="button"
                          className="text-[9px] text-red-700 underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                            void applyCommand(modelId!, {
                              type: 'deleteElement',
                              elementId: sc.id,
                            });
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="text-[9px] text-muted underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`section-cut-delete-${sc.id}`}
                        title="Delete this section cut"
                        className="pl-2 text-left text-[9px] text-muted underline hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(sc.id);
                        }}
                      >
                        Delete…
                      </button>
                    )}
                  </>
                )}
                <div
                  className="pl-2 font-mono text-[9px] leading-tight text-muted"
                  data-bim-section-evidence={sc.id}
                >
                  {sectionCutProjectBrowserEvidenceLine(props.elementsById, sc)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {elevationViews.length || props.onUpsertSemantic ? (
        <div className="space-y-1" data-bim-elevations-group="1" data-th-ui="exterior-views-group">
          <div className="flex items-center gap-1">
            <div
              className="flex-1 text-[10px] uppercase tracking-wide text-muted"
              title="Exterior orthographic views (elevation_view) — front, rear, left/right gable, N/E/S/W, or source-named facade. Distinct from sections; opening one of these does not create a cut plane."
            >
              Exterior Views {elevationViews.length > 0 ? `(${elevationViews.length})` : ''}
            </div>
            {props.onUpsertSemantic ? (
              <>
                {elevationInputOpen ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      aria-label="Elevation name"
                      value={elevationDraft}
                      onChange={(e) => setElevationDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const name = elevationDraft.trim();
                          setElevationInputOpen(false);
                          setElevationDraft('');
                          if (!name) return;
                          props.onUpsertSemantic!({
                            type: 'createElevationView',
                            name,
                            direction: 'north',
                          });
                        } else if (e.key === 'Escape') {
                          setElevationInputOpen(false);
                          setElevationDraft('');
                        }
                      }}
                      onBlur={() => {
                        setElevationInputOpen(false);
                        setElevationDraft('');
                      }}
                      className="w-24 rounded border border-border bg-background px-1 py-0 text-[9px] text-foreground"
                      placeholder="Elevation name…"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-[9px] text-muted hover:text-foreground"
                    data-testid="elevation-view-new"
                    title="Create new elevation view"
                    onClick={() => setElevationInputOpen(true)}
                  >
                    +
                  </button>
                )}
                <button
                  type="button"
                  className="text-[9px] text-muted hover:text-foreground"
                  data-testid="elevation-view-generate-cardinal"
                  title="Generate 4 cardinal elevation views"
                  onClick={() => {
                    const dirs = [
                      { name: 'North Elevation', direction: 'north' },
                      { name: 'South Elevation', direction: 'south' },
                      { name: 'East Elevation', direction: 'east' },
                      { name: 'West Elevation', direction: 'west' },
                    ] as const;
                    for (const d of dirs) {
                      props.onUpsertSemantic!({
                        type: 'createElevationView',
                        name: d.name,
                        direction: d.direction,
                        markerGroupId: 'elevation-marker-cardinal',
                        markerSlot: d.direction,
                      });
                    }
                  }}
                >
                  N/S/E/W
                </button>
              </>
            ) : null}
          </div>
          {elevationViews.length === 0 ? (
            <p className="pl-2 text-[10px] text-muted">
              No elevation views yet — click N/S/E/W to generate all four cardinal views.
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {elevationViews.map((ev) => (
              <li key={ev.id} className="flex flex-col gap-0.5">
                {renamingId === ev.id ? (
                  <input
                    autoFocus
                    type="text"
                    data-testid={`elevation-view-rename-input-${ev.id}`}
                    value={renameDraft}
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                    onChange={(e) => setRenameDraft(e.currentTarget.value)}
                    onBlur={() => void commitRename(ev.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitRename(ev.id);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="w-full px-2 py-0.5 text-left text-[10px] underline decoration-muted underline-offset-2"
                      onClick={() => useBimStore.getState().select(ev.id)}
                      onDoubleClick={() => {
                        setRenamingId(ev.id);
                        setRenameDraft(ev.name);
                      }}
                    >
                      <span className="text-muted">elevation_view ·</span> {ev.name}
                      <SourceEvidencePill
                        state={deriveSourceEvidenceState({
                          name: ev.name,
                          viewId: ev.id,
                          evidenceByViewId: sourceEvidenceByViewId,
                          markerGroupId: ev.markerGroupId,
                        })}
                        category="exterior"
                        viewId={ev.id}
                      />
                    </button>
                    {deleteConfirmId === ev.id ? (
                      <span className="flex items-center gap-1 pl-2">
                        <button
                          type="button"
                          className="text-[9px] text-red-700 underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                            void applyCommand(modelId!, {
                              type: 'deleteElement',
                              elementId: ev.id,
                            });
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="text-[9px] text-muted underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`elevation-view-delete-${ev.id}`}
                        title="Delete this elevation view"
                        className="pl-2 text-left text-[9px] text-muted underline hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(ev.id);
                        }}
                      >
                        Delete…
                      </button>
                    )}
                  </>
                )}
                <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                  direction · {ev.direction}
                  {ev.direction === 'custom' && typeof ev.customAngleDeg === 'number'
                    ? ` (${ev.customAngleDeg}°)`
                    : ''}
                  {ev.markerGroupId ? ` · marker ${ev.markerGroupId}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* TH-UI-002 — Detail Views group (filters plan_view callouts) */}
      {detailViews.length || props.onUpsertSemantic ? (
        <div
          className="space-y-1"
          data-th-ui="detail-views-group"
          data-testid="project-browser-detail-views-group"
        >
          <div className="flex items-center gap-1">
            <div
              className="flex-1 text-[10px] uppercase tracking-wide text-muted"
              title="Architectural detail / callout views (roof eave, ridge, dormer, balcony, stair, wall/floor/roof assembly, foundation, drainage interface, facade opening). Backed today by plan_view planViewSubtype='callout'."
            >
              Detail Views {detailViews.length > 0 ? `(${detailViews.length})` : ''}
            </div>
            {props.onUpsertSemantic ? (
              <button
                type="button"
                className="text-[9px] text-muted hover:text-foreground"
                data-testid="detail-view-new"
                title="Create a new architectural detail view (planViewSubtype=callout)"
                onClick={() => {
                  const name = window.prompt(
                    'Detail view name (e.g., "Eave detail south", "Stair detail EG-DG"):',
                    'Detail',
                  );
                  if (!name) return;
                  const level = levelsSorted[0];
                  if (!level) {
                    window.alert(
                      'Create at least one level before adding a detail view (callouts need a host level).',
                    );
                    return;
                  }
                  const newId = `dv-${Date.now().toString(36)}`;
                  props.onUpsertSemantic!({
                    type: 'upsertPlanView',
                    id: newId,
                    name,
                    levelId: level.id,
                    planPresentation: 'default',
                    discipline: 'architecture',
                    planViewSubtype: 'callout',
                  });
                }}
              >
                +
              </button>
            ) : null}
          </div>
          {detailViews.length === 0 ? (
            <p className="pl-2 text-[10px] text-muted">
              No detail views yet — click + to create one. Reverse-BIM source detail pages (eave,
              ridge, dormer, balcony, stair, wall/floor/roof assembly, foundation, drainage
              interface, facade opening) should land here.
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {detailViews.map((dv) => (
              <li key={dv.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title={planViewTooltip(dv, props.elementsById)}
                  onClick={() => activatePlanView(dv.id)}
                  onDoubleClick={() => {
                    setRenamingId(dv.id);
                    setRenameDraft(dv.name);
                  }}
                >
                  <span className="text-muted">detail ·</span> {dv.name}
                  <SourceEvidencePill
                    state={deriveSourceEvidenceState({
                      name: dv.name,
                      viewId: dv.id,
                      evidenceByViewId: sourceEvidenceByViewId,
                      parentViewId: dv.parentViewId,
                    })}
                    category="detail"
                    viewId={dv.id}
                  />
                </Btn>
                <div
                  className="pl-2 font-mono text-[9px] leading-tight text-muted"
                  data-bim-detail-evidence={dv.id}
                >
                  {planLevelEvidenceToken(props.elementsById, dv.levelId)}
                  {dv.parentViewId ? ` · parent=${dv.parentViewId}` : ''}
                  {typeof dv.calloutScaleOverride === 'number'
                    ? ` · 1:${dv.calloutScaleOverride}`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewpoints3d.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">3D saved views</div>
          <p className="pl-0.5 text-[9px] leading-snug text-muted">
            Rows show persisted clip/cutaway on <span className="font-mono">viewpoint</span> —
            activate to mirror in 3D.
          </p>
          <ul className="space-y-0.5">
            {viewpoints3d.map((vp) => (
              <li key={vp.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  onClick={() => applyViewpointQuick(vp)}
                  title={`Persisted clip/cutaway (document): ${viewpointOrbit3dEvidenceLine(vp)}`}
                >
                  viewpoint · {vp.name}
                  <span className="font-mono text-[9px] text-muted"> · {vp.mode}</span>
                </Btn>
                {vp.mode === 'orbit_3d' ? (
                  <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                    {viewpointOrbit3dEvidenceLine(vp)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewpointsPlan.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Plan / canvas viewpoints
          </div>
          <ul className="space-y-0.5">
            {viewpointsPlan.map((vp) => (
              <li key={vp.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  onClick={() => applyViewpointQuick(vp)}
                  title={`viewpoint (${vp.mode})`}
                >
                  viewpoint · {vp.name}
                  <span className="font-mono text-[9px] text-muted"> · {vp.mode}</span>
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sites.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Sites</div>
          <ul className="space-y-0.5">
            {sites.map((st) => (
              <li key={st.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title="Select site in explorer / inspector"
                  onClick={() => useBimStore.getState().select(st.id)}
                >
                  <span className="text-muted">site ·</span> {st.name}
                </button>
                <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                  {siteProjectBrowserEvidenceLine(props.elementsById, st)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {linkModels.length ? <ProjectBrowserLinksGroup links={linkModels} /> : null}

      {/* §12.1.1 — Linked IFC subtree */}
      {ifcLinks.length > 0 ? (
        <ProjectBrowserLinkedIfcGroup
          links={ifcLinks}
          onSemanticCommand={props.onSemanticCommand}
        />
      ) : null}

      {hasDisciplineElements ? (
        <div className="space-y-1" data-testid="project-browser-disciplines-group">
          <div className="text-[10px] uppercase tracking-wide text-muted">Categories</div>
          {(['arch', 'struct', 'mep'] as const).map((disc) => {
            const rows = disciplineBuckets[disc];
            if (rows.length === 0) return null;
            const label =
              disc === 'arch' ? 'Architecture' : disc === 'struct' ? 'Structure' : 'MEP';
            return (
              <div key={disc} className="space-y-0.5">
                <div className="pl-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                  {label} ({rows.length})
                </div>
                <ul className="space-y-0">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-0.5 text-left text-[10px] hover:bg-surface-strong"
                        onClick={() => useBimStore.getState().select(row.id)}
                        title={`${row.kind} · ${row.id}`}
                      >
                        <span className="text-muted">{row.kind} ·</span> {row.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      {wallTypes.length > 0 || floorTypes.length > 0 || roofTypes.length > 0 ? (
        <ProjectBrowserFamiliesGroup
          wallTypes={wallTypes}
          floorTypes={floorTypes}
          roofTypes={roofTypes}
          onSelect={(id) => useBimStore.getState().select(id)}
          onRename={renameFamilyType}
          onDuplicate={duplicateFamilyType}
        />
      ) : null}

      {Object.keys(groupRegistry.definitions).length > 0 ? (
        <div className="space-y-1" data-testid="project-browser-groups-group">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Groups ({Object.keys(groupRegistry.definitions).length})
          </div>
          <ul className="space-y-0">
            {Object.values(groupRegistry.definitions).map((def) => {
              const instanceCount = Object.values(groupRegistry.instances).filter(
                (inst) => inst.groupDefinitionId === def.id,
              ).length;
              return (
                <li key={def.id} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    className="w-full px-2 py-0.5 text-left text-[10px] hover:bg-surface-strong"
                    title={`group · ${def.name} · ${def.elementIds.length} elements · ${instanceCount} instance(s)`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setGroupCtxMenu({ defId: def.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <span className="text-muted">group ·</span> {def.name}
                    <span className="ml-1 text-muted">
                      ({def.elementIds.length}e · {instanceCount}i)
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {groupCtxMenu ? (
            <div
              role="menu"
              data-testid="group-context-menu"
              className="fixed z-50 min-w-36 rounded border border-border bg-surface py-1 text-xs text-foreground shadow-lg"
              style={{ left: groupCtxMenu.x, top: groupCtxMenu.y }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && setGroupCtxMenu(null)}
            >
              <button
                type="button"
                role="menuitem"
                data-testid="group-ctx-edit"
                className="block w-full px-3 py-1.5 text-left hover:bg-surface-strong"
                onClick={() => {
                  setGroupEditModeDefinitionId(groupCtxMenu.defId);
                  setGroupCtxMenu(null);
                }}
              >
                Edit Group
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectBrowserSheetsGroup({
  sheets,
}: {
  sheets: Extract<Element, { kind: 'sheet' }>[];
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const modelId = useBimStore((s) => s.modelId);

  const handleCreateSheet = async (cmd: Record<string, unknown>): Promise<void> => {
    if (!modelId) return;
    await applyCommand(modelId, cmd);
  };

  return (
    <div className="space-y-1" data-testid="project-browser-sheets-group">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          data-testid="project-browser-sheets-toggle"
          className="flex flex-1 items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
        >
          <span>{collapsed ? '▸' : '▾'}</span>
          Sheets {sheets.length > 0 ? `(${sheets.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setShowNewSheet(true)}
          data-testid="project-browser-sheets-new"
          className="rounded px-1 text-[9px] text-muted hover:text-foreground"
          title="New sheet"
        >
          +
        </button>
      </div>
      {!collapsed && sheets.length > 0 && (
        <ul className="space-y-0.5">
          {sheets.map((sh) => {
            const number = (sh as { number?: string }).number;
            const label = number ? `${number} · ${sh.name}` : sh.name;
            return (
              <li key={sh.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title={`Open sheet ${sh.name}`}
                  onClick={() => useBimStore.getState().select(sh.id)}
                >
                  <span className="text-muted">sheet ·</span> {label}
                </Btn>
                <div
                  className="pl-2 font-mono text-[9px] leading-tight text-muted"
                  data-bim-sheet-evidence={sh.id}
                >
                  {sheetProjectBrowserEvidenceLine(sh)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {showNewSheet && (
        <NewSheetDialog
          onClose={() => setShowNewSheet(false)}
          onSubmit={(cmd) => {
            void handleCreateSheet(cmd);
          }}
        />
      )}
    </div>
  );
}

export function ProjectBrowserLinksGroup({
  links,
}: {
  links: Extract<Element, { kind: 'link_model' }>[];
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const modelId = useBimStore((s) => s.modelId);
  const linkSourceRevisions = useBimStore((s) => s.linkSourceRevisions);
  const [pending, setPending] = useState<string | null>(null);

  const toggleHidden = async (l: Extract<Element, { kind: 'link_model' }>): Promise<void> => {
    if (!modelId) return;
    setPending(l.id);
    try {
      await applyCommand(modelId, {
        type: 'updateLinkModel',
        linkId: l.id,
        hidden: !l.hidden,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-1" data-testid="project-browser-links-group">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        data-testid="project-browser-links-toggle"
        className="flex w-full items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        Links ({links.length})
      </button>
      {collapsed ? null : (
        <ul className="space-y-0.5">
          {links.map((l) => {
            const cur = linkSourceRevisions[l.sourceModelId];
            const pinned = l.sourceModelRevision ?? null;
            const drift = pinned != null && typeof cur === 'number' ? Math.max(0, cur - pinned) : 0;
            const hidden = !!l.hidden;
            return (
              <li
                key={l.id}
                data-testid={`project-browser-links-row-${l.id}`}
                className="flex items-center gap-2 px-2 py-0.5 text-[10px]"
              >
                <button
                  type="button"
                  disabled={pending === l.id}
                  data-testid={`project-browser-links-eye-${l.id}`}
                  onClick={() => void toggleHidden(l)}
                  title={hidden ? 'Show link in viewport' : 'Hide link in viewport'}
                  className="rounded border border-border px-1 text-[10px] hover:bg-surface-strong disabled:opacity-50"
                >
                  {hidden ? '◌' : '●'}
                </button>
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => useBimStore.getState().select(l.id)}
                  title={`Select link_model ${l.name}`}
                >
                  <span className="text-muted">link_model ·</span> {l.name}
                </button>
                {drift > 0 ? (
                  <span
                    data-testid={`project-browser-links-drift-${l.id}`}
                    title={`Source advanced by ${drift} commit${drift === 1 ? '' : 's'}`}
                    style={{
                      background: 'var(--color-warning)',
                      color: 'var(--color-warning-foreground)',
                      padding: '0 4px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    +{drift}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §12.1.1 — ProjectBrowserLinkedIfcGroup: Linked IFC subtree
// ---------------------------------------------------------------------------

type IfcLinkElem = Extract<Element, { kind: 'link_ifc' }>;

export function ProjectBrowserLinkedIfcGroup({
  links,
  onSemanticCommand,
}: {
  links: IfcLinkElem[];
  onSemanticCommand?: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-1" data-testid="browser-linked-ifc-tree">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        data-testid="browser-linked-ifc-toggle"
        className="flex w-full items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        Linked IFC ({links.length})
      </button>
      {collapsed ? null : (
        <ul className="space-y-0.5">
          {links.map((link) => (
            <li
              key={link.id}
              data-testid={`browser-linked-ifc-row-${link.id}`}
              className="flex items-center gap-2 px-2 py-0.5 text-[10px]"
            >
              <button
                type="button"
                data-testid={`browser-linked-ifc-eye-${link.id}`}
                onClick={() =>
                  void onSemanticCommand?.({ type: 'toggleIfcLinkVisibility', linkId: link.id })
                }
                title={link.visible ? 'Hide linked IFC' : 'Show linked IFC'}
                className="rounded border border-border px-1 text-[10px] hover:bg-surface-strong"
              >
                {link.visible ? '●' : '◌'}
              </button>
              <span className="flex-1 truncate text-left">{link.name}</span>
              <button
                type="button"
                data-testid={`browser-linked-ifc-remove-${link.id}`}
                onClick={() => void onSemanticCommand?.({ type: 'removeIfcLink', linkId: link.id })}
                title="Remove linked IFC"
                className="rounded border border-border px-1 text-[10px] hover:bg-surface-strong"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CHR-V3-07 — ProjectBrowserV3: refreshed left-rail project browser
// ---------------------------------------------------------------------------

export type ProjectBrowserProps = {
  elements: Element[];
  activeViewId: string | null;
  onActivateView: (viewId: string) => void;
  onRenameView: (viewId: string, newName: string) => void;
  onDeleteView: (viewId: string) => void;
  onDuplicateView: (viewId: string) => void;
  /** D7: optional callback for the "Properties" context-menu action. */
  onPropertiesView?: (viewId: string) => void;
  /** §6.1.3 — optional lock/unlock toggle for saved_view rows. */
  onToggleLockView?: (viewId: string) => void;
  collapsed?: boolean;
  /** §6.1.3 — saved_3d_view callbacks */
  onSave3dView?: (name: string) => void;
  onRestore3dView?: (viewId: string) => void;
  onDelete3dView?: (viewId: string) => void;
  onRename3dView?: (viewId: string, name: string) => void;
  onToggleLock3dView?: (viewId: string) => void;
  /** §14.5 — save current camera as a named perspective view */
  onSaveCameraView?: () => void;
  /** §1.6.11 — semantic command dispatcher (e.g. selectGroupElements). */
  onSemanticCommand?: (cmd: Record<string, unknown>) => void | Promise<void>;
};

export { ProjectBrowserV3 } from './ProjectBrowserV3';
