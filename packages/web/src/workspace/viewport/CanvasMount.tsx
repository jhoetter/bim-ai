import type { CSSProperties, JSX, RefObject } from 'react';

import type { Element } from '@bim-ai/core';

import { Viewport } from '../../Viewport';
import { ErrorBoundary } from '../../ErrorBoundary';
import { PlanCanvas, type PlanCameraHandle } from '../../plan/PlanCanvas';
import type { SnapSettings } from '../../plan/snapSettings';
import type { SheetMarkupShape, SheetReviewMode } from '../sheets/sheetReviewUi';
import { ScheduleModeShell, SectionModeShell, SheetModeShell } from '../ModeShells';
import type { WorkspaceMode } from '../shell';

export const canvasContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

export function CanvasMount({
  mode,
  viewerMode,
  activeLevelId,
  activeTabId,
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
  onNavigateToElement,
  snapSettings,
  sheetReviewMode,
  sheetMarkupShape,
  onOpenSectionSourcePlan,
  onOpenSection3dContext,
}: {
  mode: WorkspaceMode;
  viewerMode: 'plan_canvas' | 'orbit_3d';
  activeLevelId: string;
  /** Used to key same-kind canvases so switching tabs forces a fresh mount. */
  activeTabId?: string;
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
  lensMode?: string;
  onNavigateToElement?: (elementId: string) => void;
  snapSettings?: SnapSettings;
  sheetReviewMode?: SheetReviewMode;
  sheetMarkupShape?: SheetMarkupShape;
  onOpenSectionSourcePlan?: () => void;
  onOpenSection3dContext?: () => void;
}): JSX.Element {
  if (mode === '3d')
    return (
      <ErrorBoundary label="Viewport3D">
        <Viewport
          wsConnected={wsOn ?? false}
          onPersistViewpointField={onPersistViewpointField}
          onSemanticCommand={onSemanticCommand}
        />
      </ErrorBoundary>
    );
  if (mode === 'plan')
    return (
      <PlanCanvas
        key={activeTabId}
        wsConnected={wsOn ?? false}
        activeLevelResolvedId={activeLevelId}
        onSemanticCommand={onSemanticCommand}
        cameraHandleRef={cameraHandleRef}
        initialCamera={initialCamera}
        lensMode={lensMode}
        snapSettings={snapSettings}
      />
    );
  if (mode === 'section')
    return (
      <SectionModeShell
        key={activeTabId}
        activeLevelLabel={activeLevelId}
        modelId={modelId}
        onUpsertSemantic={onSemanticCommand}
        onOpenSourcePlan={onOpenSectionSourcePlan}
        onOpen3dContext={onOpenSection3dContext}
      />
    );
  if (mode === 'sheet')
    return (
      <SheetModeShell
        key={activeTabId}
        elementsById={elementsById}
        preferredSheetId={preferredSheetId}
        modelId={modelId}
        onUpsertSemantic={onSemanticCommand}
        reviewMode={sheetReviewMode}
        markupShape={sheetMarkupShape}
      />
    );
  if (mode === 'schedule')
    return (
      <ErrorBoundary label="SchedulePanel">
        <ScheduleModeShell
          elementsById={elementsById}
          preferredScheduleId={preferredScheduleId}
          modelId={modelId}
          onUpsertSemantic={onSemanticCommand}
          onNavigateToElement={onNavigateToElement}
        />
      </ErrorBoundary>
    );
  return viewerMode === 'orbit_3d' ? (
    <Viewport
      wsConnected={wsOn ?? false}
      onPersistViewpointField={onPersistViewpointField}
      onSemanticCommand={onSemanticCommand}
    />
  ) : (
    <PlanCanvas
      wsConnected={wsOn ?? false}
      activeLevelResolvedId={activeLevelId}
      onSemanticCommand={onSemanticCommand}
      lensMode={lensMode}
      snapSettings={snapSettings}
    />
  );
}
