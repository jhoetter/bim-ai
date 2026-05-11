/**
 * Workspace mode controller — spec §7 + §20.
 *
 * Single source of truth for active workspace mode (Plan, 3D, Plan+3D,
 * Section, Sheet, Schedule, Agent, Concept), mapping `1`–`8` hotkeys to the
 * matching mode, and remembering per-mode prior state so a mode switch
 * doesn't destroy the user's tool / selection / camera per §7 ("Modes
 * do not destroy state — switching back returns to the prior tool,
 * selection, zoom, and camera.").
 */

import type { WorkspaceMode } from '../tools/toolRegistry';

export const MODE_HOTKEYS: { mode: WorkspaceMode; hotkey: string }[] = [
  { mode: 'plan', hotkey: '1' },
  { mode: '3d', hotkey: '2' },
  { mode: 'plan-3d', hotkey: '3' },
  { mode: 'section', hotkey: '4' },
  { mode: 'sheet', hotkey: '5' },
  { mode: 'schedule', hotkey: '6' },
  { mode: 'agent', hotkey: '7' },
  { mode: 'concept', hotkey: '8' },
];

/** Resolve a key event to a mode jump, or `null` if unrelated. */
export function modeForHotkey(eventKey: string): WorkspaceMode | null {
  const match = MODE_HOTKEYS.find((m) => m.hotkey === eventKey);
  return match?.mode ?? null;
}

export type SerializedPerModeState = Record<string, unknown>;

export interface ModeControllerSnapshot {
  active: WorkspaceMode;
  /** Map of mode → prior serialized state (tool, selection, camera). */
  history: Record<WorkspaceMode, SerializedPerModeState>;
}

export interface ModeAdapter<T extends SerializedPerModeState = SerializedPerModeState> {
  /** Snapshot the current per-mode UI state so it can be restored. */
  capture(): T;
  /** Apply a previously captured state when the user returns to this mode. */
  restore(state: T): void;
}

export class ModeController {
  private active: WorkspaceMode;
  private adapters: Partial<Record<WorkspaceMode, ModeAdapter>>;
  private history: Map<WorkspaceMode, SerializedPerModeState>;

  constructor(
    initial: WorkspaceMode = 'plan',
    adapters: Partial<Record<WorkspaceMode, ModeAdapter>> = {},
  ) {
    this.active = initial;
    this.adapters = adapters;
    this.history = new Map();
  }

  current(): WorkspaceMode {
    return this.active;
  }

  setAdapter(mode: WorkspaceMode, adapter: ModeAdapter): void {
    this.adapters[mode] = adapter;
  }

  /** Switch to `next` mode, capturing the current mode's state via its
   * adapter and restoring `next`'s prior state if any. Returns the
   * resolved mode (idempotent if already active). */
  switch(next: WorkspaceMode): WorkspaceMode {
    if (next === this.active) return this.active;
    const currentAdapter = this.adapters[this.active];
    if (currentAdapter) {
      this.history.set(this.active, currentAdapter.capture());
    }
    const nextAdapter = this.adapters[next];
    const nextState = this.history.get(next);
    if (nextAdapter && nextState) {
      nextAdapter.restore(nextState);
    }
    this.active = next;
    return next;
  }

  snapshot(): ModeControllerSnapshot {
    const history: Record<WorkspaceMode, SerializedPerModeState> = {} as Record<
      WorkspaceMode,
      SerializedPerModeState
    >;
    for (const [mode, state] of this.history.entries()) {
      history[mode] = state;
    }
    return { active: this.active, history };
  }

  /** Reset history (e.g. on document load). */
  reset(): void {
    this.history.clear();
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* Plan + 3D split divider — spec §20.3                                    */
/* ────────────────────────────────────────────────────────────────────── */

export interface SplitDividerState {
  /** Fraction of the canvas region given to the left (plan) half. */
  leftFraction: number;
}

const SPLIT_SNAP_POINTS = [0.33, 0.5, 0.67];
const SPLIT_SNAP_TOLERANCE = 0.03;

/** Drag the divider by `deltaPx` over a `widthPx`-wide canvas region;
 * snaps to 33 / 50 / 67 % within tolerance. */
export function dragSplitDivider(
  state: SplitDividerState,
  deltaPx: number,
  widthPx: number,
): SplitDividerState {
  if (widthPx <= 0) return state;
  const next = clamp01(state.leftFraction + deltaPx / widthPx);
  for (const snap of SPLIT_SNAP_POINTS) {
    if (Math.abs(next - snap) <= SPLIT_SNAP_TOLERANCE) {
      return { leftFraction: snap };
    }
  }
  return { leftFraction: next };
}

/** `[` collapses the left half (plan); `]` collapses the right (3D). */
export function applySplitDividerHotkey(
  state: SplitDividerState,
  key: '[' | ']',
): SplitDividerState {
  if (key === '[') return { leftFraction: 0 };
  return { leftFraction: 1 };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
