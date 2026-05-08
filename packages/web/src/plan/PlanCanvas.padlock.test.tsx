/**
 * EDT-02 — assert that PlanCanvas's `handleTempDimLockClick` dispatches a
 * `createConstraint` engine command with the right shape on padlock click.
 *
 * PlanCanvas itself depends on three.js + DOM and is cumbersome to mount
 * in JSDOM (see `PlanCanvas.toolDestubs.test.ts` for the same pattern).
 * We assert at the source level that the dispatched command literal
 * matches the expected shape, plus exercise `TempDimLayer` directly to
 * confirm the click reaches the handler with both wall ids.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { TempDimLayer } from './GripLayer';
import { wallTempDimensions, type Wall } from './tempDimensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = readFileSync(path.join(__dirname, 'PlanCanvas.tsx'), 'utf8');

afterEach(() => {
  cleanup();
});

const wall = (id: string, x: number): Wall => ({
  kind: 'wall',
  id,
  name: id,
  levelId: 'L1',
  start: { xMm: x, yMm: 0 },
  end: { xMm: x, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 2700,
});

const identity = (xy: { xMm: number; yMm: number }) => ({ pxX: xy.xMm, pxY: xy.yMm });

describe('EDT-02 — handleTempDimLockClick dispatches createConstraint', () => {
  it('PlanCanvas.tsx contains the createConstraint dispatch with the right shape', () => {
    expect(SRC).toMatch(/onSemanticCommand\(\s*\{\s*type:\s*['"]createConstraint['"]/);
    expect(SRC).toMatch(/rule:\s*['"]equal_distance['"]/);
    expect(SRC).toMatch(/refsA:\s*\[\{\s*elementId:\s*target\.aId/);
    expect(SRC).toMatch(/refsB:\s*\[\{\s*elementId:\s*target\.bId/);
    expect(SRC).toMatch(/lockedValueMm:\s*target\.distanceMm/);
    expect(SRC).toMatch(/severity:\s*['"]error['"]/);
  });

  it('PlanCanvas.tsx no longer carries the EDT-02 stub comment', () => {
    expect(SRC).not.toMatch(/EDT-02 territory — render a hint tooltip/);
  });

  it('TempDimLayer routes a lock click with the target carrying both wall ids', () => {
    const elements: Record<string, Wall> = {
      'w-a': wall('w-a', 0),
      'w-b': wall('w-b', 5000),
    };
    const targets = wallTempDimensions(elements['w-a']!, elements);
    expect(targets.length).toBeGreaterThan(0);
    const onLock = vi.fn();
    const { getByTestId } = render(
      <TempDimLayer
        targets={targets}
        worldToScreen={identity}
        onTargetClick={vi.fn()}
        onLockClick={onLock}
      />,
    );
    fireEvent.click(getByTestId(`temp-dim-lock-${targets[0]!.id}`));
    expect(onLock).toHaveBeenCalledTimes(1);
    const target = onLock.mock.calls[0]![0];
    expect(target.aId).toBe('w-a');
    expect(target.bId).toBe('w-b');
    expect(target.distanceMm).toBe(5000);
  });

  it('renders the locked badge when isLocked returns true', () => {
    const elements: Record<string, Wall> = {
      'w-a': wall('w-a', 0),
      'w-b': wall('w-b', 5000),
    };
    const targets = wallTempDimensions(elements['w-a']!, elements);
    const { getByTestId } = render(
      <TempDimLayer
        targets={targets}
        worldToScreen={identity}
        onTargetClick={vi.fn()}
        onLockClick={vi.fn()}
        isLocked={() => true}
      />,
    );
    const btn = getByTestId(`temp-dim-lock-${targets[0]!.id}`);
    expect(btn.getAttribute('data-locked')).toBe('true');
    expect(btn.textContent).toBe('🔒');
  });
});
