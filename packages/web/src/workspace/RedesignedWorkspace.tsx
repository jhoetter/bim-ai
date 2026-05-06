import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Element } from '@bim-ai/core';
import { ICON_SIZE, Icons } from '@bim-ai/ui';

import { Viewport } from '../Viewport';
import { PlanCanvas, type PlanCameraHandle } from '../plan/PlanCanvas';
import { applyCommand, bootstrap } from '../lib/api';
import type { Snapshot, Violation } from '@bim-ai/core';
import { useBimStore, toggleTheme, getCurrentTheme, type Theme } from '../state/store';
import { modeForHotkey } from '../state/modeController';
import { patternFor } from '../state/uiStates';
import { AppShell } from './AppShell';
import { TopBar, type WorkspaceMode } from './TopBar';
import { LeftRail, LeftRailCollapsed, type LeftRailSection } from './LeftRail';
import { Inspector, type InspectorSelection } from './Inspector';
import {
  InspectorConstraintsFor,
  InspectorIdentityFor,
  InspectorPropertiesFor,
} from './InspectorContent';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from './ModeShells';
import { StatusBar } from './StatusBar';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { RedesignedCommandPalette } from '../cmd/RedesignedCommandPalette';
import { type CommandCandidate } from '../cmd/commandPaletteSources';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { ToolPalette } from '../tools/ToolPalette';
import { TOOL_REGISTRY, type ToolDisabledContext, type ToolId } from '../tools/toolRegistry';
import { TabBar } from './TabBar';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
  closeTab,
  cycleActive,
  openTab,
  reorderTab,
  snapshotViewport,
  tabFromElement,
  type TabKind,
  type TabsState,
  type ViewTab,
  type ViewportSnapshot,
} from './tabsModel';
import { persistTabs, pruneTabsAgainstElements, readPersistedTabs } from './tabsPersistence';
import { ProjectMenu, type ProjectMenuItemRecent } from './ProjectMenu';
import {
  buildSnapshotPayload,
  downloadSnapshot,
  findRecentProject,
  pushRecentProject,
  readRecentProjects,
  readSnapshotFile,
} from './projectSnapshots';

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
  const hydrateFromSnapshot = useBimStore((s) => s.hydrateFromSnapshot);
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
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [tourOpen, setTourOpen] = useState<boolean>(() => !readOnboardingProgress().completed);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<ProjectMenuItemRecent[]>(() =>
    readRecentProjects().map((r) => ({ id: r.id, label: r.label })),
  );
  const projectNameRef = useRef<HTMLButtonElement | null>(null);
  const planCameraHandleRef = useRef<PlanCameraHandle | null>(null);
  const [tabsState, setTabsState] = useState<TabsState>(() => readPersistedTabs() ?? EMPTY_TABS);

  /** Persist tabs on every change (T-06). */
  useEffect(() => {
    persistTabs(tabsState);
  }, [tabsState]);

  /* ── Tab helpers (§11.3) ──────────────────────────────────────────── */
  const activeTab: ViewTab | null = useMemo(
    () =>
      tabsState.activeId ? tabsState.tabs.find((t) => t.id === tabsState.activeId) ?? null : null,
    [tabsState],
  );

  const handleTabActivate = useCallback(
    (id: string) => {
      let pendingPlanCamera: ViewportSnapshot['planCamera'] | undefined;

      setTabsState((s) => {
        if (s.activeId === id) return s;
        // Snapshot the outgoing tab's viewport state so it can be restored
        // when the user comes back. T-07.
        let snapshotted = s;
        if (s.activeId) {
          const outgoing = s.tabs.find((x) => x.id === s.activeId);
          if (outgoing) {
            if (outgoing.kind === '3d' || outgoing.kind === 'plan-3d') {
              const pose = useBimStore.getState().orbitCameraPoseMm;
              if (pose) {
                snapshotted = snapshotViewport(snapshotted, s.activeId, {
                  ...(outgoing.viewportState ?? {}),
                  orbitCameraPoseMm: { eyeMm: pose.position, targetMm: pose.target },
                });
              }
            }
            // Snapshot the 2D plan camera for plan tabs (T-07 follow-up).
            if (outgoing.kind === 'plan' || outgoing.kind === 'plan-3d') {
              const planSnap = planCameraHandleRef.current?.getSnapshot();
              if (planSnap) {
                snapshotted = snapshotViewport(snapshotted, s.activeId, {
                  ...(snapshotted.tabs.find((x) => x.id === s.activeId)?.viewportState ?? {}),
                  planCamera: planSnap,
                });
              }
            }
          }
        }
        const next = activateTab(snapshotted, id);
        const t = next.tabs.find((x) => x.id === id);
        if (!t) return next;
        // Keep the store's active level in sync with the active tab's target.
        if ((t.kind === 'plan' || t.kind === 'plan-3d') && t.targetId) {
          setActiveLevelId(t.targetId);
        }
        // Restore the incoming tab's 3D camera, if it has one.
        const restored = t.viewportState?.orbitCameraPoseMm;
        if (restored?.eyeMm && restored.targetMm) {
          useBimStore.getState().setOrbitCameraFromViewpointMm({
            position: restored.eyeMm,
            target: restored.targetMm,
            up: { xMm: 0, yMm: 1, zMm: 0 },
          });
        }
        // Capture the incoming plan camera for post-setState apply (plan-to-plan case).
        if (t.kind === 'plan' || t.kind === 'plan-3d') {
          pendingPlanCamera = t.viewportState?.planCamera;
        }
        return next;
      });

      // Apply plan camera to the already-mounted PlanCanvas (plan-to-plan switch).
      // For 3D→plan switches, initialCamera prop handles restore at mount time.
      if (pendingPlanCamera) {
        planCameraHandleRef.current?.applySnapshot(pendingPlanCamera);
      }
    },
    [setActiveLevelId],
  );

  const handleTabClose = useCallback((id: string) => {
    setTabsState((s) => closeTab(s, id));
  }, []);

  const openTabFromElement = useCallback((el: Element) => {
    const partial = tabFromElement(el);
    if (!partial) return;
    setTabsState((s) => openTab(s, partial));
  }, []);

  /* ── Project menu handlers (T-03) ─────────────────────────────────── */
  const handleSaveSnapshot = useCallback(() => {
    const st = useBimStore.getState();
    if (!st.modelId) {
      setSeedError('Nothing to save — bootstrap a model first.');
      return;
    }
    const snap: Snapshot = {
      modelId: st.modelId,
      revision: st.revision ?? 0,
      elements: st.elementsById as unknown as Record<string, unknown>,
      violations: [],
    };
    const payload = buildSnapshotPayload(snap);
    downloadSnapshot(payload);
    const next = pushRecentProject(payload);
    setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
  }, []);

  const handleRestoreSnapshot = useCallback(
    async (file: File): Promise<void> => {
      try {
        const payload = await readSnapshotFile(file);
        hydrateFromSnapshot(payload.snapshot);
        const next = pushRecentProject(payload);
        setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
      } catch (err) {
        setSeedError(err instanceof Error ? err.message : 'Failed to read snapshot');
      }
    },
    [hydrateFromSnapshot],
  );

  const handlePickRecent = useCallback(
    (id: string) => {
      const found = findRecentProject(id);
      if (!found) return;
      hydrateFromSnapshot(found.payload.snapshot);
    },
    [hydrateFromSnapshot],
  );

  const handleNewClear = useCallback(() => {
    hydrateFromSnapshot({ modelId: 'empty', revision: 0, elements: {}, violations: [] });
    setTabsState(EMPTY_TABS);
  }, [hydrateFromSnapshot]);

  /* ── Semantic command dispatch (from PlanCanvas / Viewport) ────────── */
  const onSemanticCommand = useCallback(
    async (cmd: Record<string, unknown>): Promise<void> => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;
      try {
        const r = await applyCommand(mid, cmd, { userId: uid });
        if (r.revision !== undefined) {
          hydrateFromSnapshot({
            modelId: mid,
            revision: r.revision,
            elements: r.elements ?? {},
            violations: (r.violations ?? []) as Violation[],
          });
        }
      } catch (err) {
        // V1: surface the error in seedError-style readout. Full conflict
        // queue (legacy `Workspace.tsx`) is out of scope here.
        setSeedError(err instanceof Error ? err.message : 'Apply failed');
      }
    },
    [hydrateFromSnapshot],
  );

  const insertSeedHouse = useCallback(async (): Promise<void> => {
    setSeedLoading(true);
    setSeedError(null);
    try {
      const bx = await bootstrap();
      const pj = bx.projects as Record<string, unknown>[] | undefined;
      const m0 = pj?.[0]?.models as Array<{ id?: unknown }> | undefined;
      const mid = m0?.[0]?.id;
      if (typeof mid !== 'string') throw new Error('No models — run make seed');
      const snapRes = await fetch(`/api/models/${encodeURIComponent(mid)}/snapshot`);
      if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
      const snap = (await snapRes.json()) as Snapshot;
      hydrateFromSnapshot(snap);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load seed');
    } finally {
      setSeedLoading(false);
    }
  }, [hydrateFromSnapshot]);

  useEffect(() => {
    const isEmpty = Object.keys(elementsById).length === 0;
    if (!isEmpty) return;
    void insertSeedHouse();
    // Run-once bootstrap: re-running is the user's job via the empty-state CTA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After the seed has hydrated, prune any restored tabs whose targets
  // no longer exist (e.g. a sheet deleted between sessions). If the
  // pruned set is empty, open a default Plan tab on the first level.
  // Runs once when the store transitions from empty → non-empty.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (Object.keys(elementsById).length === 0) return;
    seededRef.current = true;
    setTabsState((s) => {
      const pruned = pruneTabsAgainstElements(s, elementsById);
      if (pruned.tabs.length > 0) return pruned;
      const levels = (Object.values(elementsById) as Element[]).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      if (levels.length === 0) return pruned;
      const targetLevel =
        levels.find((l) => l.id === activeLevelId) ??
        levels.sort((a, b) => a.elevationMm - b.elevationMm)[0];
      if (!targetLevel) return pruned;
      return openTab(pruned, {
        kind: 'plan',
        targetId: targetLevel.id,
        label: `Plan · ${targetLevel.name}`,
      });
    });
  }, [elementsById, activeLevelId]);

  /* ── Mode wiring (§7 + §20) ────────────────────────────────────────── */
  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      setMode(next);
      if (next === 'plan' || next === 'plan-3d') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');
      // Activate or open a tab of the matching kind so the canvas
      // mounts the right view.
      setTabsState((s) => {
        const fallback = defaultTabFallbackForKind(next, elementsById, activeLevelId);
        if (!fallback) return s;
        return activateOrOpenKind(s, next as TabKind, fallback);
      });
    },
    [setViewerMode, elementsById, activeLevelId],
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
      // Tab cycling — Ctrl/⌘+Tab forward, Ctrl/⌘+Shift+Tab back.
      if (event.key === 'Tab' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => cycleActive(s, event.shiftKey ? 'backward' : 'forward'));
        return;
      }
      // Close active tab — Ctrl/⌘+W.
      if ((event.key === 'w' || event.key === 'W') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => (s.activeId ? closeTab(s, s.activeId) : s));
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

  /* ── Command palette candidates (§18) ─────────────────────────────── */
  const paletteCandidates = useMemo<CommandCandidate[]>(() => {
    const items: CommandCandidate[] = [];
    // Tool sources
    for (const tool of Object.values(TOOL_REGISTRY)) {
      items.push({
        id: `tool.${tool.id}`,
        kind: 'tool',
        label: tool.label,
        keywords: tool.tooltip ?? '',
        hint: tool.hotkey,
      });
    }
    // View sources (plan views + viewpoints + section cuts)
    for (const el of Object.values(elementsById) as Element[]) {
      if (el.kind === 'plan_view') {
        items.push({ id: el.id, kind: 'view', label: `Plan: ${el.name}`, keywords: 'plan view' });
      } else if (el.kind === 'viewpoint') {
        items.push({
          id: el.id,
          kind: 'view',
          label: `3D: ${el.name}`,
          keywords: 'viewpoint orbit',
        });
      } else if (el.kind === 'section_cut') {
        items.push({
          id: el.id,
          kind: 'view',
          label: `Section: ${el.name}`,
          keywords: 'section cut',
        });
      }
    }
    // Element sources (walls / doors / windows / rooms — top-N keep light)
    let elemCount = 0;
    for (const el of Object.values(elementsById) as Element[]) {
      if (el.kind !== 'wall' && el.kind !== 'door' && el.kind !== 'window' && el.kind !== 'room')
        continue;
      if (elemCount > 60) break;
      items.push({
        id: el.id,
        kind: 'element',
        label: `${el.kind}: ${(el as { name?: string }).name ?? el.id}`,
        keywords: el.kind,
      });
      elemCount++;
    }
    // Settings
    items.push(
      { id: 'settings.theme.light', kind: 'setting', label: 'Theme: light', keywords: 'light' },
      { id: 'settings.theme.dark', kind: 'setting', label: 'Theme: dark', keywords: 'dark' },
    );
    // Agent
    items.push({ id: 'agent.review', kind: 'agent', label: 'Run Agent Review' });
    return items;
  }, [elementsById]);

  const handlePalettePick = useCallback(
    (cand: CommandCandidate) => {
      setRecentCommandIds((prev) => [cand.id, ...prev.filter((id) => id !== cand.id)].slice(0, 5));
      if (cand.kind === 'tool') {
        const toolId = cand.id.replace(/^tool\./, '') as ToolId;
        const legacy = toolIdToLegacy(toolId);
        if (legacy) setPlanTool(legacy);
        return;
      }
      if (cand.kind === 'element') {
        select(cand.id);
        return;
      }
      if (cand.id === 'settings.theme.light' || cand.id === 'settings.theme.dark') {
        const next = cand.id.endsWith('dark') ? 'dark' : 'light';
        if (getCurrentTheme() !== next) {
          toggleTheme();
          setTheme(next as Theme);
        }
        return;
      }
      if (cand.kind === 'view') {
        select(cand.id);
      }
    },
    [select, setPlanTool],
  );

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor('canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <>
      <CheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <RedesignedCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        candidates={paletteCandidates}
        recentIds={recentCommandIds}
        onPick={handlePalettePick}
      />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <ProjectMenu
        open={projectMenuOpen}
        onOpenChange={setProjectMenuOpen}
        anchorRef={projectNameRef}
        recent={recentProjects}
        onPickRecent={handlePickRecent}
        onInsertSeed={() => void insertSeedHouse()}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={(f) => void handleRestoreSnapshot(f)}
        onNewClear={handleNewClear}
        onReplayTour={() => {
          resetOnboarding();
          setTourOpen(true);
        }}
      />
      <AppShell
        topBar={
          <div className="flex w-full flex-col">
            <div className="flex w-full items-center">
              <TopBar
                mode={mode}
                onModeChange={handleModeChange}
                projectName="BIM AI seed"
                projectNameRef={projectNameRef}
                onProjectNameClick={() => setProjectMenuOpen((v) => !v)}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onCommandPalette={() => setPaletteOpen(true)}
                collaboratorsCount={undefined}
                avatarInitials="BA"
              />
              <a
                href="/legacy"
                className="ml-2 mr-3 whitespace-nowrap rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-strong"
                data-testid="legacy-route-link"
                title="Open the v1 panel-stack view"
              >
                Legacy
              </a>
            </div>
            <TabBar
              tabs={tabsState.tabs}
              activeId={tabsState.activeId}
              onActivate={(id) => {
                handleTabActivate(id);
                const t = tabsState.tabs.find((x) => x.id === id);
                if (t) {
                  if (t.kind === 'plan' || t.kind === 'plan-3d') setViewerMode('plan_canvas');
                  else if (t.kind === '3d') setViewerMode('orbit_3d');
                  setMode(t.kind as WorkspaceMode);
                }
              }}
              onClose={handleTabClose}
              onReorder={(from, to) => setTabsState((s) => reorderTab(s, from, to))}
              onAdd={(kind) => {
                const fallback = defaultTabFallbackForKind(kind, elementsById, activeLevelId);
                if (!fallback) return;
                setTabsState((s) => activateOrOpenKind(s, kind, fallback));
                setMode(kind as WorkspaceMode);
                if (kind === 'plan' || kind === 'plan-3d') setViewerMode('plan_canvas');
                else if (kind === '3d') setViewerMode('orbit_3d');
              }}
            />
          </div>
        }
        leftRail={
          <LeftRail
            sections={browserSections}
            activeRowId={activeLevelId}
            onRowActivate={(id) => {
              const el = elementsById[id];
              if (!el) {
                // Levels nest under "project" → "levels"; check the nested children.
                const isLevel = browserSections
                  .find((s) => s.id === 'project')
                  ?.rows.find((r) => r.id === 'levels')
                  ?.children?.some((c) => c.id === id);
                if (isLevel) setActiveLevelId(id);
                return;
              }
              if (el.kind === 'level') {
                setActiveLevelId(id);
                openTabFromElement(el);
                handleModeChange('plan');
                return;
              }
              if (el.kind === 'plan_view') {
                openTabFromElement(el);
                handleModeChange('plan');
                select(id);
                return;
              }
              if (el.kind === 'viewpoint') {
                openTabFromElement(el);
                handleModeChange('3d');
                select(id);
                return;
              }
              if (el.kind === 'section_cut') {
                openTabFromElement(el);
                handleModeChange('section');
                select(id);
                return;
              }
              if (el.kind === 'sheet') {
                openTabFromElement(el);
                handleModeChange('sheet');
                select(id);
                return;
              }
              if (el.kind === 'schedule') {
                openTabFromElement(el);
                handleModeChange('schedule');
                select(id);
                return;
              }
              select(id);
            }}
          />
        }
        leftRailCollapsed={<LeftRailCollapsed sections={browserSections} />}
        canvas={
          <div style={canvasContainerStyle} data-testid="redesign-canvas-root">
            {showEmptyState ? (
              <EmptyStateOverlay
                headline={emptyHint.headline}
                hint={emptyHint.hint}
                ctaLabel={emptyHint.cta?.label ?? null}
                ctaPending={seedLoading}
                ctaError={seedError}
                onCta={() => void insertSeedHouse()}
              />
            ) : null}
            <FloatingPalette
              mode={mode}
              activeTool={legacyToToolId(planTool)}
              onToolSelect={handleToolSelect}
              disabledContext={toolDisabledContext}
            />
            <CanvasMount
              mode={(activeTab?.kind as WorkspaceMode | undefined) ?? mode}
              viewerMode={viewerMode}
              activeLevelId={
                activeTab?.kind === 'plan' || activeTab?.kind === 'plan-3d'
                  ? activeTab.targetId ?? activeLevelId ?? ''
                  : activeLevelId ?? ''
              }
              elementsById={elementsById}
              onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
              cameraHandleRef={planCameraHandleRef}
              initialCamera={activeTab?.viewportState?.planCamera}
            />
          </div>
        }
        rightRail={(() => {
          const el = selectedId ? elementsById[selectedId] : undefined;
          return (
            <Inspector
              selection={inspectorSelection}
              tabs={{
                properties: el ? (
                  InspectorPropertiesFor(el)
                ) : (
                  <InspectorEmptyTab message="No element selected." />
                ),
                constraints: el ? (
                  InspectorConstraintsFor(el)
                ) : (
                  <InspectorEmptyTab message="No element selected." />
                ),
                identity: el ? (
                  InspectorIdentityFor(el)
                ) : (
                  <InspectorEmptyTab message="No element selected." />
                ),
              }}
              emptyStateActions={[
                {
                  hotkey: 'W',
                  label: 'Draw a wall',
                  onTrigger: () => {
                    if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                    setPlanTool('wall');
                  },
                },
                {
                  hotkey: 'D',
                  label: 'Insert a door',
                  onTrigger: () => {
                    if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                    setPlanTool('door');
                  },
                },
                {
                  hotkey: 'M',
                  label: 'Drop a room marker',
                  onTrigger: () => {
                    if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                    setPlanTool('room');
                  },
                },
              ]}
              onClearSelection={() => select(undefined)}
            />
          );
        })()}
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
    </>
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
  elementsById,
  onSemanticCommand,
  cameraHandleRef,
  initialCamera,
}: {
  mode: WorkspaceMode;
  viewerMode: 'plan_canvas' | 'orbit_3d';
  activeLevelId: string;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
  cameraHandleRef?: RefObject<PlanCameraHandle | null>;
  initialCamera?: { centerMm?: { xMm: number; yMm: number }; halfMm?: number };
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
            onSemanticCommand={onSemanticCommand}
            cameraHandleRef={cameraHandleRef}
            initialCamera={initialCamera}
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
        onSemanticCommand={onSemanticCommand}
        cameraHandleRef={cameraHandleRef}
        initialCamera={initialCamera}
      />
    );
  if (mode === 'section') return <SectionModeShell elementsById={elementsById} />;
  if (mode === 'sheet') return <SheetModeShell elementsById={elementsById} />;
  if (mode === 'schedule') return <ScheduleModeShell elementsById={elementsById} />;
  if (mode === 'agent') return <AgentReviewModeShell />;
  return viewerMode === 'orbit_3d' ? (
    <Viewport wsConnected={false} />
  ) : (
    <PlanCanvas
      wsConnected={false}
      activeLevelResolvedId={activeLevelId}
      onSemanticCommand={onSemanticCommand}
    />
  );
}

