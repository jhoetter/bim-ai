import type { Element } from '@bim-ai/core';

import {
  viewpointOrbit3dCutawayStyleLabel,
  viewpointOrbit3dHiddenKindsReadout,
} from './plan/planProjection';

export type OrbitViewpointPersistedHudProps = {
  activeViewpointId?: string;
  /** Resolved persisted orbit_3d viewpoint from `elementsById`, or null when none / wrong kind. */
  viewpoint: Extract<Element, { kind: 'viewpoint' }> | null;
};

function fmtMm(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(n);
}

/**
 * Read-only HUD for persisted saved 3D viewpoint clip / cutaway metadata (document source of truth).
 */
export function OrbitViewpointPersistedHud(props: OrbitViewpointPersistedHudProps) {
  const { activeViewpointId, viewpoint } = props;

  if (!activeViewpointId) {
    return (
      <div
        data-testid="orbit-viewpoint-persisted-hud"
        className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[min(340px,calc(100%-24px))] rounded-lg border border-border bg-surface/80 px-3 py-2 text-[10px] text-muted backdrop-blur"
      >
        <div className="font-semibold text-foreground/90">Saved 3D viewpoint</div>
        <p className="mt-1 leading-snug">
          Select a saved orbit viewpoint in Project browser to inspect persisted clip and hidden-category
          state.
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
          Active id <span className="font-mono text-foreground/80">{activeViewpointId}</span> is not a
          saved orbit 3D viewpoint in the current model.
        </p>
      </div>
    );
  }

  const styleLabel = viewpointOrbit3dCutawayStyleLabel(viewpoint);
  const hiddenReadout = viewpointOrbit3dHiddenKindsReadout(viewpoint);

  return (
    <div
      data-testid="orbit-viewpoint-persisted-hud"
      className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[min(340px,calc(100%-24px))] rounded-lg border border-border bg-surface/80 px-3 py-2 text-[10px] text-muted backdrop-blur"
    >
      <div className="font-semibold text-foreground/90">Persisted viewpoint (document)</div>
      <div className="mt-0.5 font-mono text-[9px] text-foreground/80">
        {viewpoint.name}
        <span className="text-muted"> · </span>
        <span>{viewpoint.id}</span>
      </div>
      <dl className="mt-2 space-y-1 leading-snug">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Cap (mm)</dt>
          <dd className="min-w-0 font-mono text-foreground/90">{fmtMm(viewpoint.viewerClipCapElevMm)}</dd>
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
      </dl>
      <p className="mt-2 border-t border-border pt-2 text-[9px] leading-snug text-muted/90">
        Values are from the saved viewpoint element in the document, not live camera orbit.
      </p>
    </div>
  );
}
