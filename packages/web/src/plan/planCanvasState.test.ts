import { describe, expect, it } from 'vitest';
import {
  classifyPointerStart,
  draftingPaintFor,
  SnapEngine,
  type SnapCandidate,
} from './planCanvasState';

describe('draftingPaintFor — §14.2', () => {
  it('shows major + minor grid at fine scales', () => {
    const paint = draftingPaintFor(50);
    expect(paint.grid).toEqual({ showMajor: true, showMinor: true });
  });
  it('hides grid past 1:200', () => {
    expect(draftingPaintFor(500).grid).toEqual({
      showMajor: false,
      showMinor: false,
    });
  });
  it('emits visible hatches per scale', () => {
    expect(draftingPaintFor(50).visibleHatches.length).toBeGreaterThan(0);
    expect(draftingPaintFor(500).visibleHatches.length).toBe(0);
  });
  it('exposes a lineWidthPx accessor that scales with the camera', () => {
    const paint = draftingPaintFor(100);
    const w = paint.lineWidthPx('wall.cut');
    expect(w).toBeCloseTo(1, 6);
  });
  it('returns paper token reference for the drawing surface', () => {
    expect(draftingPaintFor(50).paperToken).toBe('--draft-paper');
  });
});

describe('SnapEngine — §14.4', () => {
  it('starts with the documented defaults', () => {
    const e = new SnapEngine();
    expect(e.isOn('endpoint')).toBe(true);
    expect(e.isOn('tangent')).toBe(false);
  });

  it('toggle flips the mode', () => {
    const e = new SnapEngine();
    e.toggle('grid');
    expect(e.isOn('grid')).toBe(false);
  });

  it('cycleExclusive switches a single mode at a time', () => {
    const e = new SnapEngine();
    const next = e.cycleExclusive();
    expect(next).toBeTruthy();
    const snap = e.snapshot();
    const onModes = (Object.entries(snap) as [string, boolean][]).filter(([, v]) => v);
    expect(onModes.length).toBe(1);
  });

  it('resolve returns the highest-priority active candidate', () => {
    const e = new SnapEngine();
    const candidates: SnapCandidate[] = [
      { mode: 'grid', xMm: 0, yMm: 0 },
      { mode: 'midpoint', xMm: 1, yMm: 1 },
      { mode: 'endpoint', xMm: 2, yMm: 2 },
    ];
    expect(e.resolve(candidates)?.mode).toBe('endpoint');
  });

  it('skips disabled modes', () => {
    const e = new SnapEngine();
    e.setOn('endpoint', false);
    e.setOn('midpoint', false);
    const hit = e.resolve([
      { mode: 'midpoint', xMm: 0, yMm: 0 },
      { mode: 'grid', xMm: 1, yMm: 1 },
    ]);
    expect(hit?.mode).toBe('grid');
  });

  it('pillLabel renders mode + optional detail', () => {
    const e = new SnapEngine();
    expect(e.pillLabel({ mode: 'endpoint', xMm: 0, yMm: 0 })).toBe('endpoint');
    expect(e.pillLabel({ mode: 'midpoint', xMm: 0, yMm: 0, detail: 'wall hf-1' })).toBe(
      'midpoint · wall hf-1',
    );
  });
});

describe('classifyPointerStart — §14.3', () => {
  it('Space + LMB → pan', () => {
    expect(classifyPointerStart({ button: 0, spacePressed: true })).toBe('pan');
  });
  it('middle button → pan', () => {
    expect(classifyPointerStart({ button: 1 })).toBe('pan');
  });
  it('drawing tool → draw', () => {
    expect(classifyPointerStart({ button: 0, activeTool: 'wall' })).toBe('draw');
  });
  it('Shift + LMB → add-to-selection', () => {
    expect(classifyPointerStart({ button: 0, shiftKey: true })).toBe('add-to-selection');
  });
  it('Alt + LMB → toggle-selection', () => {
    expect(classifyPointerStart({ button: 0, altKey: true })).toBe('toggle-selection');
  });
  it('LMB drag right-to-left → crossing marquee', () => {
    expect(
      classifyPointerStart({ button: 0, dragDirection: 'right-to-left', activeTool: 'select' }),
    ).toBe('marquee-crossing');
  });
  it('LMB drag left-to-right → window marquee', () => {
    expect(
      classifyPointerStart({ button: 0, dragDirection: 'left-to-right', activeTool: 'select' }),
    ).toBe('marquee-window');
  });
  it('plain LMB → drag-move', () => {
    expect(classifyPointerStart({ button: 0 })).toBe('drag-move');
  });
});
