import { useEffect, useState } from 'react';

import type { Element } from '@bim-ai/core';

import {
  viewpointOrbit3dCutawayStyleLabel,
  viewpointOrbit3dHiddenKindsReadout,
  type OrbitViewCutawayStyleToken,
} from './plan/planProjection';

export type OrbitViewpointPersistFieldPayload = {
  elementId: string;
  key: string;
  value: string;
};

export type OrbitViewpointPersistedHudProps = {
  activeViewpointId?: string;
  /** Resolved persisted orbit_3d viewpoint from `elementsById`, or null when none / wrong kind. */
  viewpoint: Extract<Element, { kind: 'viewpoint' }> | null;
  /** When set, orbit HUD fields commit via `updateElementProperty` through this callback. */
  onPersistField?: (payload: OrbitViewpointPersistFieldPayload) => void | Promise<void>;
};

function fmtMm(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(n);
}

function fmtOnOff(v: boolean | null | undefined): string {
  if (v == null) return 'inherit';
  return v ? 'on' : 'off';
}

function fmtExposureEv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'inherit';
  const fixed = v.toFixed(2).replace(/\.?0+$/, '');
  return v > 0 ? `+${fixed}` : fixed;
}

function isPersistedCutawayStyle(v: unknown): v is OrbitViewCutawayStyleToken {
  return v === 'none' || v === 'cap' || v === 'floor' || v === 'box';
}

function hiddenKindsToCsv(vp: Extract<Element, { kind: 'viewpoint' }>): string {
  const kinds = vp.hiddenSemanticKinds3d;
  if (kinds == null || kinds.length === 0) return '';
  return kinds.join(', ');
}

/**
 * HUD for persisted saved 3D viewpoint clip / cutaway metadata. Read-only when `onPersistField`
 * is omitted; otherwise edits round-trip through `updateElementProperty`.
 */
