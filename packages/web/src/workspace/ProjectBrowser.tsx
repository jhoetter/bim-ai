import { useMemo } from 'react';
import type { Element } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import {
  planViewProjectBrowserEvidenceLine,
  viewpointOrbit3dEvidenceLine,
} from '../plan/planProjection';
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
  parts.push(`discipline: ${pv.discipline ?? 'architecture'}`);
  const tid = pv.viewTemplateId;
  if (tid) {
    const t = elementsById[tid];
    parts.push(t?.kind === 'view_template' ? `template: ${t.name}` : `templateRef: ${tid}`);
  }
  parts.push(planViewProjectBrowserEvidenceLine(elementsById, pv.id));
  return parts.join(' · ');
}

function siteProjectBrowserEvidenceLine(
  elementsById: Record<string, Element>,
  site: Extract<Element, { kind: 'site' }>,
): string {
  const n = site.boundaryMm?.length ?? 0;
  const ctxCount = site.contextObjects?.length ?? 0;
  const lid = site.referenceLevelId;
  const l = elementsById[lid];
  const lvl = l?.kind === 'level' ? l.name : lid;
  return `boundaryVerts=${n} · context=${ctxCount} · refLevel=${lvl}`;
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

  const hasAnyDoc =
    planViewsSorted.length > 0 ||
    viewpoints3d.length > 0 ||
    viewpointsPlan.length > 0 ||
    sectionCuts.length > 0 ||
    schedules.length > 0 ||
    sheets.length > 0 ||
    viewTemplates.length > 0 ||
    sites.length > 0;

  if (!hasAnyDoc) {
    return <div className="text-[10px] text-muted">No documented views yet.</div>;
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
                        {planViewProjectBrowserEvidenceLine(props.elementsById, pv.id)}
                      </div>
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
          <div className="text-[10px] uppercase tracking-wide text-muted">View templates</div>
          <ul className="space-y-0.5">
            {viewTemplates.map((vt) => (
              <li key={vt.id}>
                <button
                  type="button"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title={`view_template · ${vt.name} · ${viewTemplateEvidenceLine(props.elementsById, vt)}`}
                  onClick={() => useBimStore.getState().select(vt.id)}
                >
                  <span className="text-muted">view_template ·</span> {vt.name}
                </button>
                <div className="pl-2 font-mono text-[9px] leading-tight text-muted">
                  {viewTemplateEvidenceLine(props.elementsById, vt)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sectionCuts.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Section cuts</div>
          <ul className="space-y-0.5">
            {sectionCuts.map((sc) => (
              <li key={sc.id}>
                <button
                  type="button"
                  className="w-full px-2 py-0.5 text-left font-mono text-[10px] text-muted underline"
                  title="Inspect in explorer"
                  onClick={() => useBimStore.getState().select(sc.id)}
                >
                  section_cut · {sc.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewpoints3d.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">3D saved views</div>
          <p className="pl-0.5 text-[9px] leading-snug text-muted">
            Each row summarizes persisted clip/cutaway on the saved <span className="font-mono">viewpoint</span>{' '}
            element—activate to mirror in 3D and read the viewport HUD.
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

      {schedules.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Schedules (refs)</div>
          <ul className="font-mono text-[10px] text-muted">
            {schedules.map((s) => (
              <li key={s.id}>
                · {s.name}{' '}
                <button
                  type="button"
                  className="underline"
                  title="Inspect in explorer"
                  onClick={() => useBimStore.getState().select(s.id)}
                >
                  [{s.id}]
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sheets.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Sheets</div>
          <ul className="font-mono text-[10px] text-muted">
            {sheets.map((s) => (
              <li key={s.id}>
                sheet ·{' '}
                <button
                  type="button"
                  className="underline"
                  title="Inspect in explorer"
                  onClick={() => useBimStore.getState().select(s.id)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
