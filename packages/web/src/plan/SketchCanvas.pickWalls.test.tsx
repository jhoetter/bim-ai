/**
 * SKT-02 — Pick Walls UI flow tests.
 *
 * Verifies:
 *   - the Pick Walls toolbar button shows when wallsForPicking is non-empty
 *   - hovering near a wall (in pick mode) highlights it green
 *   - clicking a hovered wall fires the pick-wall API and renders the
 *     server-returned line set
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';

import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';
import {
  hitTestWallAtMm,
  snapPointToNearestWallFaceMm,
  type WallForPicking,
} from './SketchCanvasPickWalls';

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

const RECT_WALLS: WallForPicking[] = [
  { id: 'w-south', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 4000, yMm: 0 }, thicknessMm: 200 },
  {
    id: 'w-east',
    startMm: { xMm: 4000, yMm: 0 },
    endMm: { xMm: 4000, yMm: 3000 },
    thicknessMm: 200,
  },
  {
    id: 'w-north',
    startMm: { xMm: 4000, yMm: 3000 },
    endMm: { xMm: 0, yMm: 3000 },
    thicknessMm: 200,
  },
  { id: 'w-west', startMm: { xMm: 0, yMm: 3000 }, endMm: { xMm: 0, yMm: 0 }, thicknessMm: 200 },
];

describe('SKT-02 — hitTestWallAtMm pure logic', () => {
  it('returns the closest wall id within tolerance', () => {
    expect(hitTestWallAtMm(RECT_WALLS, { xMm: 2000, yMm: 0 })).toBe('w-south');
    expect(hitTestWallAtMm(RECT_WALLS, { xMm: 4000, yMm: 1500 })).toBe('w-east');
  });

  it('returns null when cursor is far from every wall', () => {
    expect(hitTestWallAtMm(RECT_WALLS, { xMm: 2000, yMm: 1500 })).toBeNull();
  });

  it('clicking a wall yields its id, clicking near a different wall yields a different id', () => {
    const a = hitTestWallAtMm(RECT_WALLS, { xMm: 2000, yMm: 0 });
    const b = hitTestWallAtMm(RECT_WALLS, { xMm: 4000, yMm: 1500 });
    expect(a).toBe('w-south');
    expect(b).toBe('w-east');
    expect(a).not.toBe(b);
  });

  it('snaps area boundary points to the nearest wall face within tolerance', () => {
    expect(snapPointToNearestWallFaceMm(RECT_WALLS, { xMm: 2000, yMm: 90 })).toEqual({
      xMm: 2000,
      yMm: 100,
    });
    expect(snapPointToNearestWallFaceMm(RECT_WALLS, { xMm: 2500, yMm: 1500 })).toBeNull();
  });
});

describe('SKT-02 — Pick Walls toolbar + click flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders Pick Walls button when wallsForPicking is non-empty and pick endpoint fires on click', async () => {
    const pickedLines = [
      {
        fromMm: { xMm: 0, yMm: 100 },
        toMm: { xMm: 4000, yMm: 100 },
      },
    ];
    let pickCalls = 0;
    let lastPickedWallId: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/sketch-sessions') {
          return new Response(
            JSON.stringify({
              session: {
                sessionId: 'sk-pw',
                modelId: 'm-1',
                elementKind: 'floor',
                levelId: 'lvl-1',
                lines: [],
                status: 'open',
                pickWallsOffsetMode: 'interior_face',
                pickedWalls: [],
              },
              validation: {
                valid: false,
                issues: [{ code: 'open_loop', message: 'empty' }],
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url === '/api/sketch-sessions/sk-pw/pick-wall') {
          pickCalls += 1;
          const body = init?.body ? JSON.parse(init.body as string) : {};
          lastPickedWallId = body.wallId ?? null;
          return new Response(
            JSON.stringify({
              session: {
                sessionId: 'sk-pw',
                modelId: 'm-1',
                elementKind: 'floor',
                levelId: 'lvl-1',
                lines: pickedLines,
                status: 'open',
                pickWallsOffsetMode: 'interior_face',
                pickedWalls: [{ wallId: lastPickedWallId, lineIndex: 0 }],
              },
              validation: {
                valid: false,
                issues: [{ code: 'open_loop', message: 'one line picked' }],
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('not mocked', { status: 500 });
      }),
    );

    const refs = makeRefs();
    // Pointer always reports (2000, 0) → directly on w-south's centerline.
    refs.pointer.current = () => ({ xMm: 2000, yMm: 0 });

    const { findByTestId, container } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        wallsForPicking={RECT_WALLS}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );

    const pickButton = (await findByTestId('sketch-tool-pick')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(pickButton);
    });

    // After entering pick mode, a pointer move highlights the south wall green.
    const overlay = await findByTestId('sketch-canvas');
    await act(async () => {
      fireEvent.pointerMove(overlay, { clientX: 0, clientY: 0 });
    });
    await waitFor(() => container.querySelector('[data-testid="sketch-pick-hover"]'));
    expect(container.querySelector('[data-testid="sketch-pick-hover"]')).not.toBeNull();

    // Clicking emits pick-wall and renders the returned line.
    await act(async () => {
      fireEvent.pointerDown(overlay, { clientX: 0, clientY: 0 });
    });
    await waitFor(() => expect(pickCalls).toBe(1));
    expect(lastPickedWallId).toBe('w-south');
    await waitFor(() =>
      expect(
        container.querySelectorAll('[data-testid^="sketch-line-"]').length,
      ).toBeGreaterThanOrEqual(1),
    );
  });

  it('hides Pick Walls button when wallsForPicking is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: 'sk-empty',
              modelId: 'm-1',
              elementKind: 'floor',
              levelId: 'lvl-1',
              lines: [],
              status: 'open',
              pickWallsOffsetMode: 'interior_face',
              pickedWalls: [],
            },
            validation: { valid: false, issues: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const refs = makeRefs();
    const { queryByTestId, getByTestId } = render(
      <SketchCanvas
        modelId="m-1"
        levelId="lvl-1"
        pointerToMmRef={refs.pointer}
        mmToScreenRef={refs.screen}
        wallsForPicking={[]}
        onFinished={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );
    await waitFor(() => getByTestId('sketch-toolbar'));
    expect(queryByTestId('sketch-tool-pick')).toBeNull();
  });
});
