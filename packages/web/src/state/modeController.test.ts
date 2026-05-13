import { describe, expect, it, vi } from 'vitest';
import {
  applySplitDividerHotkey,
  dragSplitDivider,
  MODE_HOTKEYS,
  ModeController,
  modeForHotkey,
} from './modeController';

describe('modeForHotkey — spec §7', () => {
  it('maps 1..8 to the documented modes', () => {
    expect(modeForHotkey('1')).toBe('plan');
    expect(modeForHotkey('2')).toBe('3d');
    expect(modeForHotkey('3')).toBeNull();
    expect(modeForHotkey('4')).toBe('section');
    expect(modeForHotkey('5')).toBe('sheet');
    expect(modeForHotkey('6')).toBe('schedule');
    expect(modeForHotkey('7')).toBeNull();
    expect(modeForHotkey('8')).toBe('concept');
  });
  it('returns null for unrelated keys', () => {
    expect(modeForHotkey('a')).toBeNull();
    expect(modeForHotkey('0')).toBeNull();
  });
  it('exposes 6 mode hotkeys', () => {
    expect(MODE_HOTKEYS).toHaveLength(6);
  });
});

describe('ModeController — spec §7', () => {
  it('starts on the seeded mode and is idempotent on reswitch', () => {
    const c = new ModeController('plan');
    expect(c.current()).toBe('plan');
    c.switch('plan');
    expect(c.current()).toBe('plan');
  });

  it('captures and restores per-mode state on switch', () => {
    const planAdapter = {
      capture: vi.fn(() => ({ tool: 'wall', cameraScale: 100 })),
      restore: vi.fn(),
    };
    const threeAdapter = {
      capture: vi.fn(() => ({ azimuth: 0.5 })),
      restore: vi.fn(),
    };
    const c = new ModeController('plan', { plan: planAdapter, '3d': threeAdapter });
    c.switch('3d');
    expect(planAdapter.capture).toHaveBeenCalled();
    c.switch('plan');
    expect(threeAdapter.capture).toHaveBeenCalled();
    expect(planAdapter.restore).toHaveBeenCalledWith({ tool: 'wall', cameraScale: 100 });
  });

  it('reset clears the per-mode history', () => {
    const adapter = {
      capture: vi.fn(() => ({ x: 1 })),
      restore: vi.fn(),
    };
    const c = new ModeController('plan', { plan: adapter });
    c.switch('3d');
    c.reset();
    c.switch('plan');
    expect(adapter.restore).not.toHaveBeenCalled();
  });
});

describe('split divider — spec §20.3', () => {
  it('drag clamps to 0..1', () => {
    const moved = dragSplitDivider({ leftFraction: 0.5 }, 99999, 1000);
    expect(moved.leftFraction).toBeLessThanOrEqual(1);
  });
  it('drag snaps to 33% / 50% / 67%', () => {
    expect(dragSplitDivider({ leftFraction: 0.5 }, -170, 1000).leftFraction).toBe(0.33);
    expect(dragSplitDivider({ leftFraction: 0.5 }, 0, 1000).leftFraction).toBe(0.5);
    expect(dragSplitDivider({ leftFraction: 0.5 }, 170, 1000).leftFraction).toBe(0.67);
  });
  it('[ collapses left, ] collapses right', () => {
    expect(applySplitDividerHotkey({ leftFraction: 0.5 }, '[').leftFraction).toBe(0);
    expect(applySplitDividerHotkey({ leftFraction: 0.5 }, ']').leftFraction).toBe(1);
  });
});
