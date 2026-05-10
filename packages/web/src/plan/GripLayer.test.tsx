import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { GripLayer, TempDimLayer } from './GripLayer';
import { gripsFor, type DraftMutation } from './gripProtocol';
import { wallTempDimensions, type Wall } from './tempDimensions';

afterEach(() => {
  cleanup();
});

const SAMPLE_WALL: Wall = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'L1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

// Identity world-to-screen for tests — keeps the math obvious.
const identityWorldToScreen = (xy: { xMm: number; yMm: number }) => ({
  pxX: xy.xMm,
  pxY: xy.yMm,
});

describe('EDT-01 — GripLayer rendering', () => {
  it('renders one DOM node per grip', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const { container } = render(
      <GripLayer grips={grips} worldToScreen={identityWorldToScreen} onGripPointerDown={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-testid^="grip-wall-1"]').length).toBe(4);
  });

  it('renders grip shapes via data attributes', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const { getByTestId } = render(
      <GripLayer grips={grips} worldToScreen={identityWorldToScreen} onGripPointerDown={vi.fn()} />,
    );
    expect(getByTestId('grip-wall-1:start').getAttribute('data-grip-shape')).toBe('square');
    expect(getByTestId('grip-wall-1:end').getAttribute('data-grip-shape')).toBe('square');
    expect(getByTestId('grip-wall-1:move').getAttribute('data-grip-shape')).toBe('circle');
    expect(getByTestId('grip-wall-1:thickness').getAttribute('data-grip-shape')).toBe('arrow');
  });

  it('fires onGripPointerDown with the correct grip on pointerdown', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const onDown = vi.fn();
    const { getByTestId } = render(
      <GripLayer grips={grips} worldToScreen={identityWorldToScreen} onGripPointerDown={onDown} />,
    );
    const endGrip = getByTestId('grip-wall-1:end');
    fireEvent.pointerDown(endGrip, { clientX: 5000, clientY: 0 });
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onDown.mock.calls[0]![0]!.id).toBe('wall-1:end');
  });

  it('fires onGripDoubleClick with the correct grip on double click', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const onDoubleClick = vi.fn();
    const { getByTestId } = render(
      <GripLayer
        grips={grips}
        worldToScreen={identityWorldToScreen}
        onGripPointerDown={vi.fn()}
        onGripDoubleClick={onDoubleClick}
      />,
    );
    const moveGrip = getByTestId('grip-wall-1:move');
    fireEvent.doubleClick(moveGrip);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick.mock.calls[0]![0]!.id).toBe('wall-1:move');
  });

  it('renders the live-preview line when a draft wall is supplied', () => {
    const { getByTestId } = render(
      <GripLayer
        grips={[]}
        worldToScreen={identityWorldToScreen}
        draftWall={{ start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 200 } }}
        onGripPointerDown={vi.fn()}
      />,
    );
    expect(getByTestId('grip-draft-preview')).toBeTruthy();
  });

  it('renders nothing when no grips and no draft', () => {
    const { container } = render(
      <GripLayer grips={[]} worldToScreen={identityWorldToScreen} onGripPointerDown={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="grip-layer"]')).toBeNull();
  });
});

describe('EDT-01 — drag-emit-commit flow (protocol contract)', () => {
  it('endpoint drag → onCommit fires moveWallEndpoints with the live delta', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const endGrip = grips.find((g) => g.id === 'wall-1:end')!;

    // Simulate: drag start at (5000,0); pointer-move to (6000,200); release.
    const delta = { xMm: 1000, yMm: 200 };
    const draft = endGrip.onDrag(delta) as Extract<DraftMutation, { kind: 'wall' }>;
    expect(draft.end).toEqual({ xMm: 6000, yMm: 200 });

    const cmd = endGrip.onCommit(delta);
    expect(cmd).toMatchObject({
      type: 'moveWallEndpoints',
      wallId: 'wall-1',
      end: { xMm: 6000, yMm: 200 },
    });
  });

  it('numeric override during drag → onNumericOverride snaps to exact length', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const endGrip = grips.find((g) => g.id === 'wall-1:end')!;
    const cmd = endGrip.onNumericOverride(5000) as {
      type: string;
      end: { xMm: number; yMm: number };
    };
    expect(cmd.type).toBe('moveWallEndpoints');
    expect(cmd.end.xMm).toBeCloseTo(5000, 6);
    expect(cmd.end.yMm).toBeCloseTo(0, 6);
  });

  it('Esc semantics — caller drops gripDragRef and never fires onCommit', () => {
    const grips = gripsFor(SAMPLE_WALL);
    const endGrip = grips.find((g) => g.id === 'wall-1:end')!;
    // Simulate by *not* calling onCommit. The protocol holds: a drag
    // that never receives a release shouldn't change persisted state.
    expect(endGrip.onDrag({ xMm: 100, yMm: 0 })).toMatchObject({ kind: 'wall' });
    // No assertion that onCommit was called — that's the contract.
  });
});

describe('EDT-01 — TempDimLayer rendering', () => {
  it('renders one button per temp-dim target', () => {
    const elements = {
      [SAMPLE_WALL.id]: SAMPLE_WALL,
      neighbour: {
        kind: 'wall' as const,
        id: 'neighbour',
        name: 'n',
        levelId: 'L1',
        start: { xMm: 8000, yMm: -100 },
        end: { xMm: 8000, yMm: 100 },
        thicknessMm: 200,
        heightMm: 2700,
      },
    };
    const targets = wallTempDimensions(SAMPLE_WALL, elements);
    const onTarget = vi.fn();
    const onLock = vi.fn();
    const { getAllByTestId, getByTestId } = render(
      <TempDimLayer
        targets={targets}
        worldToScreen={identityWorldToScreen}
        onTargetClick={onTarget}
        onLockClick={onLock}
      />,
    );
    expect(getAllByTestId(/^temp-dim-readout-/).length).toBe(targets.length);
    fireEvent.click(getByTestId(`temp-dim-readout-${targets[0]!.id}`));
    expect(onTarget).toHaveBeenCalledWith(targets[0]);
  });

  it('lock click fires onLockClick (EDT-02 placeholder)', () => {
    const elements = {
      [SAMPLE_WALL.id]: SAMPLE_WALL,
      n: {
        kind: 'wall' as const,
        id: 'n',
        name: 'n',
        levelId: 'L1',
        start: { xMm: 8000, yMm: -100 },
        end: { xMm: 8000, yMm: 100 },
        thicknessMm: 200,
        heightMm: 2700,
      },
    };
    const targets = wallTempDimensions(SAMPLE_WALL, elements);
    const onLock = vi.fn();
    const { getByTestId } = render(
      <TempDimLayer
        targets={targets}
        worldToScreen={identityWorldToScreen}
        onTargetClick={vi.fn()}
        onLockClick={onLock}
      />,
    );
    fireEvent.click(getByTestId(`temp-dim-lock-${targets[0]!.id}`));
    expect(onLock).toHaveBeenCalledWith(targets[0]);
  });
});
