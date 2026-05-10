/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
/**
 * SKT-01 — SketchCanvas overlay UI tests.
 *
 * Verifies the load-bearing UX flow:
 *   - opens a session on mount and renders status text
 *   - Finish is disabled while validation reports an open loop
 *   - Finish enables once the server reports a valid loop
 *   - Cancel button calls the cancel API and unmounts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';

import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const res = await handler(url, init);
      return res;
    }),
  );
}

const noopPointer: PointerToMm = () => ({ xMm: 0, yMm: 0 });
const noopMmToScreen: MmToScreen = () => ({ x: 0, y: 0 });

function makeRefs(): {
  pointer: RefObject<PointerToMm | null>;
  screen: RefObject<MmToScreen | null>;
} {
  const pointer = createRef<PointerToMm | null>();
  pointer.current = noopPointer;
  const screen = createRef<MmToScreen | null>();
  screen.current = noopMmToScreen;
  return { pointer, screen };
}

describe('SKT-01 — SketchCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('opens a session on mount and shows the open-loop status', async () => {
    mockFetch(async (url) => {
      if (url === '/api/sketch-sessions') {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: 'sk-1',
              modelId: 'm-1',
              elementKind: 'floor',
              levelId: 'lvl-1',
              lines: [],
              status: 'open',
            },
            validation: {
              valid: false,
              issues: [
                {
                  code: 'open_loop',
                  message: 'Sketch is empty — draw at least 3 lines forming a closed loop.',
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('not mocked', { status: 500 });
    });

    const refs = makeRefs();
    const onFinished = vi.fn();
    const onCancelled = vi.fn();

    const { getByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={onFinished}
        onCancelled={onCancelled}
      />,
    );

    await waitFor(() =>
      expect(getByTestId('sketch-status').textContent).toContain('Sketch is empty'),
    );
    const finish = getByTestId('sketch-finish') as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
  });

  it('renders the in-progress sketch in turquoise via SVG and enables Finish when valid', async () => {
    let openCalls = 0;
    mockFetch(async (url) => {
      if (url === '/api/sketch-sessions') {
        openCalls += 1;
        return new Response(
          JSON.stringify({
            session: {
              sessionId: 'sk-2',
              modelId: 'm-1',
              elementKind: 'floor',
              levelId: 'lvl-1',
              lines: [
                { fromMm: { xMm: 0, yMm: 0 }, toMm: { xMm: 1000, yMm: 0 } },
                { fromMm: { xMm: 1000, yMm: 0 }, toMm: { xMm: 1000, yMm: 1000 } },
                { fromMm: { xMm: 1000, yMm: 1000 }, toMm: { xMm: 0, yMm: 1000 } },
                { fromMm: { xMm: 0, yMm: 1000 }, toMm: { xMm: 0, yMm: 0 } },
              ],
              status: 'open',
            },
            validation: { valid: true, issues: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('not mocked', { status: 500 });
    });

    const refs = makeRefs();
    refs.screen.current = (pt) => ({ x: pt.xMm / 5, y: 100 - pt.yMm / 5 });

    const { container, getByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(getByTestId('sketch-status').textContent).toContain('Ready to Finish'),
    );
    expect(openCalls).toBe(1);
    const finish = getByTestId('sketch-finish') as HTMLButtonElement;
    expect(finish.disabled).toBe(false);
    // Confirm we drew turquoise SVG lines (one per sketch line).
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(4);
    const stroke = lines[0]!.getAttribute('stroke');
    expect(stroke?.toLowerCase()).toBe('#3fc5d3');
  });

  it('cancel calls the cancel endpoint and triggers onCancelled', async () => {
    let openCalls = 0;
    let cancelCalls = 0;
    mockFetch(async (url) => {
      if (url === '/api/sketch-sessions') {
        openCalls += 1;
        return new Response(
          JSON.stringify({
            session: {
              sessionId: 'sk-3',
              modelId: 'm-1',
              elementKind: 'floor',
              levelId: 'lvl-1',
              lines: [],
              status: 'open',
            },
            validation: { valid: false, issues: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/sketch-sessions/sk-3/cancel') {
        cancelCalls += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('not mocked', { status: 500 });
    });

    const refs = makeRefs();
    const onCancelled = vi.fn();
    const { getByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={vi.fn()}
        onCancelled={onCancelled}
      />,
    );

    await waitFor(() => expect(openCalls).toBe(1));
    await act(async () => {
      fireEvent.click(getByTestId('sketch-cancel'));
    });
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(cancelCalls).toBe(1);
  });
});
