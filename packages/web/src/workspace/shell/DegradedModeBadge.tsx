import type { JSX } from 'react';

import { useDegradedModeIndicator } from './useDegradedModeIndicator';

/**
 * PERF-L05: tiny chip that lights up when the viewport's frame-time or
 * mesh-rebuild probes (PERF-I03 / PERF-I04) report sustained budget
 * violations. Surfaces "the app is currently slow" without changing
 * any rendering paths — actual degraded-mode toggling (reduced detail,
 * disabled shadows) is a future follow-up that this badge anchors.
 *
 * Mounted inert when no probe data exists (e.g., production builds
 * without the probe flag), so this is safe to leave on the workspace
 * shell unconditionally.
 */
export function DegradedModeBadge(): JSX.Element | null {
  const state = useDegradedModeIndicator();
  if (!state.active || !state.reason) return null;
  const label =
    state.reason.kind === 'frame_time'
      ? `Frame budget exceeded (${state.reason.avgFrameIntervalMs.toFixed(0)} ms avg / ${state.reason.budgetMs} ms budget)`
      : `Mesh-rebuild budget exceeded (${state.reason.avgRebuildMs.toFixed(0)} ms avg / ${state.reason.budgetMs} ms budget)`;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="degraded-mode-badge"
      data-degraded-reason={state.reason.kind}
      title={label}
      className="hidden items-center gap-1 rounded-sm bg-warning-soft px-1.5 py-0.5 text-[10px] text-warning sm:inline-flex"
    >
      <span aria-hidden="true">●</span>
      <span>Slow</span>
    </div>
  );
}
