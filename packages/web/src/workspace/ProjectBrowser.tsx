/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { Element, ViewTemplate } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { applyCommand } from '../lib/api';
import { useViewTemplateStore } from '../collab/viewTemplateStore';
import { PropagationToast } from './PropagationToast';
import { ViewTemplateEditPanel } from './ViewTemplateEditPanel';

import {
  planViewBrowserHierarchyState,
  planViewProjectBrowserEvidenceLine,
  viewpointOrbit3dEvidenceLine,
} from '../plan/planProjection';
import { NewSheetDialog } from '../plan/NewSheetDialog';
import {
  planLevelEvidenceToken,
  scheduleProjectBrowserEvidenceLine,
  sectionCutBrowserTooltipTitle,
  sectionCutProjectBrowserEvidenceLine,
  sheetProjectBrowserEvidenceLine,
  siteProjectBrowserEvidenceLine,
} from './projectBrowserEvidence';
import { useBimStore } from '../state/store';

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
  const [editingTemplate, setEditingTemplate] = useState<Extract<
    Element,
    { kind: 'view_template' }
  > | null>(null);

  const { planViewsSorted, planViewBuckets, bucketKeys } = useMemo(() => {
    const sorted = Object.values(props.elementsById)
      .filter((e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view')
      .sort((a, b) => a.name.localeCompare(b.name));
    const buckets = new Map<string, Extract<Element, { kind: 'plan_view' }>[]>();
    for (const pv of sorted) {
      const k = pv.viewTemplateId ?? 'none';
      const arr = buckets.get(k) ?? [];
      arr.push(pv);
      buckets.set(k, arr);
    }
    const keys = [...buckets.keys()].sort();
    return { planViewsSorted: sorted, planViewBuckets: buckets, bucketKeys: keys };
  }, [props.elementsById]);

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
      {planViewsSorted.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Floor plans</div>
          <div className="space-y-0.5">
            {bucketKeys.map((tid) => (
              <div key={tid} className="space-y-0.5">
                {showPlanTemplateBuckets ? (
                  <div className="pl-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    {templateBucketLabel(tid)}
                  </div>
                ) : null}
                <ul className="space-y-0.5">
                  {(planViewBuckets.get(tid) ?? []).map((pv) => (
                    <li key={pv.id} className="flex flex-col gap-0.5">
                      <Btn
                        type="button"
                        variant="quiet"
                        className="w-full px-2 py-0.5 text-left text-[10px]"
                        title={planViewTooltip(pv, props.elementsById)}
                        onClick={() => activatePlanView(pv.id)}
                      >
                        plan_view · {pv.name}
                      </Btn>
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
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {viewTemplates.length ? (
        <div className="space-y-1">
          <button
            type="button"
            className="flex w-full items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
            onClick={() => setVtCollapsed((v) => !v)}
          >
            <span>{vtCollapsed ? '▸' : '▾'}</span>
            View Templates ({viewTemplates.length})
          </button>
          {!vtCollapsed && (
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
                        <ul className="absolute right-0 z-50 min-w-[140px] rounded border bg-[var(--color-surface-1)] py-1 shadow-md">
                          {planViews.map((pv) => (
                            <li key={pv.id}>
                              <button
                                type="button"
                                className="w-full px-3 py-1 text-left text-[10px] hover:bg-[var(--color-surface-2)]"
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
                        title="Edit template"
                        onClick={() => setEditingTemplate(vt)}
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
      ) : null}

      {editingTemplate && modelId && (
        <ViewTemplateEditPanel
          template={editingTemplate}
          elementsById={props.elementsById}
          modelId={modelId}
          onSave={(patch) => vtStore.updateTemplate(modelId, editingTemplate.id, patch)}
          onClose={() => setEditingTemplate(null)}
        />
      )}

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
                <button
                  type="button"
                  className="w-full px-2 py-0.5 text-left text-[10px] underline decoration-muted underline-offset-2"
                  title={sectionCutBrowserTooltipTitle(props.elementsById, sc)}
                  onClick={() => useBimStore.getState().select(sc.id)}
                >
                  <span className="text-muted">section_cut ·</span> {sc.name}
                </button>
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

      {elevationViews.length ? (
        <div className="space-y-1" data-bim-elevations-group="1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Elevations</div>
          <ul className="space-y-0.5">
            {elevationViews.map((ev) => (
              <li key={ev.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="w-full px-2 py-0.5 text-left text-[10px] underline decoration-muted underline-offset-2"
                  onClick={() => useBimStore.getState().select(ev.id)}
                >
                  <span className="text-muted">elevation_view ·</span> {ev.name}
                </button>
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
                      background: '#facc15',
                      color: '#1f2937',
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
