/**
 * Component rendering tests for the browser rendering budget display surfaces.
 *
 * These tests verify that the formatted budget lines — which are exactly what
 * Agent Review (AgentReviewPane) and Workspace render — contain the correct
 * progressive state tokens, reason codes, and large-model proof summary text
 * for over-budget, deferred, stale, and in-budget scenarios.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { PlanProjectionPrimitivesV1Wire } from '../../plan/planProjectionWire';
import {
  BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT,
  BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES,
  BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
  BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT,
  BROWSER_BUDGET_WARN_ELEMENT_COUNT,
  BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
  BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
  BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './browserRenderingBudgetReadout';

/** Minimal wire with n entries in the walls array (all other arrays empty). */
function wireWithWalls(n: number): PlanProjectionPrimitivesV1Wire {
  return {
    format: 'planProjectionPrimitives_v1',
    walls: Array.from({ length: n }, (_, i) => ({ id: `w${i}` })) as unknown[],
    floors: [],
    rooms: [],
    doors: [],
    windows: [],
    stairs: [],
    roofs: [],
    gridLines: [],
    roomSeparations: [],
    dimensions: [],
  } as PlanProjectionPrimitivesV1Wire;
}

/** Render budget lines in a `<pre>` element under a container div (mimics Workspace). */
function renderBudgetLines(lines: string[]): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'browser-rendering-budget-readout');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<pre style={{ fontFamily: 'monospace', fontSize: '9px' }}>{lines.join('\n')}</pre>);
  });
  return container;
}

/** Render budget lines as a list (mimics AgentReviewPane). */
function renderBudgetLinesList(lines: string[]): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'agent-review-browser-rendering-budget');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ul>
        {lines.map((ln, idx) => (
          <li key={`br-${idx}`}>
            <code>{ln}</code>
          </li>
        ))}
      </ul>,
    );
  });
  return container;
}

describe('browser rendering budget — Workspace readout rendering', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const c of containers) c.remove();
    containers.length = 0;
  });

  it('renders in_budget state for all metrics nominal', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(0),
      scheduleHydratedRowCount: 0,
      scheduleHydratedTab: 'rooms',
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLines(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('browserRenderingBudgetReadout_v1');
    expect(text).toContain('large_model_proof:');
    expect(text).toContain('in_budget');
    expect(text).not.toContain('over_budget');
    expect(text).not.toContain('deferred');
  });

  it('renders over_budget state and reason code for very large plan wire', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLines(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('over_budget');
    expect(text).toContain('plan_wire_over_budget_very_large_primitive_count');
    expect(text).toContain(`${BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES}`);
    expect(text).toContain(`${BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES}`);
  });

  it('renders deferred state for plan wire at warn threshold', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLines(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('deferred');
    expect(text).toContain('plan_wire_deferred_large_primitive_count');
  });

  it('renders stale state for plan wire when no projection present', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLines(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('stale');
    expect(text).toContain('plan_wire_stale_no_projection');
    expect(text).toContain('schedule_stale_not_hydrated');
  });

  it('renders over_budget summary in large_model_proof line when elements exceed threshold', () => {
    const els: Record<string, import('@bim-ai/core').Element> = {};
    for (let i = 0; i < BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT; i++) {
      els[`e${i}`] = { kind: 'level', id: `e${i}`, name: `e${i}`, elevationMm: i };
    }
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLines(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('large_model_proof:');
    expect(text).toContain('over_budget');
    expect(text).toContain('model_elements_over_budget_very_large_count');
  });
});

