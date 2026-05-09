/**
 * EDT-V3-09 — Stair sketch tread auto-balance editor.
 *
 * Renders by_sketch stair tread lines as draggable vertical handles in plan
 * view.  Dragging a handle calls rebalanceTreads() live at 60 fps (RAF loop).
 * On mouse-up the new tread state is dispatched as UpdateStairTreadsCmd.
 *
 * Shift+drag sets manualOverride=true on the moved tread (locked — skip
 * rebalance for that tread on subsequent drags).
 *
 * Cmd+R / Ctrl+R resets all manualOverride flags and redispatches.
 *
 * Helper dimension chips (same style as EDT-V3-06) show each tread's current
 * width.  Locked tread handles are tinted at 60 % opacity with the accent
 * colour to signal the lock.
 *
 * No hex literals — CSS tokens only.
 */

import { type JSX, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import type { StairTreadLine, UpdateStairTreadsCmd } from '@bim-ai/core';

import { rebalanceTreads } from './stairAutobalance';

export interface StairSketchEditorProps {
  /** Element id of the by_sketch stair being edited. */
  stairId: string;
  /** Current tread lines from the stair element. */
  treadLines: StairTreadLine[];
  /** Total run of the stair footprint in mm (used to constrain rebalancing). */
  totalRunMm: number;
  /**
   * Convert a plan-space X coordinate (mm) to a screen X (px).
   * Only the X axis is rebalanced; Y stays constant.
   */
  mmToScreenX: (xMm: number) => number;
  /** Convert a screen X (px) to plan-space X (mm). */
  screenXToMm: (px: number) => number;
  /** Dispatch a command to the engine command bus. */
  onDispatch: (cmd: Record<string, unknown>) => void;
}

/** Width (px) of the hit-target for each tread boundary drag handle. */
const HANDLE_HIT_PX = 6;

/** Minimum tread width (mm) — prevents degeneracy while dragging. */
const MIN_TREAD_MM = 50;

function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  return `${Math.round(mm)} mm`;
}

/**
 * StairSketchEditor — drag-to-rebalance tread line overlay for by_sketch stairs.
 */
