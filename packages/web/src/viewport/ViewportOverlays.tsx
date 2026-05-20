import type { JSX, RefObject } from 'react';
import type { Element, Saved3dViewElement } from '@bim-ai/core';

import type { Authoring3dSnapKind, WallDraftProjectionMode } from './authoring3d';
import { RenderQualityPanel } from './RenderQualityPanel';
import { SkyBackgroundPanel } from './SkyBackgroundPanel';
import { ViewCube } from './ViewCube';
import type { ViewCubePick } from './viewCubeAlignment';
import {
  WallFaceRadialMenu,
  type WallFaceRadialCommand,
  type WallFaceRadialMenuOpen,
} from './wallFaceRadialMenu';
import { WallContextMenu, type WallContextMenuCommand } from './WallContextMenu';

export type ScreenPoint = { x: number; y: number };
export type Direct3dAuthoringTool =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'shaft'
  | 'stair'
  | 'railing'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'room'
  | 'area'
  | 'grid'
  | 'reference-plane'
  | 'door'
  | 'window'
  | 'wall-opening'
  | 'component';

export type Authoring3dOverlayState = {
  tool: Direct3dAuthoringTool;
  phase: 'pick-start' | 'pick-end' | 'pick-point' | 'pick-wall' | 'pick-vertex' | 'pick-next';
  levelName?: string;
  startScreen?: ScreenPoint;
  currentScreen?: ScreenPoint;
  currentPointMm?: { xMm: number; yMm: number };
  workPlaneElevationMm?: number;
  snapKind?: Authoring3dSnapKind;
  snapScreen?: ScreenPoint;
  numericInputValue?: string;
  pointsScreen?: ScreenPoint[];
  previewStartScreen?: ScreenPoint;
  previewEndScreen?: ScreenPoint;
  previewOutlineScreen?: ScreenPoint[];
  previewHostValid?: boolean;
  previewHostWallId?: string;
  previewHostAlongT?: number;
  previewHostLock?: boolean;
  previewHostInvalidReason?: string;
  previewAuxLines?: Array<{ start: ScreenPoint; end: ScreenPoint }>;
  previewAuxArcPath?: string;
  wallPreviewOutlineScreen?: ScreenPoint[];
  wallPreviewDirectionStartScreen?: ScreenPoint;
  wallPreviewDirectionEndScreen?: ScreenPoint;
  wallFlipActive?: boolean;
  wallProjectionMode?: WallDraftProjectionMode;
  wallAnchorRequired?: boolean;
  wallPlaneUnreadable?: boolean;
  wallPlaneOccluded?: boolean;
};

export const DIRECT_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'wall',
  'floor',
  'roof',
  'shaft',
  'stair',
  'railing',
  'column',
  'beam',
  'ceiling',
  'room',
  'area',
  'grid',
  'reference-plane',
  'door',
  'window',
  'wall-opening',
  'component',
]);

export const LINE_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'wall',
  'beam',
  'stair',
  'railing',
  'grid',
  'reference-plane',
]);

export const POLYGON_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'floor',
  'roof',
  'shaft',
  'ceiling',
  'area',
]);

export type ViewportOverlayInstruction = { title: string; instruction: string };
export type Direct3dLevelOption = { id: string; name: string; elevationMm: number };

