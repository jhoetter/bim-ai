import type { Element } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { useBimStore } from '../state/store';

function newDupPlanViewId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

function planViewTooltip(pv: Extract<Element, { kind: 'plan_view' }>): string {
  const parts = [`plan_view (${pv.name})`];
  parts.push(`discipline: ${pv.discipline ?? 'architecture'}`);
  if (pv.viewTemplateId) parts.push(`template: ${pv.viewTemplateId}`);
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

  const planViews = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view')
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const hasAnyDoc =
    planViews.length > 0 ||
    viewpoints3d.length > 0 ||
    viewpointsPlan.length > 0 ||
    sectionCuts.length > 0 ||
    schedules.length > 0 ||
    sheets.length > 0;

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
      {planViews.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Floor plans</div>
          <ul className="space-y-0.5">
            {planViews.map((pv) => (
              <li key={pv.id} className="flex flex-col gap-0.5">
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  title={planViewTooltip(pv)}
                  onClick={() => activatePlanView(pv.id)}
                >
                  plan_view · {pv.name}
                </Btn>
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
          <ul className="space-y-0.5">
            {viewpoints3d.map((vp) => (
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