export function OrbitViewpointPersistedHud(props: OrbitViewpointPersistedHudProps) {
  const { activeViewpointId, viewpoint, onPersistField } = props;

  const [capDraft, setCapDraft] = useState('');
  const [floorDraft, setFloorDraft] = useState('');
  const [exposureDraft, setExposureDraft] = useState('');
  const [hiddenCsv, setHiddenCsv] = useState('');
  const [cutSelect, setCutSelect] = useState('');

  useEffect(() => {
    if (!viewpoint || viewpoint.mode !== 'orbit_3d') return;
    const cap = viewpoint.viewerClipCapElevMm;
    setCapDraft(cap != null && Number.isFinite(cap) ? String(cap) : '');
    const fl = viewpoint.viewerClipFloorElevMm;
    setFloorDraft(fl != null && Number.isFinite(fl) ? String(fl) : '');
    const ev = viewpoint.viewerPhotographicExposureEv;
    setExposureDraft(ev != null && Number.isFinite(ev) ? String(ev) : '');
    setHiddenCsv(hiddenKindsToCsv(viewpoint));
    setCutSelect(isPersistedCutawayStyle(viewpoint.cutawayStyle) ? viewpoint.cutawayStyle : '');
  }, [viewpoint]);

  const readOnlyUi = !onPersistField;

  if (!activeViewpointId) {
    return (
      <div
        data-testid="orbit-viewpoint-persisted-hud"
        className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[min(340px,calc(100%-24px))] rounded-lg border border-border bg-surface/80 px-3 py-2 text-[10px] text-muted backdrop-blur"
      >
        <div className="font-semibold text-foreground/90">Saved 3D viewpoint</div>
        <p className="mt-1 leading-snug">
          Select a saved orbit viewpoint in Project browser to inspect persisted clip and
          hidden-category state.
        </p>
      </div>
    );
  }

  if (!viewpoint || viewpoint.mode !== 'orbit_3d') {
    return (
      <div
        data-testid="orbit-viewpoint-persisted-hud"
        className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[min(340px,calc(100%-24px))] rounded-lg border border-border bg-surface/80 px-3 py-2 text-[10px] text-muted backdrop-blur"
      >
        <div className="font-semibold text-foreground/90">Saved 3D viewpoint</div>
        <p className="mt-1 leading-snug">
          Active id <span className="font-mono text-foreground/80">{activeViewpointId}</span> is not
          a saved orbit 3D viewpoint in the current model.
        </p>
      </div>
    );
  }

  const styleLabel = viewpointOrbit3dCutawayStyleLabel(viewpoint);
  const hiddenReadout = viewpointOrbit3dHiddenKindsReadout(viewpoint);
  const cardPe = readOnlyUi ? 'pointer-events-none' : 'pointer-events-auto';

  const commitCap = () => {
    if (!onPersistField) return;
    const trimmed = capDraft.trim();
    const value = trimmed === '' ? '' : trimmed;
    if (value !== '' && !Number.isFinite(Number(value))) return;
    void onPersistField({ elementId: viewpoint.id, key: 'viewerClipCapElevMm', value });
  };

  const commitFloor = () => {
    if (!onPersistField) return;
    const trimmed = floorDraft.trim();
    const value = trimmed === '' ? '' : trimmed;
    if (value !== '' && !Number.isFinite(Number(value))) return;
    void onPersistField({ elementId: viewpoint.id, key: 'viewerClipFloorElevMm', value });
  };

  const commitHidden = () => {
    if (!onPersistField) return;
    const kinds = hiddenCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    void onPersistField({
      elementId: viewpoint.id,
      key: 'hiddenSemanticKinds3d',
      value: JSON.stringify(kinds),
    });
  };

  const commitCutawayStyle = (next: string) => {
    setCutSelect(next);
    if (!onPersistField) return;
    void onPersistField({ elementId: viewpoint.id, key: 'cutawayStyle', value: next });
  };

  const commitGdoBoolean = (
    key: 'viewerShadowsEnabled' | 'viewerAmbientOcclusionEnabled' | 'viewerDepthCueEnabled',
    value: boolean,
  ) => {
    if (!onPersistField) return;
    void onPersistField({ elementId: viewpoint.id, key, value: String(value) });
  };

  const commitSilhouetteEdgeWidth = (value: string) => {
    if (!onPersistField) return;
    void onPersistField({ elementId: viewpoint.id, key: 'viewerSilhouetteEdgeWidth', value });
  };

  const commitPhotographicExposureEv = () => {
    if (!onPersistField) return;
    const trimmed = exposureDraft.trim();
    const value = trimmed === '' ? '' : trimmed;
    if (value !== '' && !Number.isFinite(Number(value))) return;
    void onPersistField({ elementId: viewpoint.id, key: 'viewerPhotographicExposureEv', value });
  };

  return (
    <div
      data-testid="orbit-viewpoint-persisted-hud"
      className={`absolute bottom-3 right-3 z-10 max-w-[min(300px,calc(100%-24px))] rounded-md border border-border bg-surface/85 px-2.5 py-2 text-[10px] text-muted shadow-elev-1 backdrop-blur ${cardPe}`}
    >
      <div className="font-semibold text-foreground/90">Saved 3D view</div>
      <div className="mt-0.5 truncate font-mono text-[9px] text-foreground/80">
        {viewpoint.name}
        <span className="text-muted"> · </span>
        <span>{viewpoint.id}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[9px]">
        <span>cap {fmtMm(viewpoint.viewerClipCapElevMm)}</span>
        <span>floor {fmtMm(viewpoint.viewerClipFloorElevMm)}</span>
        <span className="col-span-2 truncate font-sans text-[10px] text-foreground/90">
          {styleLabel} · {hiddenReadout}
        </span>
        <span className="col-span-2 truncate font-sans text-[10px] text-foreground/90">
          shadows {fmtOnOff(viewpoint.viewerShadowsEnabled)} · AO{' '}
          {fmtOnOff(viewpoint.viewerAmbientOcclusionEnabled)} · depth{' '}
          {fmtOnOff(viewpoint.viewerDepthCueEnabled)} · edge{' '}
          {viewpoint.viewerSilhouetteEdgeWidth ?? 'inherit'} · EV{' '}
          {fmtExposureEv(viewpoint.viewerPhotographicExposureEv)}
        </span>
      </div>

      {readOnlyUi ? (
        <dl className="sr-only">
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Cap (mm)</dt>
            <dd className="min-w-0 font-mono text-foreground/90">
              {fmtMm(viewpoint.viewerClipCapElevMm)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Floor (mm)</dt>
            <dd className="min-w-0 font-mono text-foreground/90">
              {fmtMm(viewpoint.viewerClipFloorElevMm)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Cutaway</dt>
            <dd className="min-w-0 text-foreground/90">{styleLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Hidden</dt>
            <dd className="min-w-0 break-words text-foreground/90">{hiddenReadout}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Graphics</dt>
            <dd className="min-w-0 break-words text-foreground/90">
              Shadows {fmtOnOff(viewpoint.viewerShadowsEnabled)}, AO{' '}
              {fmtOnOff(viewpoint.viewerAmbientOcclusionEnabled)}, depth{' '}
              {fmtOnOff(viewpoint.viewerDepthCueEnabled)}, edge{' '}
              {viewpoint.viewerSilhouetteEdgeWidth ?? 'inherit'}, EV{' '}
              {fmtExposureEv(viewpoint.viewerPhotographicExposureEv)}
            </dd>
          </div>
        </dl>
      ) : (
        <details className="mt-1.5 leading-snug">
          <summary className="cursor-pointer text-[10px] font-medium text-accent">
            Edit saved view
          </summary>
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-muted">Cap (mm)</span>
              <input
                data-testid="orbit-vp-cap-mm"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                inputMode="numeric"
                placeholder="empty = off"
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                onBlur={commitCap}
              />
            </label>
            <label className="block">
              <span className="text-muted">Floor (mm)</span>
              <input
                data-testid="orbit-vp-floor-mm"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                inputMode="numeric"
                placeholder="empty = off"
                value={floorDraft}
                onChange={(e) => setFloorDraft(e.target.value)}
                onBlur={commitFloor}
              />
            </label>
            <label className="block">
              <span className="text-muted">Cutaway style</span>
              <select
                data-testid="orbit-vp-cutaway-select"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                value={cutSelect}
                onChange={(e) => commitCutawayStyle(e.target.value)}
              >
                <option value="">Inherit from clip elevations</option>
                <option value="none">Explicit: none</option>
                <option value="cap">Explicit: cap only</option>
                <option value="floor">Explicit: floor only</option>
                <option value="box">Explicit: box</option>
              </select>
            </label>
            <label className="block">
              <span className="text-muted">Hidden kinds (comma-separated)</span>
              <input
                data-testid="orbit-vp-hidden-kinds"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                placeholder="e.g. roof, stair"
                value={hiddenCsv}
                onChange={(e) => setHiddenCsv(e.target.value)}
                onBlur={commitHidden}
              />
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                data-testid="orbit-vp-shadows-toggle"
                className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground"
                onClick={() =>
                  commitGdoBoolean('viewerShadowsEnabled', !viewpoint.viewerShadowsEnabled)
                }
              >
                Shadows {fmtOnOff(viewpoint.viewerShadowsEnabled)}
              </button>
              <button
                type="button"
                data-testid="orbit-vp-ao-toggle"
                className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground"
                onClick={() =>
                  commitGdoBoolean(
                    'viewerAmbientOcclusionEnabled',
                    !viewpoint.viewerAmbientOcclusionEnabled,
                  )
                }
              >
                AO {fmtOnOff(viewpoint.viewerAmbientOcclusionEnabled)}
              </button>
              <button
                type="button"
                data-testid="orbit-vp-depth-toggle"
                className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground"
                onClick={() =>
                  commitGdoBoolean('viewerDepthCueEnabled', !viewpoint.viewerDepthCueEnabled)
                }
              >
                Depth {fmtOnOff(viewpoint.viewerDepthCueEnabled)}
              </button>
              <select
                data-testid="orbit-vp-edge-width"
                className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground"
                value={viewpoint.viewerSilhouetteEdgeWidth ?? ''}
                onChange={(e) => commitSilhouetteEdgeWidth(e.target.value)}
              >
                <option value="">Edge inherit</option>
                <option value="1">Edge 1px</option>
                <option value="2">Edge 2px</option>
                <option value="3">Edge 3px</option>
                <option value="4">Edge 4px</option>
              </select>
            </div>
            <label className="block">
              <span className="text-muted">
                Exposure EV ({fmtExposureEv(viewpoint.viewerPhotographicExposureEv)})
              </span>
              <input
                data-testid="orbit-vp-exposure-ev"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                inputMode="decimal"
                placeholder="empty = inherit"
                value={exposureDraft}
                onChange={(e) => setExposureDraft(e.target.value)}
                onBlur={commitPhotographicExposureEv}
              />
            </label>
          </div>
        </details>
      )}

      <p className="mt-1.5 border-t border-border pt-1.5 text-[9px] leading-snug text-muted/90">
        {readOnlyUi
          ? 'Values are from the saved viewpoint element in the document, not live camera orbit.'
          : 'Edits save on blur (numbers / hidden kinds) or immediately for cutaway style.'}
      </p>
    </div>
  );
}
