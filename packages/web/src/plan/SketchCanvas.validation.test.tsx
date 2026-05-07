/**
 * SKT-03 — Sketch validation feedback UI tests.
 *
 * Acceptance: drawing 3 sides of a rectangle and trying to Finish → button
 * disabled, status panel shows "Line must be in closed loop", offending
 * vertex highlighted red. Verifies:
 *   - Finish button disabled when validation fails
 *   - status panel renders one row per issue
 *   - Tab cycles through issues (active row gets data-active="true")
 *   - error lines render with the error stroke
 *   - Auto-close button shows when there's exactly one open gap
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';

import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeRefs(): {
  pointer: RefObject<PointerToMm | null>;
  screen: RefObject<MmToScreen | null>;
} {
  const pointer = createRef<PointerToMm | null>();
  pointer.current = () => ({ xMm: 0, yMm: 0 });
  const screen = createRef<MmToScreen | null>();
  screen.current = (pt) => ({ x: pt.xMm / 5, y: 100 - pt.yMm / 5 });
  return { pointer, screen };
}

const THREE_SIDES_OPEN_LOOP = {
  session: {
    sessionId: 'sk-3-sides',
    modelId: 'm-1',
    elementKind: 'floor',
    levelId: 'lvl-1',
    lines: [
      { fromMm: { xMm: 0, yMm: 0 }, toMm: { xMm: 1000, yMm: 0 } },
      { fromMm: { xMm: 1000, yMm: 0 }, toMm: { xMm: 1000, yMm: 1000 } },
      { fromMm: { xMm: 1000, yMm: 1000 }, toMm: { xMm: 0, yMm: 1000 } },
    ],
    status: 'open',
    pickWallsOffsetMode: 'interior_face',
    pickedWalls: [],
  },
  validation: {
    valid: false,
    issues: [
      {
        code: 'open_loop',
        message: 'Lines must form a closed loop — 2 vertex(es) have ≠ 2 incident edges.',
        lineIndices: [0, 2],
      },
    ],
  },
};

describe('SKT-03 — validation feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('disables Finish, shows the closed-loop issue, and highlights offending vertex', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(THREE_SIDES_OPEN_LOOP), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const refs = makeRefs();
    const { findByTestId, container } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );

    const finish = (await findByTestId('sketch-finish')) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);

    const status = await findByTestId('sketch-status');
    expect(status.textContent).toContain('Lines must form a closed loop');

    const issueList = await findByTestId('sketch-issue-list');
    expect(issueList.children.length).toBe(1);

    // Open-loop highlights two endpoint vertices in red:
    await waitFor(() => {
      const reds = container.querySelectorAll('[data-testid^="sketch-open-vertex-"]');
      expect(reds.length).toBeGreaterThan(0);
    });

    // Lines flagged in lineIndices render with the error stroke:
    expect(container.querySelector('[data-testid="sketch-line-error-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sketch-line-error-2"]')).not.toBeNull();
  });

  it('shows Auto-close when exactly one missing segment can join two opens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(THREE_SIDES_OPEN_LOOP), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const refs = makeRefs();
    const { findByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );

    const autoClose = await findByTestId('sketch-auto-close');
    expect(autoClose).toBeTruthy();
  });

  it('Tab cycles between issues and marks the active row', async () => {
    const twoIssues = {
      session: {
        ...THREE_SIDES_OPEN_LOOP.session,
        sessionId: 'sk-2-issues',
      },
      validation: {
        valid: false,
        issues: [
          { code: 'open_loop', message: 'first', lineIndices: [0] },
          { code: 'self_intersection', message: 'second', lineIndices: [1, 2] },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(twoIssues), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const refs = makeRefs();
    const { findByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );

    const first = await findByTestId('sketch-issue-0');
    const second = await findByTestId('sketch-issue-1');
    expect(first.getAttribute('data-active')).toBe('true');
    expect(second.getAttribute('data-active')).toBe('false');

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
    });
    await waitFor(() => expect(second.getAttribute('data-active')).toBe('true'));
    expect(first.getAttribute('data-active')).toBe('false');
  });
});
