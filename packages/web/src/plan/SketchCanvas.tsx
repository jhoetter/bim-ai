/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
/**
 * SKT-01 / SKT-02 / SKT-03 — Sketch authoring overlay.
 *
 * Mounts as an absolute overlay above `PlanCanvas` while a sketch session is
 * open. Renders the in-progress sketch as turquoise lines (Revit convention),
 * shows the validation status, and exposes Line / Rectangle / Pick Walls
 * drawing modes plus Finish ✓ / Cancel ✗ controls. Esc cancels.
 *
 * SKT-02 (Pick Walls) — clicking a wall in pick mode toggles it in/out of the
 * session's `picked_walls`; the server re-derives the sketch lines using the
 * configured offset mode and auto-trims corners.
 *
 * SKT-03 (validation feedback) — open vertices and self-intersections are
 * highlighted in red; a status panel lists all issues; Tab cycles between
 * issues; an "Auto-close" one-click fix joins a single open gap.
 *
 * Coordinate mapping is delegated to two callback refs supplied by the parent
 * canvas — that way we don't reimplement the orthographic camera math and stay
 * in sync with pan / zoom automatically.
 */

import {
  type CSSProperties,
  type JSX,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  hitTestWallAtMm,
  hitTestWallAtScreen,
  OffsetModeChip,
  type WallForPicking,
} from './SketchCanvasPickWalls';
import {
  addSketchLine,
  cancelSketchSession,
  finishSketchSession,
  getSketchSession,
  openSketchSession,
  pickWall,
  setPickWallsOffsetMode,
  type PickWallsOffsetMode,
  type SketchElementKind,
  type SketchSessionWire,
  type SketchValidationIssue,
  type SketchValidationState,
} from './sketchApi';
import { expandFootprintByOverhang } from './roofByFootprint';
import { validateBoundary } from './structuralValidation';

const TURQUOISE = '#3fc5d3';
const TURQUOISE_FAINT = 'rgba(63, 197, 211, 0.45)';
const VERTEX_FILL = '#0e8b9c';
const ERROR_RED = '#ef4444';
const ERROR_GLOW = 'rgba(239, 68, 68, 0.35)';

export type Point2D = { xMm: number; yMm: number };

export type PointerToMm = (clientX: number, clientY: number) => Point2D | null;
export type MmToScreen = (pt: Point2D) => { x: number; y: number } | null;

export type SketchTool = 'line' | 'rectangle' | 'pick';

export interface SketchCanvasProps {
  modelId: string;
  levelId: string;
  /** Element kind to author (default: floor). */
  elementKind?: SketchElementKind;
  /** Optional pre-existing session id; when present we hydrate it instead of opening fresh. */
  sessionId?: string;
  /** Read-only refs that read live camera state from the parent canvas. */
  pointerToMmRef: RefObject<PointerToMm | null>;
  mmToScreenRef: RefObject<MmToScreen | null>;
  /** SKT-02: walls available for Pick Walls. Pass an empty array to hide the tool. */
  wallsForPicking?: WallForPicking[];
  /** Called when the user finishes the session and the element commits. */
  onFinished: (createdId: string | null) => void;
  /** Called on cancel (Esc, ✗ button, or session error). */
  onCancelled: () => void;
  /** F-108: floor type id to apply when finishing a floor sketch session. */
  floorTypeId?: string;
  /** Extra options forwarded to finishSketchSession (e.g. hostViewId for masking regions). */
  extraOptions?: Record<string, unknown>;
}

function snapMm(p: Point2D, snapMmGrid: number): Point2D {
  return {
    xMm: Math.round(p.xMm / snapMmGrid) * snapMmGrid,
    yMm: Math.round(p.yMm / snapMmGrid) * snapMmGrid,
  };
}

function _vertexKey(p: Point2D, eps = 0.5): string {
  return `${Math.round(p.xMm / eps)}|${Math.round(p.yMm / eps)}`;
}

