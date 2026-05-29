import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type RefObject,
} from 'react';

import type { Element, LensMode } from '@bim-ai/core';

import { Viewport } from '../../Viewport';
import { ErrorBoundary } from '../../ErrorBoundary';
import { PlanCanvas, type PlanCameraHandle } from '../../plan/PlanCanvas';
import { ElevationViewport } from '../../plan/ElevationViewport';
import type { PlanTool } from '../../state/store';
import { useBimStore } from '../../state/store';
import type { SnapSettings } from '../../plan/snapSettings';
import type { SheetMarkupShape, SheetReviewMode } from '../sheets/sheetReviewUi';
import { SectionModeShell } from '../ModeShells';
import type { WorkspaceMode } from '../shell';

// FE-CQ-02: Schedule and Sheet mode shells transitively pull in the schedule
// registry, presets, floor-area report, sheet review surface, comments panel,
// and markup canvas — well over 100KB of app code that is not needed until the
// user actually switches into those modes. Wrapping them in React.lazy here
// (with `<Suspense fallback={null}>` at the call sites) lets Vite split each
// shell into its own chunk, dropping the eager workspace bundle below the
// 410 KB-gzip / ~1500 KB-raw ceiling asserted by ui-quality-budgets.
const ScheduleModeShell = lazy(() =>
  import('../ScheduleModeShell').then((m) => ({ default: m.ScheduleModeShell })),
);
const SheetModeShell = lazy(() =>
  import('../SheetModeShell').then((m) => ({ default: m.SheetModeShell })),
);

export const canvasContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

/**
 * Responsive wrapper that fills its container and renders an ElevationViewport
 * at the measured pixel size. §6.1.4.
 */
function ElevationModeShell({
  elevationViewId,
  elementsById,
}: {
  elevationViewId: string | undefined;
  elementsById: Record<string, Element>;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(1, Math.round(width)), h: Math.max(1, Math.round(height)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const view = elevationViewId ? (elementsById[elevationViewId] as Element | undefined) : undefined;

  return (
    <div
      ref={containerRef}
      data-testid="elevation-mode-shell"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--color-canvas-paper)',
      }}
    >
      {view?.kind === 'elevation_view' ? (
        <ElevationViewport
          view={view}
          elementsById={elementsById}
          widthPx={size.w}
          heightPx={size.h}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-muted)',
            fontSize: 12,
          }}
        >
          No elevation view selected
        </div>
      )}
    </div>
  );
}

