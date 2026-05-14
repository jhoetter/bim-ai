import type { ComponentType, JSX } from 'react';

import type { Element } from '@bim-ai/core';
import type { BimIconHifiProps } from '@bim-ai/icons';

import { ToolPalette } from '../tools/ToolPalette';
import type { ToolDisabledContext, ToolId } from '../tools/toolRegistry';
import type { WorkspaceMode } from './shell';
import type { TabKind } from './tabsModel';

export function FloatingPalette({
  mode,
  activeTool,
  onToolSelect,
  disabledContext,
  allowedToolIds,
}: {
  mode: WorkspaceMode;
  activeTool: ToolId;
  onToolSelect: (id: ToolId) => void;
  disabledContext: ToolDisabledContext;
  /** When provided, only these tool ids are shown in the palette. */
  allowedToolIds?: ReadonlySet<ToolId>;
}): JSX.Element | null {
  if (mode === 'sheet' || mode === 'schedule') return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <ToolPalette
        mode={mode}
        activeTool={activeTool}
        onToolSelect={onToolSelect}
        disabledContext={disabledContext}
        allowedToolIds={allowedToolIds}
      />
    </div>
  );
}

export function EmptyStateOverlay({
  headline,
  hint,
  ctaLabel,
  ctaPending,
  ctaError,
  onCta,
  Icon,
}: {
  headline: string;
  hint: string;
  ctaLabel: string | null;
  ctaPending: boolean;
  ctaError: string | null;
  onCta: () => void;
  Icon?: ComponentType<BimIconHifiProps>;
}): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-lg bg-surface/95 px-6 py-5 text-center shadow-elev-2 backdrop-blur">
        {Icon ? <Icon size={42} aria-hidden="true" className="text-accent" /> : null}
        <div className="text-md font-medium text-foreground">{headline}</div>
        <div className="text-sm text-muted">{hint}</div>
        {ctaLabel ? (
          <button
            type="button"
            onClick={onCta}
            disabled={ctaPending}
            aria-busy={ctaPending}
            data-testid="canvas-empty-cta"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground shadow-elev-1 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ctaPending ? 'Loading…' : ctaLabel}
          </button>
        ) : null}
        {ctaError ? (
          <div role="alert" className="text-xs text-danger" data-testid="canvas-empty-error">
            {ctaError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InspectorEmptyTab({ message }: { message: string }): JSX.Element {
  return <p className="text-sm text-muted">{message}</p>;
}

export function humanKindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultTabFallbackForKind(
  kind: WorkspaceMode | TabKind,
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
): { targetId?: string; label: string } | null {
  const all = Object.values(elementsById) as Element[];
  if (kind === 'plan') {
    const levels = all
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const lvl = levels.find((l) => l.id === activeLevelId) ?? levels[0];
    if (!lvl) return { label: 'Plan' };
    return {
      targetId: lvl.id,
      label: `Plan · ${lvl.name}`,
    };
  }
  if (kind === '3d') {
    const vp = all.find(
      (e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint',
    );
    if (vp) return { targetId: vp.id, label: `3D · ${vp.name}` };
    return { label: '3D · Default' };
  }
  if (kind === 'section') {
    const sec = all.find(
      (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
    );
    if (sec) return { targetId: sec.id, label: `Section · ${sec.name}` };
    return { label: 'Section' };
  }
  if (kind === 'sheet') {
    const sht = all.find((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet');
    if (sht) return { targetId: sht.id, label: `Sheet · ${sht.name}` };
    return { label: 'Sheet' };
  }
  if (kind === 'schedule') {
    const s = all.find((e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule');
    if (s) return { targetId: s.id, label: `Schedule · ${s.name}` };
    return { label: 'Schedule' };
  }
  return null;
}

export function resolvePlanTabTarget(
  elementsById: Record<string, Element>,
  targetId: string | undefined,
  fallbackLevelId: string | undefined,
): { activeLevelId: string; activePlanViewId?: string } {
  if (targetId) {
    const target = elementsById[targetId];
    if (target?.kind === 'plan_view') {
      return { activeLevelId: target.levelId, activePlanViewId: target.id };
    }
    if (target?.kind === 'level') {
      return { activeLevelId: target.id };
    }
  }
  return { activeLevelId: fallbackLevelId ?? '' };
}