export function StairSketchEditor(props: StairSketchEditorProps): JSX.Element {
  const { stairId, treadLines, totalRunMm, mmToScreenX, screenXToMm, onDispatch } = props;

  // Local draft state (updated live at 60fps during drag).
  const [draft, setDraft] = useState<StairTreadLine[]>(treadLines);

  // Sync external prop changes into draft (e.g. after a remote update).
  useEffect(() => {
    setDraft(treadLines);
  }, [treadLines]);

  // Drag state — stored in a ref to avoid stale-closure issues inside RAF.
  const dragState = useRef<{
    active: boolean;
    movedIndex: number;
    shiftHeld: boolean;
    startScreenX: number;
    startFromXMm: number;
    rafId: number | null;
    latestScreenX: number;
  }>({
    active: false,
    movedIndex: -1,
    shiftHeld: false,
    startScreenX: 0,
    startFromXMm: 0,
    rafId: null,
    latestScreenX: 0,
  });

  // Dispatch helper.
  const dispatchUpdate = useCallback(
    (lines: StairTreadLine[]) => {
      const cmd: UpdateStairTreadsCmd = {
        type: 'update_stair_treads',
        id: stairId,
        treadLines: lines,
      };
      onDispatch(cmd as unknown as Record<string, unknown>);
    },
    [stairId, onDispatch],
  );

  // ── Pointer handlers ────────────────────────────────────────────────────────

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);

      const tread = draft[index]!;
      dragState.current = {
        active: true,
        movedIndex: index,
        shiftHeld: e.shiftKey,
        startScreenX: e.clientX,
        startFromXMm: tread.fromMm.xMm,
        rafId: null,
        latestScreenX: e.clientX,
      };
    },
    [draft],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!dragState.current.active) return;
      dragState.current.latestScreenX = e.clientX;

      // Schedule RAF update.
      if (dragState.current.rafId === null) {
        dragState.current.rafId = requestAnimationFrame(() => {
          dragState.current.rafId = null;
          const ds = dragState.current;
          if (!ds.active) return;

          const deltaXMm = screenXToMm(ds.latestScreenX) - screenXToMm(ds.startScreenX);
          const newFromXMm = ds.startFromXMm + deltaXMm;
          // Clamp to avoid degeneracy.
          const safeFromXMm = Math.max(0, Math.min(totalRunMm - MIN_TREAD_MM, newFromXMm));

          setDraft((prev) => {
            const working = ds.shiftHeld
              ? prev.map((t, i) => (i === ds.movedIndex ? { ...t, manualOverride: true } : t))
              : prev;
            return rebalanceTreads(working, ds.movedIndex, safeFromXMm, totalRunMm);
          });
        });
      }
    },
    [screenXToMm, totalRunMm],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<SVGRectElement>) => {
      if (!dragState.current.active) return;
      dragState.current.active = false;
      if (dragState.current.rafId !== null) {
        cancelAnimationFrame(dragState.current.rafId);
        dragState.current.rafId = null;
      }
      // Apply shift-lock to the moved tread if shift was held.
      setDraft((prev) => {
        const finalLines: StairTreadLine[] = dragState.current.shiftHeld
          ? prev.map((t, i) =>
              i === dragState.current.movedIndex ? { ...t, manualOverride: true } : t,
            )
          : prev;
        dispatchUpdate(finalLines);
        return finalLines;
      });
    },
    [dispatchUpdate],
  );

  // ── Cmd+R / Ctrl+R — reset all overrides ────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGSVGElement>) => {
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const reset = draft.map((t) => ({ ...t, manualOverride: false }));
        setDraft(reset);
        dispatchUpdate(reset);
      }
    },
    [draft, dispatchUpdate],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        outline: 'none',
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      pointerEvents="all"
    >
      {draft.map((tread, i) => {
        const xPx = mmToScreenX(tread.fromMm.xMm);
        const toPx = mmToScreenX(tread.toMm.xMm);
        const midXPx = (xPx + toPx) / 2;
        const widthMm = Math.abs(tread.toMm.xMm - tread.fromMm.xMm);
        const isLocked = tread.manualOverride === true;

        const chipY = 48;
        const chipW = 68;
        const chipH = 20;

        return (
          <g key={i}>
            {/* Tread separator line */}
            <line
              x1={xPx}
              y1={0}
              x2={xPx}
              y2="100%"
              stroke={
                isLocked
                  ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)'
                  : 'var(--draft-witness)'
              }
              strokeWidth={isLocked ? 2 : 1}
              strokeDasharray={isLocked ? undefined : '4 3'}
              pointerEvents="none"
            />

            {/* Drag handle hit target */}
            <rect
              x={xPx - HANDLE_HIT_PX / 2}
              y={0}
              width={HANDLE_HIT_PX}
              height="100%"
              fill="transparent"
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) => handleHandlePointerDown(e, i)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />

            {/* Helper dim chip showing tread width */}
            <foreignObject
              x={midXPx - chipW / 2}
              y={chipY - chipH / 2}
              width={chipW}
              height={chipH}
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            >
              <div
                style={{
                  background: 'var(--color-surface-2, var(--color-surface-strong))',
                  color: isLocked ? 'var(--color-accent)' : 'var(--color-foreground)',
                  border: `1px solid ${isLocked ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)' : 'color-mix(in srgb, var(--color-foreground) 20%, transparent)'}`,
                  borderRadius: 3,
                  fontSize: 'var(--text-2xs, 10px)',
                  fontVariantNumeric: 'tabular-nums',
                  padding: '0 4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxSizing: 'border-box',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                }}
              >
                {formatMm(widthMm)}
                {isLocked ? ' L' : ''}
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* Keyboard hint */}
      <foreignObject x={8} y={8} width={260} height={20} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: 'var(--text-2xs, 10px)',
            color: 'var(--color-muted-foreground)',
            userSelect: 'none',
          }}
        >
          Shift+drag to lock tread · Cmd+R to reset all locks
        </div>
      </foreignObject>
    </svg>
  );
}