function NavHint({ k, label }: { k: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-border/70 bg-surface-strong px-1 py-0.5 font-mono leading-none">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function Sep(): JSX.Element {
  return <span className="opacity-30">·</span>;
}

export function viewportOverlayInstruction(
  authoringOverlay: Authoring3dOverlayState | null,
  direct3dAuthoringActive: boolean,
  draftPlaneAngleWarning: boolean,
  hasActiveComponentSelection: boolean,
): ViewportOverlayInstruction | null {
  if (!direct3dAuthoringActive || !authoringOverlay) return null;
  if (
    draftPlaneAngleWarning &&
    (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
      POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
      authoringOverlay.tool === 'column' ||
      authoringOverlay.tool === 'room' ||
      authoringOverlay.tool === 'component')
  ) {
    return {
      title: `${authoringOverlay.tool.replace('-', ' ')} placement`,
      instruction:
        'View is too edge-on to the active level plane. Orbit slightly toward top/plan before placing.',
    };
  }
  if (authoringOverlay.tool === 'floor') {
    return {
      title: `Floor boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-vertex'
          ? 'Click first floor boundary point.'
          : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
    };
  }
  if (authoringOverlay.tool === 'roof') {
    return {
      title: `Roof footprint · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-vertex'
          ? 'Click first roof footprint point.'
          : 'Click next footprint points. Click near first point to close. Esc cancels sketch.',
    };
  }
  if (authoringOverlay.tool === 'shaft') {
    return {
      title: `Shaft opening · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-vertex'
          ? 'Click first shaft boundary point.'
          : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
    };
  }
  if (authoringOverlay.tool === 'area') {
    return {
      title: `Area boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-vertex'
          ? 'Click first area boundary point.'
          : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
    };
  }
  if (authoringOverlay.tool === 'wall') {
    return {
      title: `Wall placement · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? authoringOverlay.wallPlaneUnreadable
            ? 'Rotate toward the active level work plane or open the associated plan. This view cannot place walls accurately.'
            : authoringOverlay.wallPlaneOccluded
              ? 'Move to visible active level grid. Walls cannot start through existing model geometry.'
              : authoringOverlay.wallAnchorRequired
                ? 'Move over the visible active level grid. Empty sky is not a valid 3D wall start.'
                : 'Click start point. Alt+drag or middle mouse to orbit/pan.'
          : authoringOverlay.wallPlaneUnreadable
            ? 'Move the endpoint back onto the readable active level work plane. Esc cancels segment.'
            : authoringOverlay.wallPlaneOccluded
              ? 'Move the endpoint onto visible active level grid; current cursor is behind model geometry. Esc cancels segment.'
              : `Click end point. Space flips side (${
                  authoringOverlay.wallFlipActive ? 'flipped' : 'default'
                }). Esc cancels segment.`,
    };
  }
  if (authoringOverlay.tool === 'beam') {
    return {
      title: `Beam placement · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? 'Click beam start point. Alt+drag or middle mouse to orbit/pan.'
          : 'Click beam end point. Esc cancels segment.',
    };
  }
  if (authoringOverlay.tool === 'stair') {
    return {
      title: `Stair run · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? 'Click stair run start. Alt+drag or middle mouse to orbit/pan.'
          : 'Click stair run end. Esc cancels segment.',
    };
  }
  if (authoringOverlay.tool === 'railing') {
    return {
      title: `Railing path · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? 'Click railing path start. Alt+drag or middle mouse to orbit/pan.'
          : 'Click railing path end. Esc cancels segment.',
    };
  }
  if (authoringOverlay.tool === 'grid') {
    return {
      title: `Grid line · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? 'Click grid start point. Alt+drag or middle mouse to orbit/pan.'
          : 'Click grid end point. Esc cancels segment.',
    };
  }
  if (authoringOverlay.tool === 'reference-plane') {
    return {
      title: `Reference plane · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-start'
          ? 'Click reference plane start point. Alt+drag or middle mouse to orbit/pan.'
          : 'Click reference plane end point. Esc cancels segment.',
    };
  }
  if (authoringOverlay.tool === 'column') {
    return {
      title: `Column placement · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction: 'Click a point to place a column. Alt+drag or middle mouse to orbit/pan.',
    };
  }
  if (authoringOverlay.tool === 'component') {
    return {
      title: `Component placement · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction: hasActiveComponentSelection
        ? 'Click a visible point to place the selected family or asset. Use Load Family to choose another.'
        : 'Use Insert > Load Family to choose an asset or loaded family before placing a component.',
    };
  }
  if (authoringOverlay.tool === 'ceiling') {
    return {
      title: `Ceiling boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction:
        authoringOverlay.phase === 'pick-vertex'
          ? 'Click first ceiling boundary point.'
          : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
    };
  }
  if (authoringOverlay.tool === 'room') {
    return {
      title: `Room placement · ${authoringOverlay.levelName ?? 'Active level'}`,
      instruction: 'Click inside a closed boundary to place a room.',
    };
  }
  if (authoringOverlay.tool === 'door') {
    return {
      title: 'Door placement',
      instruction:
        authoringOverlay.previewHostValid === false
          ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`
          : `Hover a wall to preview, then click to insert a door. L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`,
    };
  }
  if (authoringOverlay.tool === 'window') {
    return {
      title: 'Window placement',
      instruction:
        authoringOverlay.previewHostValid === false
          ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`
          : `Hover a wall to preview, then click to insert a window. L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`,
    };
  }
  return {
    title: 'Opening placement',
    instruction:
      authoringOverlay.previewHostValid === false
        ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
            authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
          } host.`
        : `Hover a wall to preview, then click to insert an opening. L ${
            authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
          } host.`,
  };
}

type ViewportOverlaysProps = {
  mountRef: RefObject<HTMLDivElement | null>;
  wallContextMenu: { wall: Extract<Element, { kind: 'wall' }>; position: ScreenPoint } | null;
  onWallContextMenuCommand: (next: WallContextMenuCommand) => void;
  onCloseWallContextMenu: () => void;
  wallFaceRadialMenu: WallFaceRadialMenuOpen | null;
  onWallFaceRadialCommand: (next: WallFaceRadialCommand) => void;
  onDismissWallFaceRadialMenu: () => void;
  viewOverlayRightInset?: string;
  currentAzimuth: number;
  currentElevation: number;
  onViewCubePick: (
    pick: ViewCubePick,
    alignment: { azimuth: number; elevation: number; up: { x: number; y: number; z: number } },
  ) => void;
  onViewCubeDrag: (dxPx: number, dyPx: number) => void;
  saved3dViewsList: Saved3dViewElement[];
  onOrientSaved: (view: Saved3dViewElement) => void;
  direct3dAuthoringActive: boolean;
  authoringOverlay: Authoring3dOverlayState | null;
  draftPlaneAngleWarning: boolean;
  hasActiveComponentSelection: boolean;
  direct3dLevelOptions: Direct3dLevelOption[];
  activeWorkPlaneLevel: { id: string; elevationMm: number } | null;
  onSetAuthoringWorkPlaneLevel: (levelId: string) => void;
  onStepAuthoringWorkPlaneLevel: (direction: -1 | 1) => void;
  walkActive: boolean;
  translate: (key: string) => string;
  sectionBoxSummary: string | null;
  savedViewLocked: boolean;
  activeSavedView: { name?: string } | null | undefined;
  viewLocked: boolean;
  onSetViewLocked: (locked: boolean) => void;
  skyPanelOpen: boolean;
  onSetSkyPanelOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  renderQualityOpen: boolean;
  onSetRenderQualityOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  splitViewEnabled: boolean;
  onToggleSplitView: () => void;
};

export function ViewportOverlays({
  mountRef,
  wallContextMenu,
  onWallContextMenuCommand,
  onCloseWallContextMenu,
  wallFaceRadialMenu,
  onWallFaceRadialCommand,
  onDismissWallFaceRadialMenu,
  viewOverlayRightInset,
  currentAzimuth,
  currentElevation,
  onViewCubePick,
  onViewCubeDrag,
  saved3dViewsList,
  onOrientSaved,
  direct3dAuthoringActive,
  authoringOverlay,
  draftPlaneAngleWarning,
  hasActiveComponentSelection,
  direct3dLevelOptions,
  activeWorkPlaneLevel,
  onSetAuthoringWorkPlaneLevel,
  onStepAuthoringWorkPlaneLevel,
  walkActive,
  translate,
  sectionBoxSummary,
  savedViewLocked,
  activeSavedView,
  viewLocked,
  onSetViewLocked,
  skyPanelOpen,
  onSetSkyPanelOpen,
  renderQualityOpen,
  onSetRenderQualityOpen,
  splitViewEnabled,
  onToggleSplitView,
}: ViewportOverlaysProps): JSX.Element {
  const overlayTitleInstruction = viewportOverlayInstruction(
    authoringOverlay,
    direct3dAuthoringActive,
    draftPlaneAngleWarning,
    hasActiveComponentSelection,
  );

  return (
    <>
      {wallContextMenu && (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={onWallContextMenuCommand}
          onClose={onCloseWallContextMenu}
        />
      )}
      <WallFaceRadialMenu
        open={wallFaceRadialMenu}
        onSelect={onWallFaceRadialCommand}
        onDismiss={onDismissWallFaceRadialMenu}
      />
      <div
        className="pointer-events-auto absolute top-6 z-20"
        data-testid="viewport-viewcube-anchor"
        style={{
          right: viewOverlayRightInset ? `calc(${viewOverlayRightInset} + 1.5rem)` : '1.5rem',
        }}
      >
        <ViewCube
          currentAzimuth={currentAzimuth}
          currentElevation={currentElevation}
          onPick={onViewCubePick}
          onDrag={onViewCubeDrag}
          savedViews={saved3dViewsList}
          onOrientSaved={onOrientSaved}
        />
      </div>

      {overlayTitleInstruction ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20">
          <div className="rounded border border-accent/60 bg-surface/95 px-3 py-2 text-xs text-foreground shadow-sm">
            <div className="font-medium text-accent">{overlayTitleInstruction.title}</div>
            <div className="text-muted">{overlayTitleInstruction.instruction}</div>
          </div>
        </div>
      ) : null}

      {direct3dAuthoringActive && authoringOverlay?.levelName ? (
        <div className="pointer-events-auto absolute left-3 top-[74px] z-20">
          <div
            data-testid="viewport-work-plane-badge"
            className="flex max-w-[min(520px,calc(100vw-2rem))] items-center gap-2 rounded border border-accent/40 bg-surface/95 px-2.5 py-1.5 text-[11px] text-foreground shadow-sm"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="font-mono font-semibold text-accent">Work plane</span>
            <button
              type="button"
              data-testid="viewport-work-plane-prev"
              aria-label="Previous level"
              title="Previous level"
              disabled={direct3dLevelOptions.length < 2}
              className="grid size-6 place-items-center rounded border border-border bg-surface text-xs text-muted disabled:opacity-40"
              onClick={() => onStepAuthoringWorkPlaneLevel(-1)}
            >
              ^
            </button>
            <select
              data-testid="viewport-work-plane-level-select"
              aria-label="Active work plane level"
              className="h-6 min-w-[170px] max-w-[260px] rounded border border-border bg-surface px-2 font-mono text-[11px] text-foreground"
              value={activeWorkPlaneLevel?.id ?? ''}
              onChange={(event) => onSetAuthoringWorkPlaneLevel(event.currentTarget.value)}
            >
              {direct3dLevelOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} {(level.elevationMm / 1000).toFixed(2)} m
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="viewport-work-plane-next"
              aria-label="Next level"
              title="Next level"
              disabled={direct3dLevelOptions.length < 2}
              className="grid size-6 place-items-center rounded border border-border bg-surface text-xs text-muted disabled:opacity-40"
              onClick={() => onStepAuthoringWorkPlaneLevel(1)}
            >
              v
            </button>
          </div>
        </div>
      ) : null}

      <AuthoringOverlaySvg
        direct3dAuthoringActive={direct3dAuthoringActive}
        authoringOverlay={authoringOverlay}
      />

      {walkActive ? (
        <div
          data-testid="viewport-walk-hints"
          className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-1.5 text-[11px] text-muted shadow-md backdrop-blur-sm">
            <NavHint k="WASD" label={translate('viewport.walkHints.move')} />
            <Sep />
            <NavHint k="Mouse" label={translate('viewport.walkHints.look')} />
            <Sep />
            <NavHint k="Shift" label={translate('viewport.walkHints.run')} />
            <Sep />
            <NavHint k="Q/E" label={translate('viewport.walkHints.upDown')} />
            <Sep />
            <NavHint k="PgUp/PgDn" label={translate('viewport.walkHints.floor')} />
            <Sep />
            <NavHint k="Esc" label={translate('viewport.walkHints.exit')} />
          </div>
        </div>
      ) : null}

      {sectionBoxSummary ? (
        <div className="pointer-events-none absolute left-3 bottom-3 z-20">
          <span
            data-testid="section-box-summary"
            className="rounded-pill border border-border bg-surface/85 px-2 py-0.5 text-[11px] font-mono text-muted backdrop-blur-sm"
          >
            {sectionBoxSummary}
          </span>
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(to bottom, hsl(198 62% 88%) 0%, hsl(205 71% 95%) 40%, hsl(205 54% 97%) 75%, hsl(43 33% 88%) 100%)',
        }}
      />
      {savedViewLocked && activeSavedView ? (
        <div
          data-testid="viewport-saved-view-lock-badge"
          className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur-sm"
        >
          <span>🔒</span>
          <span>{activeSavedView.name} — camera locked</span>
        </div>
      ) : null}
      {viewLocked && !activeSavedView ? (
        <div
          data-testid="view-locked-badge"
          className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur-sm"
        >
          <span>🔒</span>
          <span>View Locked</span>
          <button type="button" className="ml-1 underline" onClick={() => onSetViewLocked(false)}>
            Unlock
          </button>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="viewport-sky-btn"
        aria-label="Sky background"
        title="Sky background"
        onClick={() => onSetSkyPanelOpen((v) => !v)}
        className="pointer-events-auto absolute bottom-3 right-3 z-20 grid size-7 place-items-center rounded border border-border bg-surface/90 text-sm text-foreground shadow-sm backdrop-blur-sm hover:bg-surface"
      >
        &#9729;
      </button>
      <SkyBackgroundPanel open={skyPanelOpen} onClose={() => onSetSkyPanelOpen(false)} />

      <button
        type="button"
        data-testid="viewport-render-quality-btn"
        aria-label="Render Quality"
        title="Render Quality"
        onClick={() => onSetRenderQualityOpen((v) => !v)}
        className="pointer-events-auto absolute bottom-12 right-3 z-20 grid size-7 place-items-center rounded border border-border bg-surface/90 text-sm text-foreground shadow-sm backdrop-blur-sm hover:bg-surface"
      >
        &#9881;
      </button>
      {renderQualityOpen && <RenderQualityPanel onClose={() => onSetRenderQualityOpen(false)} />}

      <button
        type="button"
        data-testid="viewport-split-view-btn"
        title={splitViewEnabled ? 'Exit Split View' : 'Split Plan/3D View'}
        onClick={onToggleSplitView}
        style={{
          fontSize: 10,
          padding: '2px 6px',
          border: `1px solid ${splitViewEnabled ? 'var(--color-info)' : 'var(--color-border)'}`,
          borderRadius: 3,
          background: splitViewEnabled
            ? 'color-mix(in srgb, var(--color-info) 15%, transparent)'
            : 'transparent',
          color: splitViewEnabled ? 'var(--color-info)' : 'inherit',
          cursor: 'pointer',
          position: 'absolute',
          bottom: '5.25rem',
          right: '0.75rem',
          zIndex: 20,
          pointerEvents: 'auto',
        }}
      >
        &#8862;
      </button>

      <div
        ref={mountRef}
        className={`relative z-[1] size-full ${
          direct3dAuthoringActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />
    </>
  );
}

function AuthoringOverlaySvg({
  direct3dAuthoringActive,
  authoringOverlay,
}: {
  direct3dAuthoringActive: boolean;
  authoringOverlay: Authoring3dOverlayState | null;
}): JSX.Element | null {
  if (!direct3dAuthoringActive || !authoringOverlay) return null;
  return (
    <>
      {authoringOverlay.snapScreen ? (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
          <g data-testid="viewport-3d-snap-glyph">
            <circle
              cx={authoringOverlay.snapScreen.x}
              cy={authoringOverlay.snapScreen.y}
              r="8"
              fill="var(--color-surface)"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.96"
            />
            <circle
              cx={authoringOverlay.snapScreen.x}
              cy={authoringOverlay.snapScreen.y}
              r="2.5"
              fill="var(--color-accent)"
              opacity="0.96"
            />
            <text
              x={authoringOverlay.snapScreen.x + 12}
              y={authoringOverlay.snapScreen.y - 10}
              fontSize="10"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="var(--color-accent)"
            >
              {authoringOverlay.snapKind === 'grid' ? 'grid snap' : 'level plane'}
            </text>
          </g>
        </svg>
      ) : null}
      {authoringOverlay.numericInputValue && authoringOverlay.currentScreen ? (
        <div
          data-testid="viewport-3d-numeric-input"
          className="pointer-events-none absolute z-30 rounded border border-accent bg-surface/95 px-2 py-1 font-mono text-[11px] text-accent shadow-sm"
          style={{
            left: authoringOverlay.currentScreen.x + 14,
            top: authoringOverlay.currentScreen.y + 14,
          }}
        >
          {authoringOverlay.numericInputValue}
          <span className="ml-1 text-muted">mm · Enter</span>
        </div>
      ) : null}
      {renderAuthoringCursorSvg(authoringOverlay)}
    </>
  );
}

function renderAuthoringCursorSvg(authoringOverlay: Authoring3dOverlayState): JSX.Element | null {
  if (
    LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
    authoringOverlay.phase === 'pick-end' &&
    authoringOverlay.startScreen &&
    authoringOverlay.currentScreen
  ) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        {authoringOverlay.tool === 'wall' ? (
          <line
            data-testid="wall-cursor-path"
            x1={authoringOverlay.startScreen.x}
            y1={authoringOverlay.startScreen.y}
            x2={authoringOverlay.currentScreen.x}
            y2={authoringOverlay.currentScreen.y}
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeDasharray="3 5"
            opacity="0.62"
          />
        ) : (
          <line
            x1={authoringOverlay.startScreen.x}
            y1={authoringOverlay.startScreen.y}
            x2={authoringOverlay.currentScreen.x}
            y2={authoringOverlay.currentScreen.y}
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.95"
          />
        )}
        <circle
          cx={authoringOverlay.startScreen.x}
          cy={authoringOverlay.startScreen.y}
          r="6"
          fill="var(--color-accent)"
          opacity="0.95"
        />
        {authoringOverlay.tool === 'wall' ? (
          <circle
            data-testid="wall-cursor-end"
            cx={authoringOverlay.currentScreen.x}
            cy={authoringOverlay.currentScreen.y}
            r="5"
            fill="var(--color-surface)"
            stroke="var(--color-accent)"
            strokeWidth="2"
            opacity="0.96"
          />
        ) : null}
      </svg>
    );
  }
  if (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) && authoringOverlay.currentScreen) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <circle
          cx={authoringOverlay.currentScreen.x}
          cy={authoringOverlay.currentScreen.y}
          r="6"
          fill="transparent"
          stroke="var(--color-accent)"
          strokeWidth="2"
          opacity="0.95"
        />
      </svg>
    );
  }
  if (
    POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
    authoringOverlay.pointsScreen &&
    authoringOverlay.pointsScreen.length > 0
  ) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <polyline
          points={authoringOverlay.pointsScreen.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          opacity="0.95"
        />
        {authoringOverlay.currentScreen ? (
          <line
            x1={authoringOverlay.pointsScreen[authoringOverlay.pointsScreen.length - 1]!.x}
            y1={authoringOverlay.pointsScreen[authoringOverlay.pointsScreen.length - 1]!.y}
            x2={authoringOverlay.currentScreen.x}
            y2={authoringOverlay.currentScreen.y}
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.95"
          />
        ) : null}
        <circle
          cx={authoringOverlay.pointsScreen[0]!.x}
          cy={authoringOverlay.pointsScreen[0]!.y}
          r="6"
          fill="var(--color-accent)"
          opacity="0.95"
        />
      </svg>
    );
  }
  if (POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) && authoringOverlay.currentScreen) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <circle
          cx={authoringOverlay.currentScreen.x}
          cy={authoringOverlay.currentScreen.y}
          r="6"
          fill="transparent"
          stroke="var(--color-accent)"
          strokeWidth="2"
          opacity="0.95"
        />
      </svg>
    );
  }
  if (
    (authoringOverlay.tool === 'column' || authoringOverlay.tool === 'room') &&
    authoringOverlay.currentScreen
  ) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <circle
          cx={authoringOverlay.currentScreen.x}
          cy={authoringOverlay.currentScreen.y}
          r="9"
          fill="transparent"
          stroke="var(--color-accent)"
          strokeWidth="2"
          opacity="0.95"
        />
        <circle
          cx={authoringOverlay.currentScreen.x}
          cy={authoringOverlay.currentScreen.y}
          r="3"
          fill="var(--color-accent)"
          opacity="0.95"
        />
      </svg>
    );
  }
  if (
    (authoringOverlay.tool === 'door' ||
      authoringOverlay.tool === 'window' ||
      authoringOverlay.tool === 'wall-opening') &&
    authoringOverlay.currentScreen
  ) {
    return <HostedOpeningPreviewSvg authoringOverlay={authoringOverlay} />;
  }
  return null;
}

function HostedOpeningPreviewSvg({
  authoringOverlay,
}: {
  authoringOverlay: Authoring3dOverlayState;
}): JSX.Element {
  const accent =
    authoringOverlay.previewHostValid === false ? 'var(--color-danger)' : 'var(--color-accent)';
  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      {authoringOverlay.previewOutlineScreen &&
      authoringOverlay.previewOutlineScreen.length >= 4 ? (
        <polygon
          points={authoringOverlay.previewOutlineScreen.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={
            authoringOverlay.previewHostValid === false
              ? 'color-mix(in srgb, var(--color-danger) 18%, transparent)'
              : 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
          }
          stroke={accent}
          strokeWidth="2"
          opacity="0.95"
        />
      ) : null}
      {authoringOverlay.previewStartScreen && authoringOverlay.previewEndScreen ? (
        <line
          x1={authoringOverlay.previewStartScreen.x}
          y1={authoringOverlay.previewStartScreen.y}
          x2={authoringOverlay.previewEndScreen.x}
          y2={authoringOverlay.previewEndScreen.y}
          stroke={accent}
          strokeWidth="3"
          strokeDasharray="6 4"
          opacity="0.95"
        />
      ) : null}
      {authoringOverlay.previewAuxArcPath ? (
        <path
          d={authoringOverlay.previewAuxArcPath}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          opacity="0.9"
        />
      ) : null}
      {authoringOverlay.previewAuxLines?.map((seg, idx) => (
        <line
          key={`host-preview-aux-${idx}`}
          x1={seg.start.x}
          y1={seg.start.y}
          x2={seg.end.x}
          y2={seg.end.y}
          stroke={accent}
          strokeWidth="2"
          opacity="0.9"
        />
      ))}
      {authoringOverlay.previewHostLock ? (
        <>
          <rect
            x={authoringOverlay.currentScreen!.x + 12}
            y={authoringOverlay.currentScreen!.y - 26}
            width={72}
            height={18}
            rx={9}
            fill="color-mix(in srgb, var(--color-accent) 22%, var(--color-surface))"
            stroke="var(--color-accent)"
            strokeWidth="1"
            opacity="0.95"
          />
          <text
            x={authoringOverlay.currentScreen!.x + 48}
            y={authoringOverlay.currentScreen!.y - 14}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="var(--color-accent)"
          >
            HOST LOCK
          </text>
        </>
      ) : null}
      <circle
        cx={authoringOverlay.currentScreen!.x}
        cy={authoringOverlay.currentScreen!.y}
        r="8"
        fill="transparent"
        stroke={accent}
        strokeWidth="2"
        opacity="0.95"
      />
    </svg>
  );
}
