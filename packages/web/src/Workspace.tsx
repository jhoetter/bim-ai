import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import type {
  Element,
  ModelDelta,
  PerspectiveId,
  Snapshot,
  Violation,
  WorkspaceLayoutPreset,
} from '@bim-ai/core';

import { Btn, Panel } from '@bim-ai/ui';

import { formatCollaboration409Status } from './lib/collaborationConflictStatus';
import {
  ApiHttpError,
  applyCommand,
  bootstrap,
  coerceDelta,
  fetchActivity,
  fetchBuildingPresets,
  fetchComments,
  patchCommentResolved,
  postComment,
  redoModel,
  undoModel,
} from './lib/api';
import { AdvisorPanel } from './advisor/AdvisorPanel';
import { Cheatsheet } from './cmd/Cheatsheet';
import { CommandBar } from './cmd/CommandBar';
import { CommandPalette } from './CommandPalette';
import { LevelStack } from './levels/LevelStack';
import { parseCommandLine } from './cmd/parser';
import { SchedulePanel } from './schedules/SchedulePanel';
import { Welcome, shouldShowWelcome } from './onboarding/Welcome';
import { PlanCanvas } from './plan/PlanCanvas';

import { toggleStoredTheme, useBimStore, type PlanTool } from './state/store';

import { Viewport } from './Viewport';

import { AgentReviewPane } from './workspace/AgentReviewPane';

import type { PlanPresentationPreset } from './plan/symbology';

import { planViewGraphicsMatrixRows, viewTemplateGraphicsMatrixRows } from './plan/planProjection';

import { planToolsForPerspective } from './workspace/planToolsByPerspective';

import { PlanViewGraphicsMatrix } from './workspace/PlanViewGraphicsMatrix';
import { ProjectBrowser } from './workspace/ProjectBrowser';
import {
  SavedViewTagGraphicsAuthoring,
  SavedViewTemplateGraphicsAuthoring,
} from './workspace/savedViewTagGraphicsAuthoring';
import { RoomColorSchemePanel } from './workspace/RoomColorSchemePanel';
import { SiteAuthoringPanel } from './workspace/SiteAuthoringPanel';
import { SectionPlaceholderPane } from './workspace/SectionPlaceholderPane';
import { SheetCanvas } from './workspace/SheetCanvas';

