import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Element } from '@bim-ai/core';
import { ICON_SIZE, Icons } from '@bim-ai/ui';

import { Viewport } from '../Viewport';
import { PlanCanvas } from '../plan/PlanCanvas';
import { useBimStore, toggleTheme, getCurrentTheme, type Theme } from '../state/store';
import { modeForHotkey } from '../state/modeController';
import { patternFor } from '../state/uiStates';
import { AppShell } from './AppShell';
import { TopBar, type WorkspaceMode } from './TopBar';
import { LeftRail, LeftRailCollapsed, type LeftRailSection } from './LeftRail';
import { Inspector, type InspectorSelection } from './Inspector';
import { StatusBar } from './StatusBar';
import { ToolPalette } from '../tools/ToolPalette';
import { TOOL_REGISTRY, type ToolDisabledContext, type ToolId } from '../tools/toolRegistry';

/**
 * RedesignedWorkspace — composition route for the §11–§17 chrome.
 *
 * Mounted at `/redesign`. Reads from `useBimStore` (same data as the
 * legacy `Workspace.tsx`) so engineers can A/B compare the two surfaces
 * without forking state. The canvas slot reuses the existing `Viewport`
 * / `PlanCanvas` components — only the chrome (TopBar / LeftRail /
 * Inspector / StatusBar / ToolPalette) is new.
 *
 * Spec sections wired here: §7 modes (1–7), §8 layout grid, §11 TopBar,
 * §12 Project Browser, §13 Inspector, §16 Tool palette, §17 StatusBar.
 */

const KNOWN_PLAN_TOOLS = new Set<ToolId>(['select', 'wall', 'door', 'window', 'room', 'dimension']);

type LegacyPlanTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'room_rectangle'
  | 'grid'
  | 'dimension';

function toolIdToLegacy(tool: ToolId): LegacyPlanTool | null {
  if (KNOWN_PLAN_TOOLS.has(tool)) return tool as LegacyPlanTool;
  return null;
}

function legacyToToolId(legacy: LegacyPlanTool): ToolId {
  if (legacy === 'room_rectangle') return 'room';
  if (legacy === 'grid') return 'select';
  return legacy as ToolId;
}

