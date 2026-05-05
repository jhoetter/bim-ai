import { describe, expect, it } from 'vitest';
import {
  A11Y_INVARIANTS,
  ariaLiveForSurface,
  KEYBOARD_ONLY_PATH,
  meetsHitTarget,
  resolveIconButtonLabel,
} from './a11y';

describe('A11Y_INVARIANTS — spec §22', () => {
  it('exposes the WCAG AA contrast targets', () => {
    expect(A11Y_INVARIANTS.bodyContrastRatio).toBe(4.5);
    expect(A11Y_INVARIANTS.largeContrastRatio).toBe(3);
  });
  it('chrome hit-target ≥ 24 px; tool palette ≥ 36 px', () => {
    expect(A11Y_INVARIANTS.minHitTargetPx).toBe(24);
    expect(A11Y_INVARIANTS.toolPaletteHitPx).toBe(36);
  });
});

describe('resolveIconButtonLabel', () => {
  it('uses ariaLabel when provided', () => {
    expect(resolveIconButtonLabel({ ariaLabel: 'Wall' })).toBe('Wall');
  });
  it('falls back to title when ariaLabel missing', () => {
    expect(resolveIconButtonLabel({ title: 'Door' })).toBe('Door');
  });
  it('throws when neither is provided', () => {
    expect(() => resolveIconButtonLabel({})).toThrow();
  });
});

describe('ariaLiveForSurface', () => {
  it('errors are assertive', () => {
    expect(ariaLiveForSurface('status-ws-error')).toBe('assertive');
    expect(ariaLiveForSurface('status-save-error')).toBe('assertive');
  });
  it('non-errors are polite', () => {
    expect(ariaLiveForSurface('status-coords')).toBe('polite');
    expect(ariaLiveForSurface('status-tool')).toBe('polite');
  });
});

describe('meetsHitTarget', () => {
  it('accepts 24×24 chrome hits', () => {
    expect(meetsHitTarget(24, 24)).toBe(true);
    expect(meetsHitTarget(23, 24)).toBe(false);
  });
  it('requires 36×36 on tool palette', () => {
    expect(meetsHitTarget(36, 36, 'tool-palette')).toBe(true);
    expect(meetsHitTarget(35, 36, 'tool-palette')).toBe(false);
  });
});

describe('KEYBOARD_ONLY_PATH', () => {
  it('covers the §22 documented golden path', () => {
    expect(KEYBOARD_ONLY_PATH.length).toBeGreaterThanOrEqual(4);
    for (const step of KEYBOARD_ONLY_PATH) {
      expect(step.action).toBeTruthy();
      expect(step.keys).toBeTruthy();
    }
  });
});
