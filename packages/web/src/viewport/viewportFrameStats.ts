/**
 * PERF-I03: dev-only viewport frame-time / renderer-state probe.
 *
 * Viewport.tsx's `tick()` calls `recordViewportFrame(renderer, renderMs,
 * intervalMs)` on every demand-driven render. Stats accumulate in
 * `window.__BIM_AI_VIEWPORT_FRAME_STATS__` so a Playwright / dev probe
 * can read FPS and renderer.info numbers after a scenario completes.
 *
 * No-op in production; the recording path is dev-gated.
 */

import type * as THREE from 'three';

export type ViewportFrameStats = {
  /** Number of `tick()` calls recorded since the probe was last reset. */
  frameCount: number;
  /** Last frame's render duration (composer.render() wall time, ms). */
  lastRenderMs: number;
  /** Rolling average render duration (ms, EMA α=0.1). */
  avgRenderMs: number;
  /** Last frame's interval (time since previous tick, ms). 0 on first frame. */
  lastFrameIntervalMs: number;
  /** Rolling average frame interval (ms, EMA α=0.1). */
  avgFrameIntervalMs: number;
  /** Derived FPS from `avgFrameIntervalMs`. 0 until two frames are recorded. */
  fps: number;
  /** Latest `renderer.info` snapshot. */
  renderer: {
    drawCalls: number;
    triangles: number;
    lines: number;
    points: number;
    geometries: number;
    textures: number;
    programs: number;
  };
  /** `performance.now()` of the most recent recorded frame. */
  lastFrameAt: number;
};

declare global {
  interface Window {
    __BIM_AI_RECORD_VIEWPORT_FRAME_STATS__?: boolean;
    __BIM_AI_VIEWPORT_FRAME_STATS__?: ViewportFrameStats;
  }
}

const EMA_ALPHA = 0.1;

function shouldRecord(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__BIM_AI_RECORD_VIEWPORT_FRAME_STATS__ === true) return true;
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function ema(previous: number, sample: number, count: number): number {
  if (count <= 1) return sample;
  return previous + EMA_ALPHA * (sample - previous);
}

export function recordViewportFrame(
  renderer: THREE.WebGLRenderer,
  renderMs: number,
  intervalMs: number,
): void {
  if (!shouldRecord()) return;
  const prev = window.__BIM_AI_VIEWPORT_FRAME_STATS__;
  const nextCount = (prev?.frameCount ?? 0) + 1;
  const avgRenderMs = ema(prev?.avgRenderMs ?? renderMs, renderMs, nextCount);
  const avgFrameIntervalMs =
    intervalMs > 0 ? ema(prev?.avgFrameIntervalMs ?? intervalMs, intervalMs, nextCount) : 0;
  const fps = avgFrameIntervalMs > 0 ? 1000 / avgFrameIntervalMs : 0;
  const info = renderer.info;
  window.__BIM_AI_VIEWPORT_FRAME_STATS__ = {
    frameCount: nextCount,
    lastRenderMs: renderMs,
    avgRenderMs,
    lastFrameIntervalMs: intervalMs,
    avgFrameIntervalMs,
    fps,
    renderer: {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      lines: info.render.lines,
      points: info.render.points,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    },
    lastFrameAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  };
}

export function readViewportFrameStats(): ViewportFrameStats | null {
  if (typeof window === 'undefined') return null;
  return window.__BIM_AI_VIEWPORT_FRAME_STATS__ ?? null;
}

export function resetViewportFrameStats(): void {
  if (typeof window === 'undefined') return;
  window.__BIM_AI_VIEWPORT_FRAME_STATS__ = undefined;
}