export function RedesignedWorkspace(): JSX.Element {
  const elementsById = useBimStore((s) => s.elementsById);
  const viewerMode = useBimStore((s) => s.viewerMode);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const planTool = useBimStore((s) => s.planTool);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const planHudMm = useBimStore((s) => s.planHudMm);

  const [mode, setMode] = useState<WorkspaceMode>(() =>
    viewerMode === 'orbit_3d' ? '3d' : 'plan',
  );
  const [theme, setTheme] = useState<Theme>(() => (getCurrentTheme() as Theme) ?? 'light');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  /* ── Mode wiring (§7 + §20) ────────────────────────────────────────── */
  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      setMode(next);
      if (next === 'plan' || next === 'plan-3d') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');
    },
    [setViewerMode],
  );

  /* ── Global hotkeys: 1–7 modes, ?, V/W/D/M/S/etc tools ─────────────── */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      const fromMode = modeForHotkey(event.key);
      if (fromMode) {
        event.preventDefault();
        handleModeChange(fromMode);
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setCheatsheetOpen((v) => !v);
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Tool hotkeys — match the spec'd letters from TOOL_REGISTRY.
      const upper = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      const hotkeyLabel = event.shiftKey ? `Shift+${upper}` : upper;
      const tool = (Object.values(TOOL_REGISTRY) as { id: ToolId; hotkey: string }[]).find(
        (t) => t.hotkey === hotkeyLabel,
      );
      if (tool) {
        const legacy = toolIdToLegacy(tool.id);
        if (legacy) {
          event.preventDefault();
          setPlanTool(legacy);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleModeChange, setPlanTool]);

  /* ── Project Browser sections ─────────────────────────────────────── */
  const browserSections = useMemo<LeftRailSection[]>(() => {
    const levels = (Object.values(elementsById) as Element[])
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const planViews = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
    );
    const viewpoints = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint',
    );
    const sections = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
    );
    const sheets = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet',
    );
    const schedules = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule',
    );
    return [
      {
        id: 'project',
        label: 'Project',
        rows: [
          {
            id: 'levels',
            label: 'Levels',
            children: levels.map((l) => ({ id: l.id, label: l.name, hint: `${l.elevationMm}mm` })),
          },
        ],
      },
      {
        id: 'views',
        label: 'Views',
        rows: [
          {
            id: 'plans',
            label: 'Floor Plans',
            children: planViews.map((p) => ({ id: p.id, label: p.name })),
          },
          {
            id: 'viewpoints',
            label: '3D Views',
            children: viewpoints.map((v) => ({ id: v.id, label: v.name })),
          },
          {
            id: 'sections',
            label: 'Sections',
            children: sections.map((s) => ({ id: s.id, label: s.name })),
          },
        ],
      },
      {
        id: 'sheets',
        label: 'Sheets',
        rows: sheets.map((s) => ({ id: s.id, label: s.name })),
      },
      {
        id: 'schedules',
        label: 'Schedules',
        rows: schedules.map((s) => ({ id: s.id, label: s.name })),
      },
    ];
  }, [elementsById]);

  /* ── Inspector selection ──────────────────────────────────────────── */
  const inspectorSelection = useMemo<InspectorSelection | null>(() => {
    if (!selectedId) return null;
    const el = elementsById[selectedId];
    if (!el) return null;
    return {
      label: `${humanKindLabel(el.kind)} · ${(el as { name?: string }).name ?? el.id}`,
      id: el.id,
    };
  }, [elementsById, selectedId]);

  /* ── Status bar wiring ────────────────────────────────────────────── */
  const levels = useMemo(() => {
    return (Object.values(elementsById) as Element[])
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm)
      .map((l) => ({ id: l.id, label: l.name }));
  }, [elementsById]);
  const activeLevel = levels.find((l) => l.id === activeLevelId) ??
    levels[0] ?? { id: '', label: '—' };
  const cursorMm = planHudMm ? { xMm: planHudMm.xMm, yMm: planHudMm.yMm } : null;

  const toolDisabledContext = useMemo<ToolDisabledContext>(() => {
    const has = (kind: string): boolean =>
      (Object.values(elementsById) as Element[]).some((e) => e.kind === kind);
    return {
      hasAnyWall: has('wall'),
      hasAnyFloor: has('floor'),
      hasAnySelection: !!selectedId,
    };
  }, [elementsById, selectedId]);

  const handleToolSelect = useCallback(
    (id: ToolId): void => {
      const legacy = toolIdToLegacy(id);
      if (legacy) setPlanTool(legacy);
    },
    [setPlanTool],
  );

  const handleThemeToggle = useCallback(() => {
    const next = toggleTheme() === 'dark' ? 'dark' : 'light';
    setTheme(next as Theme);
  }, []);

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor('canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <AppShell
      topBar={
        <TopBar
          mode={mode}
          onModeChange={handleModeChange}
          projectName="BIM AI seed"
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onCommandPalette={() => setPaletteOpen(true)}
          collaboratorsCount={undefined}
          avatarInitials="BA"
        />
      }
      leftRail={
        <LeftRail
          sections={browserSections}
          activeRowId={activeLevelId}
          onRowActivate={(id) => {
            // Activate level if matching id
            const isLevel = browserSections
              .find((s) => s.id === 'project')
              ?.rows.find((r) => r.id === 'levels')
              ?.children?.some((c) => c.id === id);
            if (isLevel) setActiveLevelId(id);
          }}
        />
      }
      leftRailCollapsed={<LeftRailCollapsed sections={browserSections} />}
      canvas={
        <div style={canvasContainerStyle} data-testid="redesign-canvas-root">
          {showEmptyState ? (
            <EmptyStateOverlay headline={emptyHint.headline} hint={emptyHint.hint} />
          ) : null}
          <FloatingPalette
            mode={mode}
            activeTool={legacyToToolId(planTool)}
            onToolSelect={handleToolSelect}
            disabledContext={toolDisabledContext}
          />
          <CanvasMount mode={mode} viewerMode={viewerMode} activeLevelId={activeLevelId ?? ''} />
        </div>
      }
      rightRail={
        <Inspector
          selection={inspectorSelection}
          tabs={{
            properties: <InspectorProperties />,
            constraints: <InspectorConstraints />,
            identity: <InspectorIdentity />,
          }}
          emptyStateActions={[
            { hotkey: 'W', label: 'Draw a wall' },
            { hotkey: 'D', label: 'Insert a door' },
            { hotkey: 'M', label: 'Drop a room marker' },
          ]}
          onClearSelection={() => select(undefined)}
        />
      }
      statusBar={
        <StatusBar
          level={activeLevel}
          levels={levels}
          onLevelChange={setActiveLevelId}
          toolLabel={TOOL_REGISTRY[legacyToToolId(planTool)]?.label ?? null}
          gridOn={true}
          cursorMm={cursorMm}
          undoDepth={0}
          wsState="connected"
          saveState="saved"
        />
      }
    />
  );
}

const canvasContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

function FloatingPalette({
  mode,
  activeTool,
  onToolSelect,
  disabledContext,
}: {
  mode: WorkspaceMode;
  activeTool: ToolId;
  onToolSelect: (id: ToolId) => void;
  disabledContext: ToolDisabledContext;
}): JSX.Element | null {
  if (mode === 'sheet' || mode === 'schedule' || mode === 'agent') return null;
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
      />
    </div>
  );
}

function CanvasMount({
  mode,
  viewerMode,
  activeLevelId,
}: {
  mode: WorkspaceMode;
  viewerMode: 'plan_canvas' | 'orbit_3d';
  activeLevelId: string;
}): JSX.Element {
  if (mode === 'plan-3d') {
    return (
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', width: '100%' }}
      >
        <div style={{ position: 'relative', borderRight: '1px solid var(--color-border)' }}>
          <PlanCanvas
            wsConnected={false}
            activeLevelResolvedId={activeLevelId ?? ''}
            onSemanticCommand={() => undefined}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Viewport wsConnected={false} />
        </div>
      </div>
    );
  }
  if (mode === '3d') return <Viewport wsConnected={false} />;
  if (mode === 'plan')
    return (
      <PlanCanvas
        wsConnected={false}
        activeLevelResolvedId={activeLevelId}
        onSemanticCommand={() => undefined}
      />
    );
  if (mode === 'sheet' || mode === 'schedule' || mode === 'agent' || mode === 'section') {
    return (
      <ModePlaceholder
        title={`${capitalize(mode)} mode`}
        body="The redesigned surface for this mode is wired through the existing canvas. Switch to Plan or 3D to explore the §11–§17 chrome."
      />
    );
  }
  return viewerMode === 'orbit_3d' ? (
    <Viewport wsConnected={false} />
  ) : (
    <PlanCanvas
      wsConnected={false}
      activeLevelResolvedId={activeLevelId}
      onSemanticCommand={() => undefined}
    />
  );
}

function ModePlaceholder({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-2 px-6 py-4 text-center">
        <Icons.agent size={ICON_SIZE.toolPalette} aria-hidden="true" className="text-muted" />
        <div className="text-md font-medium text-foreground">{title}</div>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

function EmptyStateOverlay({ headline, hint }: { headline: string; hint: string }): JSX.Element {
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
      <div className="flex flex-col items-center gap-1 rounded-lg bg-surface/85 px-6 py-4 text-center shadow-elev-2 backdrop-blur">
        <div className="text-md font-medium text-foreground">{headline}</div>
        <div className="text-sm text-muted">{hint}</div>
      </div>
    </div>
  );
}

function InspectorProperties(): JSX.Element {
  return <p className="text-sm text-muted">Properties tab will hydrate from the engine.</p>;
}

function InspectorConstraints(): JSX.Element {
  return (
    <p className="text-sm text-muted">Constraints (joins, location-line, fire rating) wire next.</p>
  );
}

function InspectorIdentity(): JSX.Element {
  return (
    <p className="text-sm text-muted">Identity (Type, Mark, ifcGuid, evidence digest) wire next.</p>
  );
}

function humanKindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Suppress an unused-import warning in case the keyboard bindings change. */
export type { KeyboardEvent };
