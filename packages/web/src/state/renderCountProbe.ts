/**
 * PERF-G07: dev-only render-count instrumentation.
 *
 * Major panes call `useRenderCount('SomeName')` to register a render-count
 * sample. Counts accumulate in `window.__BIM_AI_RENDER_COUNTS__` so a
 * Playwright/dev probe can read them after a UI scenario completes.
 *
 * No-op in production; the hook returns the current count for the caller.
 * Set `window.__BIM_AI_RECORD_RENDER_COUNTS__ = true` (or rely on
 * `import.meta.env.DEV`) to enable the recording path.
 */
import { useEffect, useRef } from 'react';

export type RenderCountSample = {
  count: number;
  lastRenderAt: number;
  causeNotes: readonly string[];
};

declare global {
  interface Window {
    __BIM_AI_RECORD_RENDER_COUNTS__?: boolean;
    __BIM_AI_RENDER_COUNTS__?: Record<string, RenderCountSample>;
  }
}

function shouldRecord(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__BIM_AI_RECORD_RENDER_COUNTS__ === true) return true;
  // Default to recording in dev so the data is always available to local
  // probing without the developer flipping a flag.
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export function useRenderCount(name: string, cause?: string): number {
  const localCount = useRef(0);
  localCount.current += 1;
  useEffect(() => {
    if (!shouldRecord()) return;
    const samples = window.__BIM_AI_RENDER_COUNTS__ ?? {};
    const existing = samples[name];
    const nextCauseNotes: string[] = existing?.causeNotes ? [...existing.causeNotes] : [];
    if (cause) {
      nextCauseNotes.push(cause);
      // Cap at 40 most recent causes so the buffer stays tiny.
      if (nextCauseNotes.length > 40) nextCauseNotes.splice(0, nextCauseNotes.length - 40);
    }
    samples[name] = {
      count: (existing?.count ?? 0) + 1,
      lastRenderAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      causeNotes: nextCauseNotes,
    };
    window.__BIM_AI_RENDER_COUNTS__ = samples;
  });
  return localCount.current;
}

export function readRenderCountProbe(): Record<string, RenderCountSample> {
  if (typeof window === 'undefined') return {};
  return { ...(window.__BIM_AI_RENDER_COUNTS__ ?? {}) };
}

export function resetRenderCountProbe(): void {
  if (typeof window === 'undefined') return;
  window.__BIM_AI_RENDER_COUNTS__ = {};
}
