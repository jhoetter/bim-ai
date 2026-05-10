import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { JSX, DragEvent } from 'react';
import type { DisciplineTag, Element } from '@bim-ai/core';
import { DEFAULT_DISCIPLINE_BY_KIND } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { applyCommand } from '../../lib/api';
import { useViewTemplateStore } from '../../collab/viewTemplateStore';
import { PropagationToast } from './PropagationToast';

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
  return `${vt.scale} · ${d} · fill ${fill} · tags ${ot}/${rl} · tagDef o:${oRef} r:${rRef}`;
}

function planViewTooltip(
  pv: Extract<Element, { kind: 'plan_view' }>,
  elementsById: Record<string, Element>,
): string {
  const parts = [`plan_view (${pv.name})`];
  parts.push(planLevelEvidenceToken(elementsById, pv.levelId));
  parts.push(`discipline: ${pv.discipline ?? 'architecture'}`);
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
}) {
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const setActiveViewpointId = useBimStore((s) => s.setActiveViewpointId);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const applyOrbitViewpointPreset = useBimStore((s) => s.applyOrbitViewpointPreset);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const modelId = useBimStore((s) => s.modelId);
  const lastPropagation = useViewTemplateStore((s) => s.lastPropagation);
  const dismissPropagation = useViewTemplateStore((s) => s.dismissPropagation);
  const vtStore = useViewTemplateStore();
  const [vtCollapsed, setVtCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [areaPlanInputOpen, setAreaPlanInputOpen] = useState(false);
  const [areaPlanDraft, setAreaPlanDraft] = useState('');
  const [vtNameInputOpen, setVtNameInputOpen] = useState(false);
  const [vtNameDraft, setVtNameDraft] = useState('');
  const [elevationInputOpen, setElevationInputOpen] = useState(false);
  const [elevationDraft, setElevationDraft] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  /** F-098: split plan views into regular floor plans and area plans. */
  const { floorPlanViews, areaPlans } = useMemo(() => {
    const floor = planViewsSorted.filter(
      (pv) => !pv.planViewSubtype || pv.planViewSubtype !== 'area_plan',
    );
    const area = planViewsSorted.filter((pv) => pv.planViewSubtype === 'area_plan');
    return { floorPlanViews: floor, areaPlans: area };
  }, [planViewsSorted]);

  /** F-032: group plan views by discipline for Project Browser section headers. */
  const planViewDiscBuckets = useMemo(() => {
    const buckets: Record<string, Extract<Element, { kind: 'plan_view' }>[]> = {
      arch: [],
      struct: [],
      mep: [],
    };
    for (const pv of floorPlanViews) {
      const disc = (pv.discipline as string | undefined) ?? 'arch';
      const key = disc in buckets ? disc : 'arch';
      buckets[key].push(pv);
    }
    return buckets;
  }, [floorPlanViews]);

  const hasDisciplineGrouping = floorPlanViews.some(
    (pv) => pv.discipline && pv.discipline !== 'arch',
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

  const schedules = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule')
    .sort((a, b) => a.name.localeCompare(b.name));

  const sheets = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet')
    .sort((a, b) => a.name.localeCompare(b.name));

  const viewTemplates = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template')
    .sort((a, b) => a.name.localeCompare(b.name));

  const sites = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'site' }> => e.kind === 'site')
    .sort((a, b) => a.name.localeCompare(b.name));

  // FED-01 polish: collapsible "Links" group lists every link_model row.
  const linkModels = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'link_model' }> => e.kind === 'link_model')
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
    viewpoints3d.length > 0 ||
    viewpointsPlan.length > 0 ||
    sectionCuts.length > 0 ||
    elevationViews.length > 0 ||
    schedules.length > 0 ||
    viewTemplates.length > 0 ||
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
    if (pv.viewTemplateId) cmd.viewTemplateId = pv.viewTemplateId;
    if (pv.planDetailLevel) cmd.planDetailLevel = pv.planDetailLevel;
    if (pv.planRoomFillOpacityScale != null && Number.isFinite(pv.planRoomFillOpacityScale)) {
      cmd.planRoomFillOpacityScale = pv.planRoomFillOpacityScale;
    }
    if (pv.planShowOpeningTags !== undefined) cmd.planShowOpeningTags = pv.planShowOpeningTags;
    if (pv.planShowRoomLabels !== undefined) cmd.planShowRoomLabels = pv.planShowRoomLabels;
    if (pv.planOpeningTagStyleId) cmd.planOpeningTagStyleId = pv.planOpeningTagStyleId;
    if (pv.planRoomTagStyleId) cmd.planRoomTagStyleId = pv.planRoomTagStyleId;
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

  const commitRename = async (viewId: string) => {
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
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
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
              ? // F-032: discipline-grouped rendering when mixed disciplines are present
                (
                  [
                    { key: 'arch', label: 'Architecture' },
                    { key: 'struct', label: 'Structural' },
                    { key: 'mep', label: 'MEP' },
                  ] as const
                ).map(({ key, label }) => {
                  const discViews = planViewDiscBuckets[key];
                  if (discViews.length === 0) return null;
                  return (
                    <div key={key} className="space-y-0.5" data-bim-disc-group={key}>
                      <div className="pl-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                        {label}
                      </div>
                      <ul className="space-y-0.5">
                        {discViews.map((pv) => (
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
              <input
                autoFocus
                type="text"
                aria-label="Area plan name"
                value={areaPlanDraft}
                onChange={(e) => setAreaPlanDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const name = areaPlanDraft.trim();
                    setAreaPlanInputOpen(false);
                    setAreaPlanDraft('');
                    if (!name || !modelId) return;
                    const newId = `ap-${Date.now().toString(36)}`;
                    await applyCommand(modelId, {
                      type: 'upsertPlanView',
                      id: newId,
                      name,
                      levelId: '',
                      planPresentation: 'default',
                      discipline: 'architecture',
                      planViewSubtype: 'area_plan',
                    });
                  } else if (e.key === 'Escape') {
                    setAreaPlanInputOpen(false);
                    setAreaPlanDraft('');
                  }
                }}
                onBlur={() => {
                  setAreaPlanInputOpen(false);
                  setAreaPlanDraft('');
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
          <ul className="space-y-0.5">
            {areaPlans.map((pv) => (
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
                    area_plan · {pv.name}
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
        )}
      </div>

      <div className="space-y-1">
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
              return (
                <li key={vt.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 px-1">
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-[10px]"
                      title={`view_template · ${vt.name} · ${viewTemplateEvidenceLine(props.elementsById, vt)}`}
                      onClick={() => useBimStore.getState().select(vt.id)}
                    >
                      <span className="text-muted">⬡</span> {vt.name}
                    </button>
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-[9px] text-muted hover:text-foreground">
                        Apply ▾
                      </summary>
                      <ul className="absolute right-0 z-50 min-w-[140px] rounded border bg-[var(--color-surface-strong)] py-1 shadow-md">
                        {planViews.map((pv) => (
                          <li key={pv.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-1 text-left text-[10px] hover:bg-surface-strong"
                              onClick={async () => {
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

      {schedules.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Schedules</div>
          <ul className="space-y-0.5">
            {schedules.map((schRow) => (
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
                <div
                  className="pl-2 font-mono text-[9px] leading-tight text-muted"
                  data-bim-schedule-evidence={schRow.id}
                >
                  {scheduleProjectBrowserEvidenceLine(props.elementsById, schRow)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sectionCuts.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Sections & elevations
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
        <div className="space-y-1" data-bim-elevations-group="1">
          <div className="flex items-center gap-1">
            <div className="flex-1 text-[10px] uppercase tracking-wide text-muted">
              Elevations {elevationViews.length > 0 ? `(${elevationViews.length})` : ''}
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
        />
      ) : null}
    </div>
  );
}

function ProjectBrowserSheetsGroup({
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

function ProjectBrowserLinksGroup({
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
// CHR-V3-07 — ProjectBrowserV3: refreshed left-rail project browser
// ---------------------------------------------------------------------------

export type ProjectBrowserProps = {
  elements: Element[];
  activeViewId: string | null;
  onActivateView: (viewId: string) => void;
  onRenameView: (viewId: string, newName: string) => void;
  onDeleteView: (viewId: string) => void;
  onDuplicateView: (viewId: string) => void;
  collapsed?: boolean;
};

type CtxMenu = { viewId: string; x: number; y: number } | null;

/** Derive a discipline label from element tags when present. */
function disciplineLabel(el: Element): string | null {
  if ('discipline' in el && typeof (el as { discipline?: string }).discipline === 'string') {
    const d = (el as { discipline?: string }).discipline;
    if (d === 'arch') return 'Architecture';
    if (d === 'struct') return 'Structure';
    if (d === 'mep') return 'MEP';
    return d ?? null;
  }
  return null;
}

/** Group rows by discipline label (or single unlabelled group if none present). */
function groupByDiscipline<T extends Element>(rows: T[]): { label: string | null; rows: T[] }[] {
  const hasAnyDisc = rows.some((r) => disciplineLabel(r) !== null);
  if (!hasAnyDisc) return [{ label: null, rows }];
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = disciplineLabel(r) ?? 'Other';
    const bucket = map.get(k) ?? [];
    bucket.push(r);
    map.set(k, bucket);
  }
  return [...map.entries()].map(([label, rowList]) => ({ label, rows: rowList }));
}

/**
 * CHR-V3-07 refreshed project browser.
 *
 * Width: `var(--rail-width-expanded, 240px)` / `var(--rail-width-collapsed, 36px)`.
 * Groups: Views · Schedules · Links / Imports · Phases.
 * Features: real-time search, right-click context menu, HTML5 drag-to-reorder.
 */
export function ProjectBrowserV3({
  elements,
  activeViewId,
  onActivateView,
  onRenameView,
  onDeleteView,
  onDuplicateView,
  collapsed = false,
}: ProjectBrowserProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Local order state for drag-reorder (maps viewId → order index override).
  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});
  const dragSrc = useRef<string | null>(null);

  // Derive groups from elements.
  const { viewRows, scheduleRows, linkRows, phaseRows } = useMemo(() => {
    const lower = search.toLowerCase();
    const matches = (name: string) => !lower || name.toLowerCase().includes(lower);

    const views = elements.filter(
      (e): e is Extract<Element, { kind: 'viewpoint' | 'saved_view' }> =>
        (e.kind === 'viewpoint' || e.kind === 'saved_view') &&
        matches((e as { name?: string }).name ?? e.id),
    );

    const schedules = elements.filter(
      (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule' && matches(e.name),
    );

    const links = elements.filter(
      (e) =>
        (e.kind === 'image_underlay' || e.kind === 'link_model') &&
        matches((e as { name?: string }).name ?? e.id),
    );

    const phases = elements.filter(
      (e): e is Extract<Element, { kind: 'phase' }> =>
        e.kind === 'phase' && matches((e as { name?: string }).name ?? e.id),
    );

    // Apply local drag order overrides then sort.
    const sortedViews = [...views].sort((a, b) => {
      const oa = localOrder[a.id] ?? 0;
      const ob = localOrder[b.id] ?? 0;
      if (oa !== ob) return oa - ob;
      return ((a as { name?: string }).name ?? a.id).localeCompare(
        (b as { name?: string }).name ?? b.id,
      );
    });

    return {
      viewRows: sortedViews,
      scheduleRows: schedules,
      linkRows: links,
      phaseRows: phases,
    };
  }, [elements, search, localOrder]);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const handleRowRightClick = (viewId: string, x: number, y: number) => {
    setCtxMenu({ viewId, x, y });
  };

  const startRename = (viewId: string, currentName: string) => {
    setRenameId(viewId);
    setRenameValue(currentName);
    setCtxMenu(null);
  };

  const commitRename = (viewId: string) => {
    if (renameValue.trim()) onRenameView(viewId, renameValue.trim());
    setRenameId(null);
  };

  // HTML5 drag-to-reorder helpers.
  const onDragStart = (viewId: string) => {
    dragSrc.current = viewId;
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const onDrop = (targetId: string) => {
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) return;
    const ids = viewRows.map((v) => v.id);
    const srcIdx = ids.indexOf(srcId);
    const tgtIdx = ids.indexOf(targetId);
    const reordered = [...ids];
    reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, srcId);
    const next: Record<string, number> = {};
    reordered.forEach((id, i) => {
      next[id] = i;
    });
    setLocalOrder(next);
    dragSrc.current = null;
  };

  const railStyle: React.CSSProperties = {
    width: collapsed ? 'var(--rail-width-collapsed, 36px)' : 'var(--rail-width-expanded, 240px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  if (collapsed) {
    return <div style={railStyle} data-collapsed="true" aria-label="Project browser (collapsed)" />;
  }

  const viewGroups = groupByDiscipline(viewRows);

  return (
    <div style={railStyle} aria-label="Project browser">
      {/* Search */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <input
          type="search"
          placeholder="Search project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search project browser"
          style={{
            width: '100%',
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-sm, 12.5px)',
            padding: 'var(--space-1) var(--space-2)',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-1) 0' }} onClick={closeCtx}>
        {/* Views group */}
        {viewRows.length > 0 ? (
          <PbGroup label="Views">
            {viewGroups.map((grp) => (
              <div key={grp.label ?? '__all__'}>
                {grp.label ? (
                  <div
                    style={{
                      paddingLeft: 'var(--space-3)',
                      paddingTop: 'var(--space-1)',
                      fontSize: 'var(--text-sm, 12.5px)',
                      color: 'var(--color-muted-foreground)',
                      fontWeight: 600,
                      letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
                      textTransform: 'uppercase',
                    }}
                    data-discipline-group={grp.label}
                  >
                    {grp.label}
                  </div>
                ) : null}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {grp.rows.map((view) => {
                    const name = (view as { name?: string }).name ?? view.id;
                    const isActive = view.id === activeViewId;
                    return (
                      <li
                        key={view.id}
                        draggable
                        onDragStart={() => onDragStart(view.id)}
                        onDragOver={onDragOver}
                        onDrop={() => onDrop(view.id)}
                        data-testid={`pb-view-row-${view.id}`}
                      >
                        {renameId === view.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(view.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(view.id);
                              if (e.key === 'Escape') setRenameId(null);
                            }}
                            style={{
                              width: '100%',
                              padding: 'var(--space-0-5) var(--space-2)',
                              fontSize: 'var(--text-sm, 12.5px)',
                              background: 'var(--color-background)',
                              color: 'var(--color-foreground)',
                              border: '1px solid var(--color-accent)',
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            data-active={isActive ? 'true' : 'false'}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: 'var(--space-0-5) var(--space-3)',
                              fontSize: 'var(--text-sm, 12.5px)',
                              color: 'var(--color-foreground)',
                              background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() => onActivateView(view.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRowRightClick(view.id, e.clientX, e.clientY);
                            }}
                          >
                            {name}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </PbGroup>
        ) : null}

        {/* Schedules group */}
        {scheduleRows.length > 0 ? (
          <PbGroup label="Schedules">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {scheduleRows.map((s) => (
                <li key={s.id} data-testid={`pb-schedule-row-${s.id}`}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-0-5) var(--space-3)',
                      fontSize: 'var(--text-sm, 12.5px)',
                      color: 'var(--color-foreground)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => onActivateView(s.id)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </PbGroup>
        ) : null}

        {/* Links / Imports group */}
        {linkRows.length > 0 ? (
          <PbGroup label="Links / Imports">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {linkRows.map((l) => {
                const name = (l as { name?: string }).name ?? l.id;
                return (
                  <li key={l.id} data-testid={`pb-link-row-${l.id}`}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => onActivateView(l.id)}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PbGroup>
        ) : null}

        {/* Phases group */}
        {phaseRows.length > 0 ? (
          <PbGroup label="Phases">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {phaseRows.map((p) => {
                const name = (p as { name?: string }).name ?? p.id;
                return (
                  <li key={p.id} data-testid={`pb-phase-row-${p.id}`}>
                    <div
                      style={{
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {name}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PbGroup>
        ) : null}

        {viewRows.length === 0 &&
        scheduleRows.length === 0 &&
        linkRows.length === 0 &&
        phaseRows.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-3)',
              fontSize: 'var(--text-sm, 12.5px)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            {search ? 'No matches.' : 'No views yet.'}
          </div>
        ) : null}
      </div>

      {/* Right-click context menu */}
      {ctxMenu ? (
        <PbContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={closeCtx}
          onRename={() => {
            const el = elements.find((e) => e.id === ctxMenu.viewId);
            startRename(ctxMenu.viewId, (el as { name?: string })?.name ?? '');
          }}
          onDuplicate={() => {
            onDuplicateView(ctxMenu.viewId);
            closeCtx();
          }}
          onDelete={() => {
            onDeleteView(ctxMenu.viewId);
            closeCtx();
          }}
        />
      ) : null}
    </div>
  );
}

function PbGroup({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 'var(--space-2)' }} data-pb-group={label}>
      <div
        style={{
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-muted-foreground)',
          letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
          textTransform: 'uppercase',
        }}
        data-testid={`pb-group-${label}`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ProjectBrowserFamiliesGroup({
  wallTypes,
  floorTypes,
  roofTypes,
  onSelect,
}: {
  wallTypes: Extract<Element, { kind: 'wall_type' }>[];
  floorTypes: Extract<Element, { kind: 'floor_type' }>[];
  roofTypes: Extract<Element, { kind: 'roof_type' }>[];
  onSelect: (id: string) => void;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  const groups: Array<{ label: string; kind: string; items: Array<{ id: string; name: string }> }> =
    [
      { label: 'Walls', kind: 'wall_type', items: wallTypes },
      { label: 'Floors', kind: 'floor_type', items: floorTypes },
      { label: 'Roofs', kind: 'roof_type', items: roofTypes },
    ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-1" data-testid="project-browser-families-group">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        data-testid="project-browser-families-toggle"
        className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        Families
      </button>
      {!collapsed ? (
        <div className="space-y-1 pl-1">
          {groups.map((grp) => (
            <div key={grp.kind} className="space-y-0">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted pl-1">
                {grp.label} ({grp.items.length})
              </div>
              <ul className="space-y-0">
                {grp.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-0.5 text-left text-[10px] hover:bg-surface-strong"
                      onClick={() => onSelect(item.id)}
                      title={`${grp.kind} · ${item.id}`}
                      data-testid={`pb-family-type-${item.id}`}
                    >
                      <span className="text-muted">{grp.kind.replace('_', ' ')} ·</span> {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PbContextMenu({
  x,
  y,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="pb-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        minWidth: 140,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm, 4px)',
        boxShadow: 'var(--shadow-modal, 0 4px 16px rgba(0,0,0,0.24))',
        padding: 'var(--space-1) 0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-testid="pb-ctx-rename"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename
      </button>
      <button
        type="button"
        data-testid="pb-ctx-duplicate"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onDuplicate}
      >
        Duplicate
      </button>
      <button
        type="button"
        data-testid="pb-ctx-delete"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
