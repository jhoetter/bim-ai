export type PlanPointerMoveScenario =
  | 'pan'
  | 'marquee'
  | 'grip'
  | 'crop'
  | 'draw-wall'
  | 'place-hosted-opening'
  | 'place-tag'
  | 'place-dimension'
  | 'hover-snap'
  | 'other';

export type PlanPointerMoveSample = {
  scenario: PlanPointerMoveScenario;
  tool: string | null;
  durationMs: number;
  atMs: number;
  pointerType: string;
};

declare global {
  interface Window {
    __BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__?: boolean;
    __BIM_AI_PLAN_POINTERMOVE_PERF__?: PlanPointerMoveSample[];
  }
}

export function classifyPlanPointerMoveScenario(input: {
  tool: string | null | undefined;
  isPanning: boolean;
  isMarquee: boolean;
  isGripDragging: boolean;
  isCropDragging: boolean;
}): PlanPointerMoveScenario {
  if (input.isGripDragging) return 'grip';
  if (input.isCropDragging) return 'crop';
  if (input.isPanning) return 'pan';
  if (input.isMarquee) return 'marquee';
  if (input.tool === 'wall') return 'draw-wall';
  if (input.tool === 'door' || input.tool === 'window' || input.tool === 'wall-opening') {
    return 'place-hosted-opening';
  }
  if (input.tool === 'tag') return 'place-tag';
  if (input.tool === 'dimension') return 'place-dimension';
  if (input.tool === 'select' || input.tool === 'query' || input.tool == null) return 'hover-snap';
  return 'other';
}

export function beginPlanPointerMoveSample(input: {
  scenario: PlanPointerMoveScenario;
  tool: string | null | undefined;
  pointerType: string;
}): () => void {
  if (
    typeof window === 'undefined' ||
    typeof performance === 'undefined' ||
    window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__ !== true
  ) {
    return () => undefined;
  }
  const start = performance.now();
  return () => {
    const samples = window.__BIM_AI_PLAN_POINTERMOVE_PERF__ ?? [];
    samples.push({
      scenario: input.scenario,
      tool: input.tool ?? null,
      durationMs: performance.now() - start,
      atMs: start,
      pointerType: input.pointerType,
    });
    if (samples.length > 1000) samples.splice(0, samples.length - 1000);
    window.__BIM_AI_PLAN_POINTERMOVE_PERF__ = samples;
  };
}