/**
 * Walk line segments into an ordered polygon vertex list.
 * Returns null if segments don't form a single closed loop.
 */
function orderedPolygonFromLines(
  lines: { fromMm: Point2D; toMm: Point2D }[],
  eps = 0.5,
): Point2D[] | null {
  if (lines.length < 3) return null;
  const key = (p: Point2D) => `${Math.round(p.xMm / eps)}|${Math.round(p.yMm / eps)}`;
  const adj = new Map<string, { pt: Point2D; neighbors: Point2D[] }>();
  for (const ln of lines) {
    for (const [a, b] of [
      [ln.fromMm, ln.toMm],
      [ln.toMm, ln.fromMm],
    ] as [Point2D, Point2D][]) {
      const ka = key(a);
      let entry = adj.get(ka);
      if (!entry) {
        entry = { pt: a, neighbors: [] };
        adj.set(ka, entry);
      }
      entry.neighbors.push(b);
    }
  }
  const start = [...adj.values()][0]!;
  const visited = new Set<string>();
  const polygon: Point2D[] = [start.pt];
  visited.add(key(start.pt));
  let current = start;
  for (let i = 1; i < lines.length; i++) {
    const next = current.neighbors.find((n) => !visited.has(key(n)));
    if (!next) return null;
    polygon.push(next);
    visited.add(key(next));
    current = adj.get(key(next))!;
    if (!current) return null;
  }
  return polygon;
}

/** Vertices that have ≠ 2 incident edges → highlighted red in the canvas. */
function openVerticesForLines(lines: { fromMm: Point2D; toMm: Point2D }[]): Point2D[] {
  const incidence = new Map<string, { pt: Point2D; count: number }>();
  for (const ln of lines) {
    for (const pt of [ln.fromMm, ln.toMm]) {
      const k = _vertexKey(pt);
      const cur = incidence.get(k);
      if (cur) cur.count += 1;
      else incidence.set(k, { pt, count: 1 });
    }
  }
  return [...incidence.values()].filter((v) => v.count !== 2).map((v) => v.pt);
}

/**
 * SKT-03: detect a single missing closing segment between two unique open
 * endpoints. When exactly two open vertices exist, "Auto-close" can connect
 * them with one extra sketch line.
 */
function autoCloseCandidate(
  lines: { fromMm: Point2D; toMm: Point2D }[],
): [Point2D, Point2D] | null {
  const opens = openVerticesForLines(lines);
  if (opens.length !== 2) return null;
  return [opens[0]!, opens[1]!];
}

