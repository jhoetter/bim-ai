import { describe, expect, it, vi } from 'vitest';

import {
  beginPlanPointerMoveSample,
  classifyPlanPointerMoveScenario,
} from './planPointerMovePerformance';

describe('plan pointermove performance instrumentation', () => {
  it('classifies common pointermove budget scenarios', () => {
    expect(
      classifyPlanPointerMoveScenario({
        tool: 'wall',
        isPanning: false,
        isMarquee: false,
        isGripDragging: false,
        isCropDragging: false,
      }),
    ).toBe('draw-wall');
    expect(
      classifyPlanPointerMoveScenario({
        tool: 'door',
        isPanning: false,
        isMarquee: false,
        isGripDragging: false,
        isCropDragging: false,
      }),
    ).toBe('place-hosted-opening');
    expect(
      classifyPlanPointerMoveScenario({
        tool: 'select',
        isPanning: true,
        isMarquee: false,
        isGripDragging: false,
        isCropDragging: false,
      }),
    ).toBe('pan');
    expect(
      classifyPlanPointerMoveScenario({
        tool: 'dimension',
        isPanning: false,
        isMarquee: false,
        isGripDragging: false,
        isCropDragging: false,
      }),
    ).toBe('place-dimension');
  });

  it('records capped samples only when the dev flag is enabled', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(104.25);
    window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__ = true;
    window.__BIM_AI_PLAN_POINTERMOVE_PERF__ = [];

    const finish = beginPlanPointerMoveSample({
      scenario: 'hover-snap',
      tool: 'select',
      pointerType: 'mouse',
    });
    finish();

    expect(window.__BIM_AI_PLAN_POINTERMOVE_PERF__).toEqual([
      {
        scenario: 'hover-snap',
        tool: 'select',
        durationMs: 4.25,
        atMs: 100,
        pointerType: 'mouse',
      },
    ]);

    delete window.__BIM_AI_RECORD_PLAN_POINTERMOVE_PERF__;
    delete window.__BIM_AI_PLAN_POINTERMOVE_PERF__;
    vi.restoreAllMocks();
  });
});
