import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';
import type { PlanTool } from '../state/store';
import { ComponentPlacementPreviewGlyph } from './planCanvasHelpers';

type MmPoint = { xMm: number; yMm: number };
type ScreenPoint = { pxX: number; pxY: number };
type WorldToScreen = (xy: MmPoint) => ScreenPoint;

function elementPinAnchorMm(el: Element): MmPoint | null {
  const candidate = el as {
    levelId?: string;
    pinned?: boolean;
    start?: MmPoint;
    end?: MmPoint;
    insertionPoint?: MmPoint;
    xMm?: number;
    yMm?: number;
  };
  if (!candidate.pinned) return null;
  if (candidate.insertionPoint) return candidate.insertionPoint;
  if (candidate.start && candidate.end) {
    return {
      xMm: (candidate.start.xMm + candidate.end.xMm) / 2,
      yMm: (candidate.start.yMm + candidate.end.yMm) / 2,
    };
  }
  if (typeof candidate.xMm === 'number' && typeof candidate.yMm === 'number') {
    return { xMm: candidate.xMm, yMm: candidate.yMm };
  }
  return null;
}

function PinGlyphLayer({
  elementsById,
  activeLevelId,
  worldToScreen,
}: {
  elementsById: Record<string, Element>;
  activeLevelId?: string | null;
  worldToScreen: WorldToScreen;
}): JSX.Element | null {
  const pinned = Object.values(elementsById)
    .filter((el) => !activeLevelId || (el as { levelId?: string }).levelId === activeLevelId)
    .map((el) => {
      const anchor = elementPinAnchorMm(el);
      return anchor ? { id: el.id, ...anchor } : null;
    })
    .filter((row): row is { id: string; xMm: number; yMm: number } => Boolean(row));

  if (pinned.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 18 }}
      data-testid="pin-glyph-layer"
    >
      {pinned.map(({ id, xMm, yMm }) => {
        const { pxX, pxY } = worldToScreen({ xMm, yMm });
        return (
          <span
            key={id}
            title="Pinned"
            style={{
              position: 'absolute',
              left: pxX + 4,
              top: pxY - 16,
              fontSize: 10,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            📌
          </span>
        );
      })}
    </div>
  );
}

function LoopModeCursorChip({
  planTool,
  loopMode,
  hudMm,
  worldToScreen,
}: {
  planTool: PlanTool;
  loopMode: boolean;
  hudMm?: MmPoint | null;
  worldToScreen: WorldToScreen;
}): JSX.Element | null {
  if (!loopMode || (planTool !== 'wall' && planTool !== 'beam') || !hudMm) return null;
  const pos = worldToScreen(hudMm);
  return (
    <div
      data-testid="loop-mode-cursor-chip"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: pos.pxX + 14,
        top: pos.pxY - 20,
        pointerEvents: 'none',
        zIndex: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 5px',
        height: 18,
        borderRadius: 3,
        fontSize: 'var(--text-2xs, 10px)',
        lineHeight: 'var(--text-2xs-line, 14px)',
        background: 'var(--color-surface-2, var(--color-surface-strong))',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-accent-foreground, var(--color-foreground))',
        fontFamily: 'var(--font-mono, monospace)',
        fontWeight: 600,
      }}
    >
      LOOP
    </div>
  );
}

function BoundaryValidationBanner({
  message,
  onDismiss,
}: {
  message?: string | null;
  onDismiss: () => void;
}): JSX.Element | null {
  if (!message) return null;
  return (
    <div
      data-testid="boundary-validation-error"
      role="alert"
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        background: '#ef4444',
        color: '#fff',
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 500,
        pointerEvents: 'auto',
        cursor: 'pointer',
        maxWidth: '80%',
      }}
      onClick={onDismiss}
    >
      {message} (click to dismiss)
    </div>
  );
}

function ComponentPlacementPreview({
  screen,
  symbolKind,
}: {
  screen?: ScreenPoint | null;
  symbolKind?: string;
}): JSX.Element | null {
  if (!screen) return null;
  return (
    <div
      data-testid="component-placement-preview-glyph"
      className="pointer-events-none absolute z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
      style={{
        left: screen.pxX,
        top: screen.pxY,
      }}
    >
      <ComponentPlacementPreviewGlyph symbolKind={symbolKind} />
    </div>
  );
}

export function PlanCanvasStatusOverlays({
  elementsById,
  activeLevelId,
  planTool,
  loopMode,
  hudMm,
  worldToScreen,
  boundaryValidationError,
  onDismissBoundaryValidationError,
  componentPreviewScreen,
  componentPreviewSymbolKind,
}: {
  elementsById: Record<string, Element>;
  activeLevelId?: string | null;
  planTool: PlanTool;
  loopMode: boolean;
  hudMm?: MmPoint | null;
  worldToScreen: WorldToScreen;
  boundaryValidationError?: string | null;
  onDismissBoundaryValidationError: () => void;
  componentPreviewScreen?: ScreenPoint | null;
  componentPreviewSymbolKind?: string;
}): JSX.Element {
  return (
    <>
      <PinGlyphLayer
        elementsById={elementsById}
        activeLevelId={activeLevelId}
        worldToScreen={worldToScreen}
      />
      <LoopModeCursorChip
        planTool={planTool}
        loopMode={loopMode}
        hudMm={hudMm}
        worldToScreen={worldToScreen}
      />
      <BoundaryValidationBanner
        message={boundaryValidationError}
        onDismiss={onDismissBoundaryValidationError}
      />
      <ComponentPlacementPreview
        screen={componentPreviewScreen}
        symbolKind={componentPreviewSymbolKind}
      />
    </>
  );
}