export function CanvasMount({
  mode,
  viewerMode,
  activeLevelId,
  activePlanViewId,
  activeTabId,
  activeSectionId,
  preferredElevationId,
  elementsById,
  onSemanticCommand,
  cameraHandleRef,
  initialCamera,
  preferredSheetId,
  preferredScheduleId,
  modelId,
  wsOn,
  onPersistViewpointField,
  lensMode,
  activePlanTool,
  onActivePlanToolChange,
  onNavigateToElement,
  snapSettings,
  viewOverlayRightInset,
  sheetReviewMode,
  sheetMarkupShape,
  onOpenSectionSourcePlan,
  onOpenSection3dContext,
}: {
  mode: WorkspaceMode;
  viewerMode: 'plan_canvas' | 'orbit_3d';
  activeLevelId: string;
  activePlanViewId?: string | null;
  /** Used to key same-kind canvases so switching tabs forces a fresh mount. */
  activeTabId?: string;
  activeSectionId?: string;
  /** elevation_view element id to display in elevation mode. §6.1.4 */
  preferredElevationId?: string;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
  cameraHandleRef?: RefObject<PlanCameraHandle | null>;
  initialCamera?: { centerMm?: { xMm: number; yMm: number }; halfMm?: number };
  preferredSheetId?: string;
  preferredScheduleId?: string;
  modelId?: string;
  wsOn?: boolean;
  onPersistViewpointField?: (p: {
    elementId: string;
    key: string;
    value: string;
  }) => void | Promise<void>;
  lensMode?: LensMode;
  activePlanTool?: PlanTool;
  onActivePlanToolChange?: (tool: PlanTool) => void;
  onNavigateToElement?: (elementId: string) => void;
  snapSettings?: SnapSettings;
  viewOverlayRightInset?: string;
  sheetReviewMode?: SheetReviewMode;
  sheetMarkupShape?: SheetMarkupShape;
  onOpenSectionSourcePlan?: () => void;
  onOpenSection3dContext?: () => void;
}): JSX.Element {
  // §1.6.12: split plan/3D view
  const splitViewEnabled = useBimStore((s) => s.splitViewEnabled);

  if (
    splitViewEnabled &&
    (mode === 'plan' || mode === '3d' || mode === null || mode === undefined)
  ) {
    const planCanvasJsx = (
      <PlanCanvas
        wsConnected={wsOn ?? false}
        activeLevelResolvedId={activeLevelId}
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        cameraHandleRef={cameraHandleRef}
        initialCamera={initialCamera}
        lensMode={lensMode}
        activePlanTool={activePlanTool}
        onActivePlanToolChange={onActivePlanToolChange}
        snapSettings={snapSettings}
      />
    );
    const viewportJsx = (
      <ErrorBoundary label="Viewport3D-Split">
        <Viewport
          wsConnected={wsOn ?? false}
          onPersistViewpointField={onPersistViewpointField}
          onSemanticCommand={onSemanticCommand}
          lensMode={lensMode}
          activePlanTool={activePlanTool}
          snapSettings={snapSettings}
          viewOverlayRightInset={viewOverlayRightInset}
        />
      </ErrorBoundary>
    );
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ width: '50%', height: '100%', position: 'relative' }}>
          {/* Plan canvas — left pane */}
          {planCanvasJsx}
        </div>
        <div
          style={{
            width: '50%',
            height: '100%',
            position: 'relative',
            borderLeft: '1px solid var(--border, #444)',
          }}
        >
          {/* 3D viewport — right pane */}
          {viewportJsx}
        </div>
      </div>
    );
  }

  if (mode === '3d')
    return (
      <ErrorBoundary label="Viewport3D">
        <Viewport
          wsConnected={wsOn ?? false}
          onPersistViewpointField={onPersistViewpointField}
          onSemanticCommand={onSemanticCommand}
          lensMode={lensMode}
          activePlanTool={activePlanTool}
          snapSettings={snapSettings}
          viewOverlayRightInset={viewOverlayRightInset}
        />
      </ErrorBoundary>
    );
  if (mode === 'plan')
    return (
      <PlanCanvas
        key={activeTabId}
        wsConnected={wsOn ?? false}
        activeLevelResolvedId={activeLevelId}
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        cameraHandleRef={cameraHandleRef}
        initialCamera={initialCamera}
        lensMode={lensMode}
        activePlanTool={activePlanTool}
        onActivePlanToolChange={onActivePlanToolChange}
        snapSettings={snapSettings}
      />
    );
  if (mode === 'section') {
    return (
      <SectionModeShell
        key={activeTabId}
        activeLevelLabel={activeLevelId}
        activeSectionId={activeSectionId}
        modelId={modelId}
        onUpsertSemantic={onSemanticCommand}
        onOpenSourcePlan={onOpenSectionSourcePlan}
        onOpen3dContext={onOpenSection3dContext}
        lensMode={lensMode}
      />
    );
  }
  if (mode === 'sheet')
    return (
      <Suspense fallback={null}>
        <SheetModeShell
          key={activeTabId}
          elementsById={elementsById}
          preferredSheetId={preferredSheetId}
          modelId={modelId}
          onUpsertSemantic={onSemanticCommand}
          reviewMode={sheetReviewMode}
          markupShape={sheetMarkupShape}
          lensMode={lensMode}
        />
      </Suspense>
    );
  if (mode === 'schedule')
    return (
      <ErrorBoundary label="SchedulePanel">
        <Suspense fallback={null}>
          <ScheduleModeShell
            elementsById={elementsById}
            preferredScheduleId={preferredScheduleId}
            modelId={modelId}
            onUpsertSemantic={onSemanticCommand}
            onNavigateToElement={onNavigateToElement}
            lensMode={lensMode}
          />
        </Suspense>
      </ErrorBoundary>
    );
  if (mode === 'elevation')
    return (
      <ElevationModeShell
        key={activeTabId}
        elevationViewId={preferredElevationId}
        elementsById={elementsById}
      />
    );
  return viewerMode === 'orbit_3d' ? (
    <Viewport
      wsConnected={wsOn ?? false}
      onPersistViewpointField={onPersistViewpointField}
      onSemanticCommand={onSemanticCommand}
      lensMode={lensMode}
      activePlanTool={activePlanTool}
      snapSettings={snapSettings}
      viewOverlayRightInset={viewOverlayRightInset}
    />
  ) : (
    <PlanCanvas
      wsConnected={wsOn ?? false}
      activeLevelResolvedId={activeLevelId}
      activePlanViewId={activePlanViewId}
      onSemanticCommand={onSemanticCommand}
      lensMode={lensMode}
      activePlanTool={activePlanTool}
      onActivePlanToolChange={onActivePlanToolChange}
      snapSettings={snapSettings}
    />
  );
}