export function SketchCanvas(props: SketchCanvasProps): JSX.Element {
  const {
    modelId,
    levelId,
    elementKind = 'floor',
    pointerToMmRef,
    mmToScreenRef,
    wallsForPicking,
    onFinished,
    onCancelled,
    sessionId: initialSessionId,
    floorTypeId,
    extraOptions,
  } = props;
  const [session, setSession] = useState<SketchSessionWire | null>(null);
  const [validation, setValidation] = useState<SketchValidationState | null>(null);
  const [tool, setTool] = useState<SketchTool>('line');
  const [pendingStart, setPendingStart] = useState<Point2D | null>(null);
  const [hover, setHover] = useState<Point2D | null>(null);
  const [hoverWallId, setHoverWallId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIssueIndex, setActiveIssueIndex] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SketchSessionWire | null>(null);
  const onFinishedRef = useRef(onFinished);
  const onCancelledRef = useRef(onCancelled);
  // Tick to force re-render on pointer move so SVG vertices reflect pan / zoom.
  const [, setTick] = useState(0);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    onCancelledRef.current = onCancelled;
  }, [onCancelled]);

  // Open or hydrate a session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = initialSessionId
          ? await getSketchSession(initialSessionId)
          : await openSketchSession(modelId, levelId, { elementKind });
        if (cancelled) return;
        sessionRef.current = resp.session;
        setSession(resp.session);
        setValidation(resp.validation);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          onCancelledRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, levelId, elementKind, initialSessionId]);

  const handleCancel = useCallback(async () => {
    const activeSession = sessionRef.current ?? session;
    if (!activeSession) {
      onCancelledRef.current();
      return;
    }
    try {
      setBusy(true);
      await cancelSketchSession(activeSession.sessionId);
    } catch {
      // Cancel failures shouldn't block the UX; we drop the overlay regardless.
    } finally {
      sessionRef.current = null;
      setBusy(false);
      onCancelledRef.current();
    }
  }, [session]);

  const issues = useMemo<SketchValidationIssue[]>(() => validation?.issues ?? [], [validation]);

  const clientToOverlayScreen = useCallback((clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // SKT-03: Tab cycles through issues, zooming the canvas to the first
  // affected line. We expose only the index here; the parent canvas does the
  // actual camera move via the `onIssueFocused` handler if it ever wires one.
  // For the load-bearing slice we just visually flag the active issue.
  const focusNextIssue = useCallback(() => {
    if (issues.length === 0) return;
    setActiveIssueIndex((i) => (i + 1) % issues.length);
  }, [issues.length]);

  // Esc cancels; L / R / P switch tools; Tab cycles validation issues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void handleCancel();
        return;
      }
      if (e.key === 'Tab' && issues.length > 0) {
        e.preventDefault();
        focusNextIssue();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'l') {
        setTool('line');
        setPendingStart(null);
      } else if (k === 'r') {
        setTool('rectangle');
        setPendingStart(null);
      } else if (k === 'p' && wallsForPicking && wallsForPicking.length > 0) {
        setTool('pick');
        setPendingStart(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleCancel, focusNextIssue, issues.length, wallsForPicking]);

  const handlePointerDown = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (!session || session.status !== 'open' || busy) return;

      if (tool === 'pick') {
        const walls = wallsForPicking ?? [];
        const screenPt = clientToOverlayScreen(e.clientX, e.clientY);
        const screenHit = hitTestWallAtScreen(walls, screenPt, mmToScreenRef.current);
        const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
        const wallId = screenHit ?? (ptMm ? hitTestWallAtMm(walls, ptMm) : null);
        if (!wallId) return;
        try {
          setBusy(true);
          const resp = await pickWall(session.sessionId, wallId);
          setSession(resp.session);
          setValidation(resp.validation);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
        return;
      }

      const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
      if (!ptMm) return;
      const snapped = snapMm(ptMm, 100);
      if (tool === 'line') {
        if (pendingStart === null) {
          setPendingStart(snapped);
          return;
        }
        try {
          setBusy(true);
          const resp = await addSketchLine(session.sessionId, pendingStart, snapped);
          setSession(resp.session);
          setValidation(resp.validation);
          // Chain mode: next click extends from the line just placed.
          setPendingStart(snapped);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      } else if (tool === 'rectangle') {
        if (pendingStart === null) {
          setPendingStart(snapped);
          return;
        }
        const a = pendingStart;
        const c = snapped;
        const corners: Point2D[] = [
          { xMm: a.xMm, yMm: a.yMm },
          { xMm: c.xMm, yMm: a.yMm },
          { xMm: c.xMm, yMm: c.yMm },
          { xMm: a.xMm, yMm: c.yMm },
        ];
        try {
          setBusy(true);
          let resp = await addSketchLine(session.sessionId, corners[0]!, corners[1]!);
          resp = await addSketchLine(session.sessionId, corners[1]!, corners[2]!);
          resp = await addSketchLine(session.sessionId, corners[2]!, corners[3]!);
          resp = await addSketchLine(session.sessionId, corners[3]!, corners[0]!);
          setSession(resp.session);
          setValidation(resp.validation);
          setPendingStart(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }
    },
    [
      session,
      busy,
      pointerToMmRef,
      mmToScreenRef,
      clientToOverlayScreen,
      tool,
      pendingStart,
      wallsForPicking,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === 'pick') {
        const walls = wallsForPicking ?? [];
        const screenPt = clientToOverlayScreen(e.clientX, e.clientY);
        const screenHit = hitTestWallAtScreen(walls, screenPt, mmToScreenRef.current);
        const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
        if (ptMm) setHover(snapMm(ptMm, 100));
        setTick((t) => (t + 1) % 1_000_000);
        setHoverWallId(screenHit ?? (ptMm ? hitTestWallAtMm(walls, ptMm) : null));
        return;
      }

      const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
      if (!ptMm) return;
      setHover(snapMm(ptMm, 100));
      setTick((t) => (t + 1) % 1_000_000);
      if (hoverWallId !== null) {
        setHoverWallId(null);
      }
    },
    [pointerToMmRef, mmToScreenRef, clientToOverlayScreen, tool, wallsForPicking, hoverWallId],
  );

  const handleFinish = useCallback(async () => {
    if (!session || busy) return;
    // Pre-commit client-side boundary validation — catches self-intersecting or
    // degenerate polygons before the round-trip to the server.
    const polygon = orderedPolygonFromLines(session.lines);
    if (polygon) {
      const issues = validateBoundary(session.sessionId, polygon);
      const blocking = issues.filter((i) => i.severity === 'error');
      if (blocking.length > 0) {
        setError(blocking.map((i) => i.message).join(' '));
        return;
      }
    }
    // WP-NEXT-45: for roof sketches, expand the sketched polygon by the
    // configured overhang before sending so the server sees the final footprint.
    let roofFootprintOptions: Record<string, unknown> | undefined;
    if (elementKind === 'roof' && polygon) {
      const overhangMm = typeof extraOptions?.overhangMm === 'number' ? extraOptions.overhangMm : 0;
      roofFootprintOptions = {
        footprintMm: expandFootprintByOverhang(polygon, overhangMm),
      };
    }
    try {
      setBusy(true);
      const resp = await finishSketchSession(session.sessionId, {
        options: {
          ...(floorTypeId ? { floorTypeId } : {}),
          ...(roofFootprintOptions ?? {}),
          ...(extraOptions ?? {}),
        },
      });
      // Pick the kind-specific id from the response, with floorId as the
      // back-compat fallback.
      const createdId =
        resp.roofId ?? resp.roomSeparationId ?? resp.floorId ?? resp.createdElementIds?.[0] ?? null;
      onFinishedRef.current(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [session, busy, floorTypeId, extraOptions, elementKind]);

  const handleAutoClose = useCallback(async () => {
    if (!session || busy) return;
    const candidate = autoCloseCandidate(session.lines);
    if (!candidate) return;
    try {
      setBusy(true);
      const resp = await addSketchLine(session.sessionId, candidate[0], candidate[1]);
      setSession(resp.session);
      setValidation(resp.validation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [session, busy]);

  const handleOffsetModeChange = useCallback(
    async (mode: PickWallsOffsetMode) => {
      if (!session || busy) return;
      try {
        setBusy(true);
        const resp = await setPickWallsOffsetMode(session.sessionId, mode);
        setSession(resp.session);
        setValidation(resp.validation);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [session, busy],
  );

  const errorLineSet = useMemo(() => {
    const s = new Set<number>();
    for (const issue of issues) {
      if (typeof issue.lineIndex === 'number') s.add(issue.lineIndex);
      if (issue.lineIndices) for (const i of issue.lineIndices) s.add(i);
    }
    return s;
  }, [issues]);

  const openVertices = useMemo(() => {
    if (!session) return [];
    return openVerticesForLines(session.lines);
  }, [session]);

  // Compute SVG primitives for current session lines + preview.
  const linesSvg: JSX.Element[] = [];
  const verticesSvg: JSX.Element[] = [];
  const errorVerticesSvg: JSX.Element[] = [];
  const pickHighlightSvg: JSX.Element[] = [];
  const mmToScreen = mmToScreenRef.current;
  if (mmToScreen && session) {
    for (let i = 0; i < session.lines.length; i++) {
      const ln = session.lines[i]!;
      const a = mmToScreen(ln.fromMm);
      const b = mmToScreen(ln.toMm);
      if (!a || !b) continue;
      const isError = errorLineSet.has(i);
      linesSvg.push(
        <line
          key={`l-${i}`}
          data-testid={isError ? `sketch-line-error-${i}` : `sketch-line-${i}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={isError ? ERROR_RED : TURQUOISE}
          strokeWidth={isError ? 3 : 2}
          strokeLinecap="round"
        />,
      );
      verticesSvg.push(<circle key={`v-${i}-a`} cx={a.x} cy={a.y} r={3} fill={VERTEX_FILL} />);
      verticesSvg.push(<circle key={`v-${i}-b`} cx={b.x} cy={b.y} r={3} fill={VERTEX_FILL} />);
    }

    for (let oi = 0; oi < openVertices.length; oi++) {
      const v = openVertices[oi]!;
      const s = mmToScreen(v);
      if (!s) continue;
      errorVerticesSvg.push(
        <circle
          key={`open-${oi}`}
          data-testid={`sketch-open-vertex-${oi}`}
          cx={s.x}
          cy={s.y}
          r={6}
          fill={ERROR_RED}
          stroke={ERROR_GLOW}
          strokeWidth={4}
        />,
      );
    }

    if (tool === 'pick' && hoverWallId && wallsForPicking) {
      const w = wallsForPicking.find((x) => x.id === hoverWallId);
      if (w) {
        const a = mmToScreen(w.startMm);
        const b = mmToScreen(w.endMm);
        if (a && b) {
          pickHighlightSvg.push(
            <line
              key="pick-hover"
              data-testid="sketch-pick-hover"
              data-wall-id={w.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#5cf564"
              strokeWidth={6}
              strokeOpacity={0.55}
              strokeLinecap="round"
            />,
          );
        }
      }
    }

    if (pendingStart && hover && tool !== 'pick') {
      const a = mmToScreen(pendingStart);
      const b = mmToScreen(hover);
      if (a && b) {
        if (tool === 'line') {
          linesSvg.push(
            <line
              key="preview"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={TURQUOISE_FAINT}
              strokeWidth={2}
              strokeDasharray="6 4"
            />,
          );
        } else {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const w = Math.abs(b.x - a.x);
          const h = Math.abs(b.y - a.y);
          linesSvg.push(
            <rect
              key="preview-rect"
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={TURQUOISE_FAINT}
              strokeWidth={2}
              strokeDasharray="6 4"
            />,
          );
        }
      }
    }
  }

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
    pointerEvents: 'auto',
    cursor: busy ? 'progress' : tool === 'pick' ? 'pointer' : 'crosshair',
  };

  const errorCount = issues.length;
  const finishDisabled = !validation?.valid || busy;
  const canPickWalls = !!wallsForPicking && wallsForPicking.length > 0;
  const pickWallIds = useMemo(
    () => (wallsForPicking ?? []).map((wall) => wall.id).join(' '),
    [wallsForPicking],
  );
  const canAutoClose = useMemo(() => {
    if (!session) return false;
    return autoCloseCandidate(session.lines) !== null;
  }, [session]);

  return (
    <div
      ref={overlayRef}
      data-testid="sketch-canvas"
      data-pick-wall-count={wallsForPicking?.length ?? 0}
      data-pick-wall-ids={pickWallIds}
      style={overlayStyle}
      onPointerDown={(e) => void handlePointerDown(e)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setHover(null);
        setHoverWallId(null);
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {pickHighlightSvg}
        {linesSvg}
        {verticesSvg}
        {errorVerticesSvg}
      </svg>

      {/* SKT-03: top status panel — title row + per-issue list */}
      <div
        data-testid="sketch-status"
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: 320,
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 12px',
          borderRadius: 6,
          backgroundColor: 'rgba(15, 22, 28, 0.92)',
          color: validation?.valid ? TURQUOISE : '#fab86c',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: validation?.valid ? TURQUOISE : '#fab86c',
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {error
              ? error
              : validation?.valid
                ? 'Ready to Finish'
                : `${errorCount} sketch issue${errorCount === 1 ? '' : 's'}`}
          </span>
          {issues.length > 0 ? (
            <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>
              Tab to cycle ({activeIssueIndex + 1}/{issues.length})
            </span>
          ) : null}
        </div>
        {issues.length > 0 ? (
          <ul
            data-testid="sketch-issue-list"
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {issues.map((issue, idx) => (
              <li
                key={`${issue.code}-${idx}`}
                data-testid={`sketch-issue-${idx}`}
                data-active={idx === activeIssueIndex ? 'true' : 'false'}
                style={{
                  fontSize: 11,
                  opacity: idx === activeIssueIndex ? 1 : 0.7,
                  fontWeight: idx === activeIssueIndex ? 600 : 400,
                }}
              >
                • {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Bottom-centre toolbar */}
      <div
        data-testid="sketch-toolbar"
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 6,
          borderRadius: 8,
          backgroundColor: 'rgba(15, 22, 28, 0.92)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        <SketchToolButton
          label="Line"
          shortcut="L"
          active={tool === 'line'}
          onClick={() => {
            setTool('line');
            setPendingStart(null);
          }}
        />
        <SketchToolButton
          label="Rectangle"
          shortcut="R"
          active={tool === 'rectangle'}
          onClick={() => {
            setTool('rectangle');
            setPendingStart(null);
          }}
        />
        {canPickWalls ? (
          <>
            <SketchToolButton
              label="Pick Walls"
              shortcut="P"
              active={tool === 'pick'}
              onClick={() => {
                setTool('pick');
                setPendingStart(null);
              }}
              testId="sketch-tool-pick"
            />
            {tool === 'pick' && session ? (
              <OffsetModeChip
                mode={session.pickWallsOffsetMode}
                onChange={(m) => void handleOffsetModeChange(m)}
                disabled={busy}
              />
            ) : null}
          </>
        ) : null}
        <div style={{ width: 1, height: 20, backgroundColor: '#33424d', margin: '0 4px' }} />
        {canAutoClose ? (
          <button
            type="button"
            data-testid="sketch-auto-close"
            disabled={busy}
            onClick={() => void handleAutoClose()}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #fab86c',
              backgroundColor: 'transparent',
              color: '#fab86c',
              fontSize: 11,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            title="Connect the two open endpoints with a single line"
          >
            Auto-close
          </button>
        ) : null}
        <button
          type="button"
          data-testid="sketch-finish"
          disabled={finishDisabled}
          onClick={() => void handleFinish()}
          title={
            finishDisabled && errorCount > 0
              ? `${errorCount} issue${errorCount === 1 ? '' : 's'}`
              : ''
          }
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: validation?.valid ? TURQUOISE : '#33424d',
            color: validation?.valid ? '#0d1216' : '#7c8a93',
            fontSize: 12,
            fontWeight: 600,
            cursor: validation?.valid && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          Finish
        </button>
        <button
          type="button"
          data-testid="sketch-cancel"
          title="Cancel sketch (Esc)"
          onClick={() => void handleCancel()}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid #33424d',
            backgroundColor: 'transparent',
            color: '#fab86c',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SketchToolButtonProps {
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}

function SketchToolButton({
  label,
  shortcut,
  active,
  onClick,
  testId,
}: SketchToolButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid #33424d',
        backgroundColor: active ? TURQUOISE : 'transparent',
        color: active ? '#0d1216' : '#cfd6db',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{shortcut}</span>
    </button>
  );
}
