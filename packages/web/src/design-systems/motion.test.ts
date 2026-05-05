import { describe, expect, it } from 'vitest';
import {
  MOTION_TABLE,
  maxDurationMs,
  motionFor,
  transitionCSS,
  type MotionSurface,
} from './motion';

const ALL_SURFACES: MotionSurface[] = [
  'mode-switch',
  'panel-slide',
  'view-cube-snap',
  'snap-pill',
  'tool-palette-hover',
  'toast',
  'inspector-tab-change',
  'selection-halo',
];

describe('MOTION_TABLE — spec §21', () => {
  it('covers every documented surface', () => {
    for (const s of ALL_SURFACES) expect(MOTION_TABLE[s]).toBeDefined();
  });
  it('mode-switch uses 240 ms and a 4 px slide', () => {
    expect(MOTION_TABLE['mode-switch'].durationMs).toBe(240);
    expect(MOTION_TABLE['mode-switch'].translateXPx).toBe(4);
  });
  it('selection-halo is instant', () => {
    expect(MOTION_TABLE['selection-halo'].durationMs).toBe(0);
  });
  it('no surface exceeds the 240 ms ceiling', () => {
    expect(maxDurationMs()).toBeLessThanOrEqual(240);
  });
});

describe('motionFor + reduced-motion', () => {
  it('returns the spec when reducedMotion is false', () => {
    expect(motionFor('snap-pill').durationMs).toBe(80);
  });
  it('collapses to 0 ms when reducedMotion is true', () => {
    expect(motionFor('snap-pill', { reducedMotion: true }).durationMs).toBe(0);
  });
  it('strips scale/translate under reduced-motion', () => {
    const reduced = motionFor('mode-switch', { reducedMotion: true });
    expect(reduced.translateXPx).toBeUndefined();
  });
});

describe('transitionCSS', () => {
  it('returns "none" for selection-halo', () => {
    expect(transitionCSS('selection-halo')).toBe('none');
  });
  it('returns the spec channels otherwise', () => {
    const css = transitionCSS('snap-pill');
    expect(css).toContain('opacity');
    expect(css).toContain('transform');
    expect(css).toContain('var(--motion-fast)');
    expect(css).toContain('var(--ease-out)');
  });
  it('returns "none" under reduced-motion', () => {
    expect(transitionCSS('snap-pill', { reducedMotion: true })).toBe('none');
  });
});
