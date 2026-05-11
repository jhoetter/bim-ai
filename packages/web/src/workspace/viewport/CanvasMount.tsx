import type { CSSProperties, JSX, RefObject } from 'react';

import type { Element } from '@bim-ai/core';

import { Viewport } from '../../Viewport';
import { ErrorBoundary } from '../../ErrorBoundary';
import { PlanCanvas, type PlanCameraHandle } from '../../plan/PlanCanvas';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from '../ModeShells';
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
}): JSX.Element {
  if ((mode as string) === 'plan-3d') {
    return (
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', width: '100%' }}
      >
        <div style={{ position: 'relative', borderRight: '1px solid var(--color-border)' }}>
          <PlanCanvas
            wsConnected={wsOn ?? false}
            activeLevelResolvedId={activeLevelId ?? ''}
            onSemanticCommand={onSemanticCommand}
            cameraHandleRef={cameraHandleRef}
            initialCamera={initialCamera}
            lensMode={lensMode}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Viewport
            wsConnected={wsOn ?? false}
            onPersistViewpointField={onPersistViewpointField}
            onSemanticCommand={onSemanticCommand}
          />
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
      />
    );
  if (mode === 'section')
    return (
      <SectionModeShell
        key={activeTabId}
        activeLevelLabel={activeLevelId}
        modelId={modelId}
        onUpsertSemantic={onSemanticCommand}
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
  if (mode === 'agent')
    return (
      <ErrorBoundary label="AgentReviewPane">
        <AgentReviewModeShell onApplyQuickFix={onSemanticCommand} />
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
    />
  );
}