async function fetchSnap(modelId: string): Promise<Snapshot> {
  const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${txt}`);
  const json = JSON.parse(txt) as Record<string, unknown>;
  return {
    modelId: String(json.modelId ?? ''),
    revision: Number(json.revision ?? 0),
    elements: (json.elements ?? {}) as Snapshot['elements'],
    violations: (json.violations ?? []) as Violation[],
  };
}

function parseWs(payload: Record<string, unknown>): Snapshot | null {
  const modelId =
    typeof payload.modelId === 'string'
      ? payload.modelId
      : typeof payload.model_id === 'string'
        ? payload.model_id
        : '';
  if (!modelId) return null;
  return {
    modelId,
    revision: Number(payload.revision ?? 0),
    elements: (payload.elements ?? {}) as Snapshot['elements'],
    violations: (payload.violations ?? []) as Violation[],
  };
}

const VIEWER_HIDDEN_KIND_KEYS = [
  'wall',
  'floor',
  'roof',
  'stair',
  'door',
  'window',
  'room',
] as const;

function mapComments(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    userDisplay: String(row.userDisplay ?? row.user_display ?? ''),
    body: String(row.body ?? ''),
    elementId: (row.elementId ?? row.element_id ?? null) as string | null,
    levelId: (row.levelId ?? row.level_id ?? null) as string | null,
    anchorXMm:
      row.anchorXMm !== undefined
        ? Number(row.anchorXMm)
        : row.anchor_x_mm !== undefined
          ? Number(row.anchor_x_mm)
          : null,
    anchorYMm:
      row.anchorYMm !== undefined
        ? Number(row.anchorYMm)
        : row.anchor_y_mm !== undefined
          ? Number(row.anchor_y_mm)
          : null,
    resolved: Boolean(row.resolved),
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  }));
}

const LAYOUT_PRESET_OPTIONS: { id: WorkspaceLayoutPreset; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'split_plan_3d', label: 'Plan + 3D' },
  { id: 'split_plan_section', label: 'Plan + Section' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'schedules_focus', label: 'Schedules' },
  { id: 'agent_review', label: 'Agent review' },
];

const PERSPECTIVE_OPTIONS: { id: PerspectiveId; label: string }[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'structure', label: 'Structure' },
  { id: 'mep', label: 'MEP' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'construction', label: 'Construction' },
  { id: 'agent', label: 'Agent' },
];

const TOOL_BTN_LABEL: Record<PlanTool, string> = {
  select: 'Sel',
  wall: 'Wall',
  door: 'Door',
  window: 'Win',
  room: 'Rm',
  room_rectangle: 'Rect',
  grid: 'Grid',
  dimension: 'Dim',
};

export function Workspace() {
  const [searchParams] = useSearchParams();
  const evidenceSheetFull = searchParams.has('evidenceSheetFull');
  const wsRef = useRef<WebSocket | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cmdBarFocus, setCmdBarFocus] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const [welcomeOpen, setWelcomeOpen] = useState(() => shouldShowWelcome());
  const [codePresetIds, setCodePresetIds] = useState<string[]>([
    'residential',
    'commercial',
    'office',
  ]);

  const [bootErr, setBootErr] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading…');

  const [wsOn, setWsOn] = useState(false);

  const [commentTxt, setCommentTxt] = useState('');
  const [displayName, setDisplayName] = useState(useBimStore.getState().userDisplayName);

  const modelId = useBimStore((s) => s.modelId);

  const revision = useBimStore((s) => s.revision);

  const violations = useBimStore((s) => s.violations);
  const selectedId = useBimStore((s) => s.selectedId);
  const elementsById = useBimStore((s) => s.elementsById);
  const viewerMode = useBimStore((s) => s.viewerMode);
  const planTool = useBimStore((s) => s.planTool);
  const activeLv = useBimStore((s) => s.activeLevelId);
  const userId = useBimStore((s) => s.userId);
  const peerId = useBimStore((s) => s.peerId);
  const peers = useBimStore((s) => s.presencePeers);
  const cmts = useBimStore((s) => s.comments);

  const activities = useBimStore((s) => s.activityEvents);

  const planHudMm = useBimStore((s) => s.planHudMm);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);

  const workspaceLayoutPreset = useBimStore((s) => s.workspaceLayoutPreset);
  const setWorkspaceLayoutPreset = useBimStore((s) => s.setWorkspaceLayoutPreset);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
  const setPerspectiveId = useBimStore((s) => s.setPerspectiveId);

  const hydrateSnap = useBimStore((s) => s.hydrateFromSnapshot);
  const applyDelta = useBimStore((s) => s.applyDelta);
  const setVm = useBimStore((s) => s.setViewerMode);
  const setTool = useBimStore((s) => s.setPlanTool);
  const setLv = useBimStore((s) => s.setActiveLevelId);
  const setOrtho = useBimStore((s) => s.setOrthoSnapHold);

  const setPeers = useBimStore((s) => s.setPresencePeers);

  const mergeCm = useBimStore((s) => s.mergeComment);
  const setCm = useBimStore((s) => s.setComments);
  const setAct = useBimStore((s) => s.setActivity);
  const setIdentity = useBimStore((s) => s.setIdentity);
  const selectEl = useBimStore((s) => s.select);
  const planPresentationPreset = useBimStore((s) => s.planPresentationPreset);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);

  const setPlanPresentationPreset = useBimStore((s) => s.setPlanPresentationPreset);
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const toggleViewerCategoryHidden = useBimStore((s) => s.toggleViewerCategoryHidden);
  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const setViewerClipElevMm = useBimStore((s) => s.setViewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const setViewerClipFloorElevMm = useBimStore((s) => s.setViewerClipFloorElevMm);

  const selected = selectedId ? elementsById[selectedId] : undefined;

  const [planCropDraft, setPlanCropDraft] = useState({
    minX: '',
    minY: '',
    maxX: '',
    maxY: '',
  });

  useEffect(() => {
    const pv = selectedId ? elementsById[selectedId] : undefined;
    if (!pv || pv.kind !== 'plan_view') return;
    const min = pv.cropMinMm;
    const max = pv.cropMaxMm;
    const next = {
      minX: min ? String(min.xMm) : '',
      minY: min ? String(min.yMm) : '',
      maxX: max ? String(max.xMm) : '',
      maxY: max ? String(max.yMm) : '',
    };
    queueMicrotask(() => {
      setPlanCropDraft(next);
    });
  }, [selectedId, elementsById]);

  const inspectorGraphicsMatrixRows = useMemo(() => {
    if (!selected) return [];
    if (selected.kind === 'plan_view') return planViewGraphicsMatrixRows(elementsById, selected.id);
    if (selected.kind === 'view_template')
      return viewTemplateGraphicsMatrixRows(elementsById, selected.id);
    return [];
  }, [elementsById, selected]);

  const levels = useMemo(
    () =>
      Object.values(elementsById)

        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')

        .sort((a, b) => a.elevationMm - b.elevationMm),
    [elementsById],
  );

  const lvResolved = activeLv ?? levels[0]?.id ?? '';

  const pushServer = useCallback(
    (revision: number, elements?: Record<string, unknown>, viols?: unknown[]) => {
      const mid = useBimStore.getState().modelId;
      if (!mid) return;
      hydrateSnap({
        modelId: mid,

        revision,
        elements: elements ?? {},

        violations: (viols ?? []) as Violation[],
      });
    },
    [hydrateSnap],
  );

  const onSemantic = useCallback(
    async (cmd: Record<string, unknown>) => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;

      try {
        const r = await applyCommand(mid, cmd, { userId: uid });

        if (r.revision !== undefined) pushServer(r.revision, r.elements, r.violations);

        setStatus('Applied');
      } catch (e) {
        const collaboration =
          e instanceof ApiHttpError ? formatCollaboration409Status('Apply', e) : null;
        setStatus(collaboration ?? (e instanceof Error ? e.message : String(e)));
      }
    },

    [pushServer],
  );

  const persistViewpointHiddenKinds = useCallback(async () => {
    const st = useBimStore.getState();
    const mid = st.modelId;
    const uid = st.userId;
    const vid = st.activeViewpointId;
    if (!mid || !vid || st.viewerMode !== 'orbit_3d') return;

    const vpEl = st.elementsById[vid];
    if (!vpEl || vpEl.kind !== 'viewpoint') return;

    const hidden = VIEWER_HIDDEN_KIND_KEYS.filter((k) => st.viewerCategoryHidden[k]);

    try {
      const r = await applyCommand(
        mid,
        {
          type: 'updateElementProperty',

          elementId: vid,

          key: 'hiddenSemanticKinds3d',

          value: JSON.stringify(hidden),
        },
        { userId: uid },
      );

      if (r.revision !== undefined) pushServer(r.revision, r.elements, r.violations);
      setStatus('Applied');
    } catch (e) {
      const collaboration =
        e instanceof ApiHttpError ? formatCollaboration409Status('Apply', e) : null;
      setStatus(collaboration ?? (e instanceof Error ? e.message : String(e)));
    }
  }, [pushServer]);

  const persistViewpointClipPlanes = useCallback(async () => {
    const st = useBimStore.getState();
    const mid = st.modelId;
    const uid = st.userId;
    const vid = st.activeViewpointId;
    if (!mid || !vid || st.viewerMode !== 'orbit_3d') return;

    const vpEl = st.elementsById[vid];
    if (!vpEl || vpEl.kind !== 'viewpoint') return;

    try {
      for (const tup of [
        [
          'viewerClipCapElevMm',
          st.viewerClipElevMm == null ? '' : String(st.viewerClipElevMm),
        ] as const,
        [
          'viewerClipFloorElevMm',
          st.viewerClipFloorElevMm == null ? '' : String(st.viewerClipFloorElevMm),
        ] as const,
      ]) {
        const r = await applyCommand(
          mid,
          {
            type: 'updateElementProperty',

            elementId: vid,

            key: tup[0],

            value: tup[1],
          },
          { userId: uid },
        );
        if (r.revision !== undefined) pushServer(r.revision, r.elements, r.violations);
      }

      setStatus('Applied');
    } catch (e) {
      const collaboration =
        e instanceof ApiHttpError ? formatCollaboration409Status('Apply', e) : null;
      setStatus(collaboration ?? (e instanceof Error ? e.message : String(e)));
    }
  }, [pushServer]);

  const undoRedo = useCallback(
    async (u: boolean) => {
      const mid = useBimStore.getState().modelId;

      const uid = useBimStore.getState().userId;

      if (!mid) return;

      try {
        const r = u ? await undoModel(mid, uid) : await redoModel(mid, uid);

        if (r.revision !== undefined) pushServer(r.revision, r.elements, r.violations);

        fetchActivity(mid).then((a) => {
          const evs = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
            id: Number(ev.id),

            userId: String(ev.userId ?? ev.user_id ?? ''),
            revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),

            createdAt: String(ev.createdAt ?? ev.created_at ?? ''),
            commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
          }));

          setAct(evs);
        });

        setStatus(u ? 'Undone' : 'Redone');
      } catch (e) {
        const label = u ? 'Undo' : 'Redo';
        const collaboration =
          e instanceof ApiHttpError ? formatCollaboration409Status(label, e) : null;
        if (collaboration) {
          setStatus(collaboration);
          return;
        }
        setStatus(e instanceof Error ? e.message : String(e));
      }
    },

    [pushServer, setAct],
  );

  useEffect(() => {
    void fetchBuildingPresets()
      .then((ids) => {
        if (ids.length) setCodePresetIds(ids);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cap = searchParams.get('evidence3dClipCapMm');
    const floor = searchParams.get('evidence3dClipFloorMm');
    if (cap === null && floor === null) return;
    const parseMm = (raw: string | null) => {
      if (raw === null || raw.trim() === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    if (cap !== null) setViewerClipElevMm(parseMm(cap));
    if (floor !== null) setViewerClipFloorElevMm(parseMm(floor));
  }, [searchParams, setViewerClipElevMm, setViewerClipFloorElevMm]);

  /* Boot */

  useEffect(() => {
    let cancel = false;

    void (async () => {
      try {
        await bootstrap();

        const bxRes = await fetch('/api/bootstrap');
        const bx = (await bxRes.json()) as Record<string, unknown>;
        const pj = bx.projects as Record<string, unknown>[] | undefined;
        const m0 = pj?.[0]?.models as Array<{ id?: unknown }> | undefined;

        const mid = m0?.[0]?.id;

        if (typeof mid !== 'string') throw new Error('No models — run make seed');
        const fs = await fetchSnap(mid);

        hydrateSnap(fs);

        fetchComments(mid).then((c) =>
          setCm(mapComments((c.comments ?? []) as Record<string, unknown>[])),
        );

        fetchActivity(mid).then((a) => {
          const evs = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
            id: Number(ev.id),

            userId: String(ev.userId ?? ev.user_id ?? ''),

            revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),

            createdAt: String(ev.createdAt ?? ev.created_at ?? ''),

            commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
          }));

          setAct(evs);
        });

        if (cancel) return;

        setBootErr(null);

        setStatus('Ready');

        /** E2E builds set VITE_E2E_DISABLE_WS — no backend; avoid Vite preview forwarding /ws to :8500. */
        const disableWs =
          typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
          ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());

        if (disableWs) {
          return;
        }

        const p = window.location.protocol === 'https:' ? 'wss' : 'ws';

        const ws = new WebSocket(`${p}://${window.location.host}/ws/${encodeURIComponent(mid)}`);

        wsRef.current = ws;

        ws.onopen = () => setWsOn(true);

        ws.onclose = () => setWsOn(false);

        ws.onmessage = (evt) => {
          const payload = JSON.parse(String(evt.data)) as Record<string, unknown>;

          const t = payload.type;

          if (t === 'snapshot') {
            const s = parseWs(payload);

            if (s) hydrateSnap(s);
          } else if (t === 'delta') {
            const dd = coerceDelta(payload);

            if (dd) applyDelta(dd as ModelDelta);
          } else if (t === 'presence_state') {
            const pl = payload.payload as Record<string, unknown> | undefined;

            const px = ((pl?.peers as Record<string, unknown>) ?? {}) as typeof peers;

            setPeers(px);
          } else if (t === 'comment_event') {
            const w = payload.payload as Record<string, unknown> | undefined;

            if (!w) return;

            mergeCm(mapComments([w])[0]!);
          }
        };
      } catch (e: unknown) {
        setBootErr(e instanceof Error ? e.message : String(e));

        setStatus('Boot failed');
      }
    })();

    return () => {
      cancel = true;

      wsRef.current?.close();

      wsRef.current = null;
    };
  }, [applyDelta, hydrateSnap, mergeCm, setAct, setCm, setPeers]);

  useEffect(() => {
    const id = window.setInterval(
      () => {
        const ws = wsRef.current;

        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const st = useBimStore.getState();

        ws.send(
          JSON.stringify({
            type: 'presence_update',

            peerId: st.peerId,

            userId: st.userId,

            name: st.userDisplayName,

            selectionId: st.selectedId,

            viewer: st.viewerMode,
          }),
        );
      },

      2300,
    );

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const kd = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      const tag = tgt?.tagName ?? '';
      const typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tgt?.closest('[contenteditable=true]');

      if (cheatsheetOpen && ev.key === 'Escape') {
        ev.preventDefault();
        setCheatsheetOpen(false);
        return;
      }

      if (!typing && ev.key === '?' && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        setCheatsheetOpen((o) => !o);
        return;
      }

      if (!typing && ev.key === ':' && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        setCmdBarFocus(true);
      }

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        void (ev.shiftKey ? undoRedo(false) : undoRedo(true));
      }

      if ((ev.metaKey || ev.ctrlKey) && ev.code === 'Space') {
        const cockpitLayouts: WorkspaceLayoutPreset[] = [
          'split_plan_3d',
          'split_plan_section',
          'coordination',
          'schedules_focus',
          'agent_review',
        ];
        if (!cockpitLayouts.includes(workspaceLayoutPreset)) {
          ev.preventDefault();
          void setVm(viewerMode === 'plan_canvas' ? 'orbit_3d' : 'plan_canvas');
        }
      }

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'p') {
        ev.preventDefault();
        window.print();
      }

      if (
        !typing &&
        viewerMode === 'plan_canvas' &&
        !ev.metaKey &&
        !ev.ctrlKey &&
        (ev.key === 'r' || ev.key === 'R')
      ) {
        ev.preventDefault();
        setTool(ev.shiftKey ? 'room' : 'room_rectangle');
      }

      if (ev.shiftKey) setOrtho(true);
    };

    const ku = (ev: KeyboardEvent) => {
      if (!ev.shiftKey) setOrtho(false);
    };

    window.addEventListener('keydown', kd);

    window.addEventListener('keyup', ku);

    return () => {
      window.removeEventListener('keydown', kd);

      window.removeEventListener('keyup', ku);
    };
  }, [cheatsheetOpen, setOrtho, setTool, setVm, undoRedo, viewerMode, workspaceLayoutPreset]);

  const onCmdSubmit = useCallback(
    (raw: string) => {
      const res = parseCommandLine(raw.trim(), {
        levelId: lvResolved || undefined,

        hudMm: planHudMm,
      });

      if (!res.ok) {
        setStatus(res.error);

        return;
      }

      void onSemantic(res.command);
    },
    [lvResolved, onSemantic, planHudMm],
  );

  const palette = useMemo(
    () => [
      {
        id: 'v',

        label: viewerMode === 'plan_canvas' ? '3D view' : 'Plan view',

        kbd: '⌘⇧Space',

        onSelect: () => setVm(viewerMode === 'plan_canvas' ? 'orbit_3d' : 'plan_canvas'),
      },

      { id: 'u', label: 'Undo', kbd: '⌘Z', onSelect: () => void undoRedo(true) },

      { id: 'r', label: 'Redo', kbd: '⌘⇧Z', onSelect: () => void undoRedo(false) },

      { id: 's', label: 'Tool select', onSelect: () => setTool('select') },

      { id: 'w', label: 'Tool wall', onSelect: () => setTool('wall') },

      { id: 'd', label: 'Tool door', onSelect: () => setTool('door') },

      { id: 'n', label: 'Tool window', onSelect: () => setTool('window') },

      {
        id: 'room',

        label: 'Tool room',

        onSelect: () => setTool('room'),
      },

      {
        id: 'roomRect',

        label: 'Room rectangle',

        onSelect: () => setTool('room_rectangle'),
      },

      { id: 'g', label: 'Tool grid', onSelect: () => setTool('grid') },

      {
        id: 'x',

        label: 'Tool dimension',

        onSelect: () => setTool('dimension'),
      },
    ],

    [setTool, setVm, undoRedo, viewerMode],
  );

  const explorer = useMemo(() => Object.values(elementsById), [elementsById]);

  const planViewTemplates = useMemo(
    () =>
      Object.values(elementsById).filter((e): e is Extract<Element, { kind: 'view_template' }> => {
        return e.kind === 'view_template';
      }),
    [elementsById],
  );

  const visiblePlanTools = useMemo(
    () => [...planToolsForPerspective(perspectiveId)],
    [perspectiveId],
  );

  useEffect(() => {
    if (!visiblePlanTools.includes(planTool)) setTool('select');
  }, [planTool, setTool, visiblePlanTools]);

  const cockpitLayouts: WorkspaceLayoutPreset[] = [
    'split_plan_3d',
    'split_plan_section',
    'coordination',
    'schedules_focus',
    'agent_review',
  ];

  const planSurfaceVisible =
    cockpitLayouts.includes(workspaceLayoutPreset) || viewerMode === 'plan_canvas';

  const hideSchedulePanelRight = workspaceLayoutPreset === 'schedules_focus';

  const activeLevelLabel =
    levels.find((l) => l.id === lvResolved)?.name ?? (lvResolved ? lvResolved : '—');

  const renderPrimaryCanvas = (): ReactNode => {
    const plan = (
      <PlanCanvas
        wsConnected={wsOn}
        activeLevelResolvedId={lvResolved}
        onSemanticCommand={(c) => void onSemantic(c)}
      />
    );

    switch (workspaceLayoutPreset) {
      case 'schedules_focus':
        return (
          <div className="flex min-h-[360px] flex-col gap-2 xl:flex-row">
            <div className="min-w-0 flex-1">{plan}</div>
            <div className="min-w-[260px] xl:w-[40%]">
              <Panel title="Schedules (focused)">
                <SchedulePanel
                  modelId={modelId}
                  elementsById={elementsById}
                  activeLevelId={lvResolved || undefined}
                  onScheduleFiltersCommit={(scheduleId, filters, grouping) =>
                    void onSemantic({
                      type: 'upsertScheduleFilters',
                      scheduleId,
                      filters,
                      ...(grouping && Object.keys(grouping).length > 0 ? { grouping } : {}),
                    })
                  }
                />
              </Panel>
            </div>
          </div>
        );
      case 'split_plan_3d':
        return (
          <div className="grid min-h-[360px] grid-cols-1 gap-2 xl:grid-cols-2">
            {plan}
            <Viewport wsConnected={wsOn} />
          </div>
        );
      case 'split_plan_section':
        return (
          <div className="flex flex-col gap-2">
            {plan}
            <SectionPlaceholderPane activeLevelLabel={activeLevelLabel} />
          </div>
        );

      case 'coordination':
        return (
          <div className="flex flex-col gap-2">
            {plan}

            <SectionPlaceholderPane activeLevelLabel={activeLevelLabel} />

            <Panel title="Sheet canvas (preview)">
              <SheetCanvas
                modelId={modelId ?? undefined}
                elementsById={elementsById}
                preferredSheetId="hf-sheet-ga01"
                evidenceFullBleed={evidenceSheetFull}
                onUpsertSemantic={(cmd) => void onSemantic(cmd)}
              />
            </Panel>
          </div>
        );
      case 'agent_review':
        return (
          <div className="flex flex-col gap-2">
            {plan}
            <Panel title="Agent cockpit">
              <AgentReviewPane />
            </Panel>
          </div>
        );
      default:
        return viewerMode === 'plan_canvas' ? plan : <Viewport wsConnected={wsOn} />;
    }
  };

  return (
    <div className="min-h-[100vh]">
      <div className="border-b border-border bg-surface/70 px-4 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase text-muted">BIM AI v2</div>

            <div className="text-lg font-semibold">Floor plan + 3D</div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>
                r{revision} {status}
              </span>

              <select
                className="rounded border border-border bg-background px-2 py-1 text-[11px]"
                value={workspaceLayoutPreset}
                onChange={(e) => setWorkspaceLayoutPreset(e.target.value as WorkspaceLayoutPreset)}
              >
                {LAYOUT_PRESET_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    Layout: {o.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded border border-border bg-background px-2 py-1 text-[11px]"
                value={perspectiveId}
                onChange={(e) => setPerspectiveId(e.target.value as PerspectiveId)}
              >
                {PERSPECTIVE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded border border-border bg-background px-2 py-1 text-[11px]"
                disabled={cockpitLayouts.includes(workspaceLayoutPreset)}
                title={
                  cockpitLayouts.includes(workspaceLayoutPreset)
                    ? 'Classic view toggle is superseded by the layout preset.'
                    : undefined
                }
                value={viewerMode}
                onChange={(e) => setVm(e.target.value as typeof viewerMode)}
              >
                <option value="orbit_3d">3D</option>

                <option value="plan_canvas">Plan</option>
              </select>

              <input
                className="w-32 rounded border border-border bg-background px-2 py-1 text-[11px]"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setIdentity(userId, displayName, peerId)}
                placeholder="Name"
              />

              {Object.values(peers)

                .slice(0, 6)

                .map((p, i) => (
                  <span key={i} className="rounded border px-1 text-[10px]">
                    {(p.name ?? '?').slice(0, 2)}
                  </span>
                ))}
            </div>

            {bootErr ? <div className="text-xs text-red-600">{bootErr}</div> : null}
          </div>

          <div className="flex gap-2">
            <Btn type="button" onClick={() => setPaletteOpen(true)}>
              ⌘K
            </Btn>

            <Btn type="button" variant="quiet" onClick={() => void toggleStoredTheme()}>
              Theme
            </Btn>
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={palette} />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-3 p-3 lg:grid-cols-[260px_1fr_300px]">
        <div className="flex flex-col gap-3">
          {planSurfaceVisible ? (
            <Panel title="Tools">
              <div className="flex flex-wrap gap-1">
                {visiblePlanTools.map((k) => (
                  <Btn
                    key={k}
                    type="button"
                    variant={planTool === k ? undefined : 'quiet'}
                    className="px-2 py-1 text-[11px]"
                    onClick={() => setTool(k)}
                  >
                    {TOOL_BTN_LABEL[k]}
                  </Btn>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-muted">
                Shift+drag pan · Shift ortho · Esc cancel
              </p>

              <label className="mt-3 block text-[10px] text-muted">
                Plan style
                <select
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                  value={planPresentationPreset}
                  title={
                    activePlanViewId
                      ? 'Writes to the active plan_view (replayable)'
                      : 'Session-only preset until you open a saved plan_view'
                  }
                  onChange={(e) => {
                    const next = e.target.value as PlanPresentationPreset;
                    setPlanPresentationPreset(next);

                    try {
                      localStorage.setItem('bim.planPresentation', next);
                    } catch {
                      /* noop */
                    }

                    const apv = useBimStore.getState().activePlanViewId;
                    if (apv) {
                      void onSemantic({
                        type: 'updateElementProperty',

                        elementId: apv,

                        key: 'planPresentation',

                        value: next,
                      });

                      return;
                    }

                    activatePlanView(undefined);
                  }}
                >
                  <option value="default">Neutral (walls + rooms)</option>

                  <option value="opening_focus">Openings-first (plan demos)</option>

                  <option value="room_scheme">Room color fills</option>
                </select>
              </label>
            </Panel>
          ) : null}

          <LevelStack
            levels={levels}
            activeId={lvResolved}
            setActive={(id) => setLv(id)}
            onElevationCommitted={(levelId, elevationMm) =>
              void onSemantic({ type: 'moveLevelElevation', levelId, elevationMm })
            }
          />

          <Panel title="Project browser">
            <ProjectBrowser
              elementsById={elementsById}
              onUpsertSemantic={(cmd) => void onSemantic(cmd)}
            />
          </Panel>

          <Panel title="3D layers">
            {activeViewpointId && viewerMode === 'orbit_3d' ? (
              <p className="mb-2 text-[10px] text-muted">
                Section box / layer toggles update saved viewpoint{' '}
                <span className="font-mono">{activeViewpointId}</span>.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              {VIEWER_HIDDEN_KIND_KEYS.map((lk) => (
                <label key={lk} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!viewerCategoryHidden[lk]}
                    onChange={() => {
                      toggleViewerCategoryHidden(lk);
                      void persistViewpointHiddenKinds();
                    }}
                  />

                  <span>{lk}</span>
                </label>
              ))}
            </div>

            <label className="mt-2 block text-[10px] text-muted">
              Section box — cap Y (mm, clips above; empty = off)
              <input
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                placeholder="e.g. 5600"
                inputMode="numeric"
                value={viewerClipElevMm ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();

                  if (raw === '') {
                    setViewerClipElevMm(null);
                    return;
                  }

                  const n = Number(raw);
                  setViewerClipElevMm(Number.isFinite(n) ? n : null);
                }}
                onBlur={() => void persistViewpointClipPlanes()}
              />
            </label>

            <label className="mt-2 block text-[10px] text-muted">
              Section box — floor Y (mm, clips below; empty = off)
              <input
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                placeholder="e.g. 2500"
                inputMode="numeric"
                value={viewerClipFloorElevMm ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();

                  if (raw === '') {
                    setViewerClipFloorElevMm(null);
                    return;
                  }

                  const n = Number(raw);
                  setViewerClipFloorElevMm(Number.isFinite(n) ? n : null);
                }}
                onBlur={() => void persistViewpointClipPlanes()}
              />
            </label>
          </Panel>

          <Panel title="Explorer">
            <ul className="max-h-[50vh] space-y-1 overflow-auto text-xs">
              {explorer

                .sort((a, b) => a.kind.localeCompare(b.kind))

                .map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={[
                        'w-full rounded px-2 py-1 text-left',

                        selectedId === e.id ? 'bg-accent/25' : 'hover:bg-accent/10',
                      ].join(' ')}
                      onClick={() => selectEl(e.id)}
                    >
                      {e.kind} ·
                      {'name' in e && typeof (e as { name?: string }).name === 'string'
                        ? (e as { name: string }).name
                        : e.kind === 'issue'
                          ? (e as { title: string }).title
                          : e.id}
                    </button>
                  </li>
                ))}
            </ul>
          </Panel>

          <Panel title="WS">
            <div className="text-xs">{wsOn ? 'connected' : 'offline'}</div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          {renderPrimaryCanvas()}

          <Panel title="Issues & constraints">
            <ul className="max-h-40 space-y-1 overflow-auto text-xs">
              {explorer

                .filter((e): e is Extract<Element, { kind: 'issue' }> => e.kind === 'issue')

                .map((is) => (
                  <li key={is.id}>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => selectEl(is.id)}
                    >
                      {is.title}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="mt-3 text-[10px] text-muted">
              Model checks live in Advisor →{' '}
              {!violations.length ? 'all clear.' : `${violations.length} advisory row(s)`}
            </div>
          </Panel>

          <Panel title="Activity">
            <ul className="max-h-32 space-y-1 overflow-auto text-[11px] text-muted">
              {activities.map((a) => (
                <li key={a.id}>
                  r{a.revisionAfter} · {a.commandTypes[0] ?? '?'}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Inspector">
            {selected?.kind === 'plan_view' ? (
              <div className="mb-3 space-y-2 text-[11px]">
                <div className="font-semibold text-muted">Saved plan_view (replayable edits)</div>
                <label className="block text-[10px] text-muted">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.name}
                    key={`pv-name-${selected.id}-${selected.name}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === selected.name) return;
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'name',
                        value: v,
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Plan presentation (stored)
                  <select
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                    value={selected.planPresentation ?? 'default'}
                    onChange={(e) => {
                      const next = e.target.value as PlanPresentationPreset | string;
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'planPresentation',

                        value: next,
                      });
                      const norm: PlanPresentationPreset =
                        next === 'opening_focus' || next === 'room_scheme' ? next : 'default';
                      setPlanPresentationPreset(norm);
                      try {
                        localStorage.setItem('bim.planPresentation', norm);
                      } catch {
                        /* noop */
                      }
                    }}
                  >
                    <option value="default">Neutral</option>
                    <option value="opening_focus">Opening focus</option>
                    <option value="room_scheme">Room scheme</option>
                  </select>
                </label>
                <label className="block text-[10px] text-muted">
                  Underlay level (optional)
                  <select
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                    value={
                      selected.underlayLevelId &&
                      levels.some((lv) => lv.id === selected.underlayLevelId)
                        ? selected.underlayLevelId
                        : ''
                    }
                    onChange={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'underlayLevelId',
                        value: e.target.value,
                      });
                    }}
                  >
                    <option value="">none</option>
                    {levels.map((lv) => (
                      <option key={lv.id} value={lv.id}>
                        {lv.name}
                      </option>
                    ))}
                  </select>
                </label>
                {planViewTemplates.length ? (
                  <label className="block text-[10px] text-muted">
                    View template
                    <select
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                      value={
                        selected.viewTemplateId &&
                        planViewTemplates.some((vt) => vt.id === selected.viewTemplateId)
                          ? selected.viewTemplateId
                          : ''
                      }
                      onChange={(e) => {
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'viewTemplateId',
                          value: e.target.value,
                        });
                      }}
                    >
                      <option value="">none</option>
                      {planViewTemplates.map((vt) => (
                        <option key={vt.id} value={vt.id}>
                          {vt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <SavedViewTagGraphicsAuthoring
                  variant="plan_view"
                  selected={selected}
                  revision={revision}
                  elementsById={elementsById}
                  onPersistProperty={(key, value) => {
                    void onSemantic({
                      type: 'updateElementProperty',
                      elementId: selected.id,
                      key,
                      value,
                    });
                  }}
                />

                <div className="border-border mt-3 space-y-2 border-t pt-2">
                  <div className="font-semibold text-muted">Crop (2D, mm)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] text-muted">
                      cropMin X
                      <input
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                        value={planCropDraft.minX}
                        onChange={(e) => setPlanCropDraft((d) => ({ ...d, minX: e.target.value }))}
                      />
                    </label>
                    <label className="block text-[10px] text-muted">
                      cropMin Y
                      <input
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                        value={planCropDraft.minY}
                        onChange={(e) => setPlanCropDraft((d) => ({ ...d, minY: e.target.value }))}
                      />
                    </label>
                    <label className="block text-[10px] text-muted">
                      cropMax X
                      <input
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                        value={planCropDraft.maxX}
                        onChange={(e) => setPlanCropDraft((d) => ({ ...d, maxX: e.target.value }))}
                      />
                    </label>
                    <label className="block text-[10px] text-muted">
                      cropMax Y
                      <input
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                        value={planCropDraft.maxY}
                        onChange={(e) => setPlanCropDraft((d) => ({ ...d, maxY: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Btn
                      type="button"
                      className="flex-1 text-[10px]"
                      onClick={() => {
                        const nx = Number(planCropDraft.minX);
                        const ny = Number(planCropDraft.minY);
                        const xx = Number(planCropDraft.maxX);
                        const xy = Number(planCropDraft.maxY);
                        if (![nx, ny, xx, xy].every((n) => Number.isFinite(n))) {
                          setStatus('Crop apply: enter four finite mm numbers');
                          return;
                        }
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'cropMinMm',
                          value: JSON.stringify({ xMm: nx, yMm: ny }),
                        });
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'cropMaxMm',
                          value: JSON.stringify({ xMm: xx, yMm: xy }),
                        });
                      }}
                    >
                      Apply crop
                    </Btn>
                    <Btn
                      type="button"
                      variant="quiet"
                      className="flex-1 text-[10px]"
                      onClick={() => {
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'cropMinMm',
                          value: '',
                        });
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'cropMaxMm',
                          value: '',
                        });
                      }}
                    >
                      Clear crop
                    </Btn>
                  </div>
                </div>

                <div className="border-border mt-3 space-y-2 border-t pt-2">
                  <div className="font-semibold text-muted">View range / cut</div>
                  <label className="block text-[10px] text-muted">
                    View range bottom (mm)
                    <input
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                      key={`pv-vrb-${selected.id}-${selected.viewRangeBottomMm ?? 'null'}-${revision}`}
                      defaultValue={
                        selected.viewRangeBottomMm == null ? '' : String(selected.viewRangeBottomMm)
                      }
                      placeholder="empty clears"
                      type="text"
                      inputMode="decimal"
                      onBlur={(e) => {
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'viewRangeBottomMm',
                          value: e.target.value.trim(),
                        });
                      }}
                    />
                  </label>
                  <label className="block text-[10px] text-muted">
                    View range top (mm)
                    <input
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                      key={`pv-vrt-${selected.id}-${selected.viewRangeTopMm ?? 'null'}-${revision}`}
                      defaultValue={
                        selected.viewRangeTopMm == null ? '' : String(selected.viewRangeTopMm)
                      }
                      placeholder="empty clears"
                      type="text"
                      inputMode="decimal"
                      onBlur={(e) => {
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'viewRangeTopMm',
                          value: e.target.value.trim(),
                        });
                      }}
                    />
                  </label>
                  <label className="block text-[10px] text-muted">
                    Cut plane offset (mm)
                    <input
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                      key={`pv-cpo-${selected.id}-${selected.cutPlaneOffsetMm ?? 'null'}-${revision}`}
                      defaultValue={
                        selected.cutPlaneOffsetMm == null ? '' : String(selected.cutPlaneOffsetMm)
                      }
                      placeholder="empty clears"
                      type="text"
                      inputMode="decimal"
                      onBlur={(e) => {
                        void onSemantic({
                          type: 'updateElementProperty',
                          elementId: selected.id,
                          key: 'cutPlaneOffsetMm',
                          value: e.target.value.trim(),
                        });
                      }}
                    />
                  </label>
                </div>

                <PlanViewGraphicsMatrix rows={inspectorGraphicsMatrixRows} />
              </div>
            ) : null}
            {selected?.kind === 'view_template' ? (
              <div className="mb-3 space-y-2 text-[11px]">
                <div className="font-semibold text-muted">View template (replayable defaults)</div>
                <label className="block text-[10px] text-muted">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.name}
                    key={`vt-name-${selected.id}-${selected.name}-${revision}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === selected.name) return;
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'name',
                        value: v,
                      });
                    }}
                  />
                </label>
                <SavedViewTemplateGraphicsAuthoring
                  selected={selected}
                  revision={revision}
                  elementsById={elementsById}
                  onPersistProperty={(key, value) => {
                    void onSemantic({
                      type: 'updateElementProperty',
                      elementId: selected.id,
                      key,
                      value,
                    });
                  }}
                />
                <PlanViewGraphicsMatrix
                  rows={inspectorGraphicsMatrixRows}
                  footnote="view_template readout: Template column is —; Stored is persisted JSON; Effective uses the same resolution rules as plan symbology (default presentation, resolved detail for line weight)."
                />
              </div>
            ) : null}
            {selected?.kind === 'viewpoint' ? (
              <div className="mb-3 space-y-2 text-[11px]">
                <div className="font-semibold text-muted">
                  Saved viewpoint (clip + layer toggles persist while active)
                </div>
                <label className="block text-[10px] text-muted">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.name}
                    key={`vp-name-${selected.id}-${selected.name}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === selected.name) return;
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'name',
                        value: v,
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}
            {selected?.kind === 'room' ? (
              <div className="mb-3 space-y-2 text-[11px]">
                <div className="font-semibold text-muted">Room programme & finishes</div>
                <label className="block text-[10px] text-muted">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.name}
                    key={`rm-name-${selected.id}-${selected.name}-${revision}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === selected.name) return;
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'name',
                        value: v,
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Programme code
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.programmeCode ?? ''}
                    key={`rm-pc-${selected.id}-${selected.programmeCode ?? ''}-${revision}`}
                    onBlur={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'programmeCode',
                        value: e.target.value.trim(),
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Department
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.department ?? ''}
                    key={`rm-dep-${selected.id}-${selected.department ?? ''}-${revision}`}
                    onBlur={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'department',
                        value: e.target.value.trim(),
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Function label
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.functionLabel ?? ''}
                    key={`rm-fn-${selected.id}-${selected.functionLabel ?? ''}-${revision}`}
                    onBlur={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'functionLabel',
                        value: e.target.value.trim(),
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Finish set
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    defaultValue={selected.finishSet ?? ''}
                    key={`rm-fs-${selected.id}-${selected.finishSet ?? ''}-${revision}`}
                    onBlur={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'finishSet',
                        value: e.target.value.trim(),
                      });
                    }}
                  />
                </label>
                <label className="block text-[10px] text-muted">
                  Target area (m²); empty on blur clears
                  <input
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    placeholder="optional"
                    type="text"
                    inputMode="decimal"
                    defaultValue={
                      selected.targetAreaM2 == null ? '' : String(selected.targetAreaM2)
                    }
                    key={`rm-tgt-${selected.id}-${selected.targetAreaM2 ?? 'x'}-${revision}`}
                    onBlur={(e) => {
                      void onSemantic({
                        type: 'updateElementProperty',
                        elementId: selected.id,
                        key: 'targetAreaM2',
                        value: e.target.value.trim(),
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}
            <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap text-[11px]">
              {JSON.stringify(selected ?? { hint: 'pick' }, null, 2)}
            </pre>
          </Panel>

          <SiteAuthoringPanel
            revision={revision}
            elementsById={elementsById}
            levels={levels}
            onUpsertSemantic={(cmd) => void onSemantic(cmd)}
          />

          <RoomColorSchemePanel onUpsertSemantic={(cmd) => void onSemantic(cmd)} />

          <Panel title="Advisor">
            <AdvisorPanel
              violations={violations}
              selectionId={selectedId}
              preset={buildingPreset}
              onPreset={setBuildingPreset}
              codePresets={codePresetIds}
              onApplyQuickFix={(cmd) => void onSemantic(cmd)}
              perspective={perspectiveId}
            />
          </Panel>

          {!hideSchedulePanelRight ? (
            <Panel title="Schedules">
              <SchedulePanel
                modelId={modelId}
                elementsById={elementsById}
                activeLevelId={lvResolved || undefined}
                onScheduleFiltersCommit={(scheduleId, filters, grouping) =>
                  void onSemantic({
                    type: 'upsertScheduleFilters',
                    scheduleId,
                    filters,
                    ...(grouping && Object.keys(grouping).length > 0 ? { grouping } : {}),
                  })
                }
              />
            </Panel>
          ) : (
            <div className="rounded border border-dashed border-border p-3 text-[11px] text-muted">
              Schedules docked beside plan (Schedules-focus layout).
            </div>
          )}

          <Panel title="Comments">
            <textarea
              className="mt-1 w-full rounded border bg-background p-2 text-sm"
              rows={3}
              value={commentTxt}
              onChange={(e) => setCommentTxt(e.target.value)}
            />

            <Btn
              type="button"
              className="mt-2 w-full"
              onClick={() =>
                void (async () => {
                  if (!modelId || !commentTxt.trim()) return;

                  await postComment(modelId, {
                    userDisplay: displayName || 'Guest',

                    body: commentTxt.trim(),

                    levelId: lvResolved,

                    elementId: selected?.id,
                  });

                  setCommentTxt('');

                  const c = await fetchComments(modelId);

                  setCm(mapComments((c.comments ?? []) as Record<string, unknown>[]));
                })()
              }
            >
              Post
            </Btn>

            <ul className="mt-2 max-h-[35vh] space-y-2 overflow-auto text-xs">
              {cmts.map((c) => (
                <li key={c.id} className="rounded border p-2">
                  <div className="font-semibold">{c.userDisplay}</div>

                  <div className="text-muted">{c.body}</div>

                  <Btn
                    type="button"
                    variant="quiet"
                    className="mt-1 text-[11px]"
                    onClick={() =>
                      void (async () => {
                        if (!modelId) return;

                        await patchCommentResolved(modelId, c.id, !c.resolved);

                        const cl = await fetchComments(modelId);

                        setCm(mapComments((cl.comments ?? []) as Record<string, unknown>[]));
                      })()
                    }
                  >
                    {c.resolved ? 'reopen' : 'resolve'}
                  </Btn>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Welcome
        visible={welcomeOpen}
        onDismiss={() => setWelcomeOpen(false)}
        onRoomRectTool={() => {
          setTool('room_rectangle');
          setVm('plan_canvas');

          setWelcomeOpen(false);
        }}
      />

      <Cheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
        viewerMode={viewerMode}
      />

      <CommandBar expanded={cmdBarFocus} onExpandedChange={setCmdBarFocus} onSubmit={onCmdSubmit} />
    </div>
  );
}