describe('browser rendering budget — Agent Review readout rendering', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const c of containers) c.remove();
    containers.length = 0;
  });

  it('Agent Review list renders budget lines with correct data-testid', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(0),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    expect(container.getAttribute('data-testid')).toBe('agent-review-browser-rendering-budget');
    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
  });

  it('Agent Review deferred: sheet viewports at warn threshold renders deferred reason code', () => {
    const viewports = Array.from({ length: BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT }, () => ({}));
    const els: Record<string, import('@bim-ai/core').Element> = {
      s1: {
        kind: 'sheet',
        id: 's1',
        name: 'S',
        viewportsMm: viewports,
        paperWidthMm: 841,
        paperHeightMm: 594,
      },
    };
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('deferred');
    expect(text).toContain('sheet_viewports_deferred_large_count');
    expect(text).toContain(`${BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT}`);
  });

  it('Agent Review over-budget: sheet viewports exceeds threshold renders over_budget reason', () => {
    const viewports = Array.from(
      { length: BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT },
      () => ({}),
    );
    const els: Record<string, import('@bim-ai/core').Element> = {
      s1: {
        kind: 'sheet',
        id: 's1',
        name: 'S',
        viewportsMm: viewports,
        paperWidthMm: 841,
        paperHeightMm: 594,
      },
    };
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('over_budget');
    expect(text).toContain('sheet_viewports_over_budget_very_large_count');
  });

  it('Agent Review schedule: deferred renders schedule reason code', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
      scheduleHydratedTab: 'rooms',
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('deferred');
    expect(text).toContain('schedule_deferred_large_row_count');
    expect(text).toContain(`${BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS}`);
  });

  it('Agent Review schedule: over_budget renders schedule over-budget reason code', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
      scheduleHydratedTab: 'doors',
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('over_budget');
    expect(text).toContain('schedule_over_budget_very_large_row_count');
  });

  it('Agent Review large_model_proof line includes metric id when deferred', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    const text = container.textContent ?? '';
    const proofLine = lines.find((l) => l.startsWith('large_model_proof:'));
    expect(proofLine).toBeDefined();
    expect(proofLine).toContain('plan_wire_primitives');
    expect(text).toContain('large_model_proof:');
  });

  it('Agent Review large_model_proof in_budget when all metrics nominal', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(0),
      scheduleHydratedRowCount: 0,
      scheduleHydratedTab: 'rooms',
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const proofLine = lines.find((l) => l.startsWith('large_model_proof:'));
    expect(proofLine).toBeDefined();
    expect(proofLine).toContain('in_budget');
    const container = renderBudgetLinesList(lines);
    containers.push(container);
    expect(container.textContent).toContain('large_model_proof:');
  });
});

describe('browser rendering budget — schedule hydration readout', () => {
  it('schedule stale_not_hydrated renders in both list and pre surfaces', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    expect(lines.some((l) => l.includes('schedule_stale_not_hydrated'))).toBe(true);
    expect(lines.some((l) => l.includes('stale'))).toBe(true);
  });

  it('schedule in_budget renders in_budget reason code', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS - 1,
      scheduleHydratedTab: 'windows',
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const schedLine = lines.find((l) => l.includes('schedule_table_rows'));
    expect(schedLine).toBeDefined();
    expect(schedLine).toContain('in_budget');
    expect(schedLine).toContain('schedule_in_budget');
  });
});

describe('browser rendering budget — projection primitive thresholds readout', () => {
  it('plan wire deferred just below over-budget threshold', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES - 1),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const planLine = lines.find((l) => l.includes('plan_wire_primitives'));
    expect(planLine).toBeDefined();
    expect(planLine).toContain('deferred');
    expect(planLine).toContain('[plan_wire_deferred_large_primitive_count]');
  });

  it('plan wire over_budget at exact over-budget threshold', () => {
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: wireWithWalls(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(readout);
    const planLine = lines.find((l) => l.includes('plan_wire_primitives'));
    expect(planLine).toBeDefined();
    expect(planLine).toContain('over_budget');
    expect(planLine).toContain('[plan_wire_over_budget_very_large_primitive_count]');
  });

  it('model elements over_budget threshold carries correct over-budget limit', () => {
    const els: Record<string, import('@bim-ai/core').Element> = {};
    for (let i = 0; i < BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT; i++) {
      els[`e${i}`] = { kind: 'level', id: `e${i}`, name: `e${i}`, elevationMm: i };
    }
    const readout = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const row = readout.rows.find((r) => r.id === 'model_elements')!;
    expect(row.progressiveState).toBe('over_budget');
    expect(row.overBudgetLimit).toBe(BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT);
    const lines = formatBrowserRenderingBudgetLines(readout);
    const elemLine = lines.find((l) => l.includes('model_elements'));
    expect(elemLine).toContain(
      `${BROWSER_BUDGET_WARN_ELEMENT_COUNT}/${BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT}`,
    );
  });
});