function EmptyStateOverlay({
  headline,
  hint,
  ctaLabel,
  ctaPending,
  ctaError,
  onCta,
}: {
  headline: string;
  hint: string;
  ctaLabel: string | null;
  ctaPending: boolean;
  ctaError: string | null;
  onCta: () => void;
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
        <div className="text-md font-medium text-foreground">{headline}</div>
        <div className="text-sm text-muted">{hint}</div>
        {ctaLabel ? (
          <button
            type="button"
            onClick={onCta}
            disabled={ctaPending}
            data-testid="canvas-empty-cta"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground shadow-elev-1 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ctaPending ? 'Loading…' : ctaLabel}
          </button>
        ) : null}
        {ctaError ? (
          <div className="text-xs text-danger" data-testid="canvas-empty-error">
            {ctaError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InspectorEmptyTab({ message }: { message: string }): JSX.Element {
  return <p className="text-sm text-muted">{message}</p>;
}

function humanKindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Default tab descriptor when a mode pill (or tab `+`) is clicked
 * with no specific element. Picks the active level for plan/plan-3d,
 * the first viewpoint for 3d, the first section for section, etc. */
function defaultTabFallbackForKind(
  kind: WorkspaceMode | TabKind,
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
): { targetId?: string; label: string } | null {
  const all = Object.values(elementsById) as Element[];
  if (kind === 'plan' || kind === 'plan-3d') {
    const levels = all
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const lvl = levels.find((l) => l.id === activeLevelId) ?? levels[0];
    if (!lvl) return { label: kind === 'plan' ? 'Plan' : 'Plan + 3D' };
    return {
      targetId: lvl.id,
      label: kind === 'plan' ? `Plan · ${lvl.name}` : `Plan + 3D · ${lvl.name}`,
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
  if (kind === 'agent') {
    return { label: 'Agent review' };
  }
  return null;
}

/** Suppress an unused-import warning in case the keyboard bindings change. */
export type { KeyboardEvent };
