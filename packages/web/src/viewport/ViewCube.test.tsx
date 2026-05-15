import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ViewCube } from './ViewCube';

// jsdom does not implement PointerEvent — minimal polyfill for drag tests.
if (typeof (globalThis as Record<string, unknown>).PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    movementX: number;
    movementY: number;
    constructor(
      type: string,
      init: MouseEventInit & { movementX?: number; movementY?: number } = {},
    ) {
      super(type, init);
      this.movementX = init.movementX ?? 0;
      this.movementY = init.movementY ?? 0;
    }
  }
  (globalThis as Record<string, unknown>).PointerEvent = PointerEvent;
}

afterEach(() => {
  cleanup();
});

describe('<ViewCube /> — spec §15.4', () => {
  it('renders six face buttons', () => {
    const { getByLabelText } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    for (const face of ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM']) {
      expect(getByLabelText(`Align camera to ${face}`)).toBeTruthy();
    }
  });

  it('does not render the legacy chevron or context menu controls', () => {
    const { queryByLabelText, queryByRole } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    expect(queryByLabelText('Look from below')).toBeNull();
    expect(queryByLabelText('ViewCube menu')).toBeNull();
    expect(queryByRole('menu', { name: 'ViewCube menu' })).toBeNull();
  });

  it('emits onPick with the right alignment when a face is clicked', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={onPick} />,
    );
    fireEvent.click(getByLabelText('Align camera to TOP'));
    expect(onPick).toHaveBeenCalled();
    const [pick, alignment] = onPick.mock.calls[0]!;
    expect(pick).toEqual({ kind: 'face', face: 'TOP' });
    expect(alignment.up).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('corner buttons emit corner picks', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={onPick} />,
    );
    fireEvent.click(getByLabelText('Align camera to TOP-NE'));
    expect(onPick.mock.calls[0]![0]).toEqual({ kind: 'corner', corner: 'TOP-NE' });
  });

  it('drag on stage fires onDrag and suppresses the subsequent click', () => {
    const onPick = vi.fn();
    const onDrag = vi.fn();
    const { getByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={onPick} onDrag={onDrag} />,
    );
    const stage = getByTestId('view-cube-stage');
    // pointerdown on the inner stage div kicks off the window drag listeners.
    fireEvent.pointerDown(stage, { button: 0, clientX: 50, clientY: 50 });
    // Dispatch window-level pointermove events (large total movement → drag).
    for (let i = 0; i < 10; i++) {
      const ev = new Event('pointermove', { bubbles: true }) as PointerEvent & {
        movementX: number;
        movementY: number;
      };
      Object.defineProperty(ev, 'movementX', { value: 3 });
      Object.defineProperty(ev, 'movementY', { value: 2 });
      window.dispatchEvent(ev);
    }
    window.dispatchEvent(new Event('pointerup', { bubbles: true }));
    // onDrag should have been called with movement deltas.
    expect(onDrag).toHaveBeenCalledWith(3, 2);
    // onPick should NOT fire on the subsequent click (drag suppresses it).
    fireEvent.click(stage);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('compass label reflects currentAzimuth', () => {
    const { getByTestId, rerender } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    expect(getByTestId('view-cube-compass').dataset.cardinal).toBe('N');
    rerender(
      <ViewCube currentAzimuth={Math.PI / 2} currentElevation={0.45} onPick={() => undefined} />,
    );
    expect(getByTestId('view-cube-compass').dataset.cardinal).toBe('E');
  });

  it('compass cardinal letters orbit around the ring with currentAzimuth', () => {
    const { getByTestId, rerender } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    const northAtZero = getByTestId('view-cube-compass')
      .querySelector('text:nth-of-type(2)')
      ?.getAttribute('x');

    rerender(
      <ViewCube currentAzimuth={Math.PI / 2} currentElevation={0.45} onPick={() => undefined} />,
    );
    const northAtEast = getByTestId('view-cube-compass')
      .querySelector('text:nth-of-type(2)')
      ?.getAttribute('x');

    expect(northAtZero).toBeTruthy();
    expect(northAtEast).toBeTruthy();
    expect(northAtZero).not.toBe(northAtEast);
  });
});
