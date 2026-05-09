/**
 * KRN-V3-05 — Stair by sketch authoring overlay.
 *
 * Two-phase drawing:
 *   Phase A (boundary): user draws a closed polygon for the stair footprint.
 *   Phase B (tread_lines): user draws lines across the boundary; a live
 *   comfort advisory shows EU residential proxy compliance.
 *
 * On Finish the component opens a stair_by_sketch sketch session, immediately
 * finishes it with the assembled StairSketchFinishOpts, and reports the new
 * stair id via onFinished.
 *
 * All colours and sizes use CSS tokens — no hex literals (ESLint bim-ai/no-hex-in-chrome).
 */

import { type JSX, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import {
  cancelSketchSession,
  finishSketchSession,
  openSketchSession,
  type StairSketchFinishOpts,
} from './sketchApi';
import type { MmToScreen, Point2D, PointerToMm } from './SketchCanvas';

export interface StairBySketchCanvasProps {
  modelId: string;
  levelId: string;
  topLevelId: string;
  /** Elevation of baseLevelId in mm. */
  baseLevelElevationMm: number;
  /** Elevation of topLevelId in mm. */
  topLevelElevationMm: number;
  pointerToMmRef: RefObject<PointerToMm | null>;
  mmToScreenRef: RefObject<MmToScreen | null>;
  onFinished: (createdId: string | null) => void;
  onCancelled: () => void;
}

type Phase = 'boundary' | 'tread_lines';

type TreadLine = { fromMm: Point2D; toMm: Point2D };

const SNAP_GRID_MM = 10;
const CLOSE_EPS_PX = 12;
const MIN_TREAD_MM = 260;
const MAX_RISER_MM = 190;

function snapMm(p: Point2D): Point2D {
  return {
    xMm: Math.round(p.xMm / SNAP_GRID_MM) * SNAP_GRID_MM,
    yMm: Math.round(p.yMm / SNAP_GRID_MM) * SNAP_GRID_MM,
  };
}

function distPx(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function avgTreadDepthMm(lines: TreadLine[]): number {
  if (lines.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i]!;
    const b = lines[i + 1]!;
    const midAx = (a.fromMm.xMm + a.toMm.xMm) / 2;
    const midAy = (a.fromMm.yMm + a.toMm.yMm) / 2;
    const midBx = (b.fromMm.xMm + b.toMm.xMm) / 2;
    const midBy = (b.fromMm.yMm + b.toMm.yMm) / 2;
    total += Math.sqrt((midBx - midAx) ** 2 + (midBy - midAy) ** 2);
  }
  return total / (lines.length - 1);
}

export function StairBySketchCanvas(props: StairBySketchCanvasProps): JSX.Element {
  const {
    modelId,
    levelId,
    topLevelId,
    baseLevelElevationMm,
    topLevelElevationMm,
    pointerToMmRef,
    mmToScreenRef,
    onFinished,
    onCancelled,
  } = props;

  const totalRiseMm = Math.abs(topLevelElevationMm - baseLevelElevationMm);

  const [phase, setPhase] = useState<Phase>('boundary');
  const [boundary, setBoundary] = useState<Point2D[]>([]);
  const [treadLines, setTreadLines] = useState<TreadLine[]>([]);
  const [hover, setHover] = useState<Point2D | null>(null);
  const [lineStart, setLineStart] = useState<Point2D | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Open stair_by_sketch session on mount.
  useEffect(() => {
    let cancelled = false;
    openSketchSession(modelId, levelId, { elementKind: 'stair_by_sketch' })
      .then((resp) => {
        if (!cancelled) setSessionId(resp.session.sessionId);
      })
      .catch(() => {
        if (!cancelled) onCancelled();
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, levelId, onCancelled]);

  // Force re-render on animation frame so screen coords track pan/zoom.
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setTick((n) => n + 1);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const toScreen = useCallback((p: Point2D) => mmToScreenRef.current?.(p) ?? null, [mmToScreenRef]);
  const toMm = useCallback(
    (cx: number, cy: number) => pointerToMmRef.current?.(cx, cy) ?? null,
    [pointerToMmRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const mm = toMm(e.clientX, e.clientY);
      if (mm) setHover(snapMm(mm));
    },
    [toMm],
  );

  const handlePointerLeave = useCallback(() => setHover(null), []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const mm = toMm(e.clientX, e.clientY);
      if (!mm) return;
      const snapped = snapMm(mm);

      if (phase === 'boundary') {
        if (boundary.length >= 3) {
          // Check if click is near the first vertex (close polygon).
          const firstScreen = toScreen(boundary[0]!);
          const clickScreen = toScreen(snapped);
          if (firstScreen && clickScreen && distPx(firstScreen, clickScreen) < CLOSE_EPS_PX) {
            setPhase('tread_lines');
            return;
          }
        }
        setBoundary((prev) => [...prev, snapped]);
      } else {
        // tread_lines phase
        if (!lineStart) {
          setLineStart(snapped);
        } else {
          setTreadLines((prev) => [...prev, { fromMm: lineStart, toMm: snapped }]);
          setLineStart(null);
        }
      }
    },
    [phase, boundary, lineStart, toMm, toScreen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        if (sessionId) {
          void cancelSketchSession(sessionId);
        }
        onCancelled();
      }
      if (e.key === 'Enter' && phase === 'boundary' && boundary.length >= 3) {
        setPhase('tread_lines');
      }
    },
    [phase, boundary, sessionId, onCancelled],
  );

  const handleFinish = useCallback(async () => {
    if (!sessionId || boundary.length < 3 || treadLines.length < 1) return;
    setBusy(true);
    try {
      const stairOpts: StairSketchFinishOpts = {
        topLevelId,
        baseLevelId: levelId,
        authoringMode: 'by_sketch',
        boundaryMm: boundary,
        treadLines,
        totalRiseMm: totalRiseMm > 0 ? totalRiseMm : 2800,
        name: 'Stair',
      };
      const resp = await finishSketchSession(sessionId, {
        options: stairOpts as unknown as Record<string, unknown>,
      });
      const createdId = resp.createdElementIds?.[0] ?? null;
      onFinished(createdId);
    } catch {
      setBusy(false);
    }
  }, [sessionId, boundary, treadLines, topLevelId, levelId, totalRiseMm, onFinished]);

  const handleCancel = useCallback(() => {
    if (sessionId) void cancelSketchSession(sessionId);
    onCancelled();
  }, [sessionId, onCancelled]);

  const canFinish = phase === 'tread_lines' && boundary.length >= 3 && treadLines.length >= 1;

  // Comfort advisory computation.
  const avgTread = avgTreadDepthMm(treadLines);
  const riserCount = treadLines.length;
  const avgRiser = riserCount > 0 ? totalRiseMm / riserCount : 0;
  const treadOk = treadLines.length < 2 || avgTread >= MIN_TREAD_MM;
  const riserOk = riserCount === 0 || avgRiser <= MAX_RISER_MM;
  const advisoryOk = treadOk && riserOk;

  // Build SVG paths.
  const boundaryScreenPts = boundary.map((p) => toScreen(p)).filter(Boolean) as {
    x: number;
    y: number;
  }[];
  const hoverScreen = hover ? toScreen(hover) : null;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    cursor: 'crosshair',
    outline: 'none',
  };

  return (
    <div
      ref={overlayRef}
      style={overlayStyle}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
        pointerEvents="none"
      >
        {/* Boundary polygon */}
        {boundaryScreenPts.length >= 2 && (
          <polyline
            points={boundaryScreenPts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
          />
        )}
        {/* Closing preview line to cursor */}
        {phase === 'boundary' && hoverScreen && boundaryScreenPts.length >= 1 && (
          <line
            x1={boundaryScreenPts[boundaryScreenPts.length - 1]!.x}
            y1={boundaryScreenPts[boundaryScreenPts.length - 1]!.y}
            x2={hoverScreen.x}
            y2={hoverScreen.y}
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        )}
        {/* Close hint circle on first vertex */}
        {phase === 'boundary' && boundary.length >= 3 && boundaryScreenPts[0] && (
          <circle
            cx={boundaryScreenPts[0].x}
            cy={boundaryScreenPts[0].y}
            r={CLOSE_EPS_PX}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {/* Boundary vertices */}
        {boundaryScreenPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-accent)" />
        ))}
        {/* Tread lines */}
        {treadLines.map((tl, i) => {
          const a = toScreen(tl.fromMm);
          const b = toScreen(tl.toMm);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--color-warning, #f59e0b)"
              strokeWidth={2}
            />
          );
        })}
        {/* In-progress tread line */}
        {phase === 'tread_lines' &&
          lineStart &&
          hoverScreen &&
          (() => {
            const ls = toScreen(lineStart);
            if (!ls) return null;
            return (
              <line
                x1={ls.x}
                y1={ls.y}
                x2={hoverScreen.x}
                y2={hoverScreen.y}
                stroke="var(--color-warning, #f59e0b)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            );
          })()}
        {/* Hover snap point */}
        {hoverScreen && (
          <circle
            cx={hoverScreen.x}
            cy={hoverScreen.y}
            r={5}
            fill="none"
            stroke="var(--color-foreground, #e6edf6)"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Phase label */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 12px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-foreground)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {phase === 'boundary'
          ? 'Phase A: Draw boundary polygon — click to add vertices, click near first vertex or press Enter to close'
          : 'Phase B: Draw tread lines — click start, click end'}
      </div>

      {/* Comfort advisory chip */}
      {phase === 'tread_lines' && riserCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: '50%',
            transform: 'translateX(-50%)',
            background: advisoryOk ? 'var(--color-success)' : 'var(--color-destructive)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 10px',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-surface)',
            pointerEvents: 'none',
            transition: 'background var(--ease-paper)',
            userSelect: 'none',
          }}
        >
          {advisoryOk
            ? `OK ${Math.round(avgTread)}×${Math.round(avgRiser)} mm — EU proxy OK`
            : [
                !treadOk && `Tread ${Math.round(avgTread)} mm < 260 mm min`,
                !riserOk && `Riser ${Math.round(avgRiser)} mm > 190 mm max`,
              ]
                .filter(Boolean)
                .join(' · ')}
        </div>
      )}

      {/* Mode toggle & action buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {/* Segmented mode toggle */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            fontSize: 'var(--text-sm)',
          }}
        >
          <button
            type="button"
            style={{
              padding: '4px 12px',
              background: phase === 'boundary' ? 'var(--color-accent)' : 'var(--color-surface)',
              color: phase === 'boundary' ? 'var(--color-surface)' : 'var(--color-foreground)',
              border: 'none',
              cursor: boundary.length === 0 ? 'default' : 'pointer',
              fontSize: 'inherit',
            }}
            onClick={() => setPhase('boundary')}
          >
            Boundary
          </button>
          <button
            type="button"
            style={{
              padding: '4px 12px',
              background: phase === 'tread_lines' ? 'var(--color-accent)' : 'var(--color-surface)',
              color:
                phase === 'tread_lines'
                  ? 'var(--color-surface)'
                  : boundary.length >= 3
                    ? 'var(--color-foreground)'
                    : 'var(--color-muted-foreground)',
              border: 'none',
              cursor: boundary.length >= 3 ? 'pointer' : 'not-allowed',
              fontSize: 'inherit',
            }}
            disabled={boundary.length < 3}
            onClick={() => boundary.length >= 3 && setPhase('tread_lines')}
          >
            Tread lines
          </button>
        </div>

        <button
          type="button"
          title="Finish stair sketch"
          disabled={!canFinish || busy}
          onClick={() => void handleFinish()}
          style={{
            padding: '4px 16px',
            background: canFinish ? 'var(--color-accent)' : 'var(--color-muted)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            cursor: canFinish && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? '…' : 'Finish'}
        </button>
        <button
          type="button"
          title="Cancel stair sketch (Esc)"
          onClick={handleCancel}
          style={{
            padding: '4px 16px',
            background: 'var(--color-surface)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
