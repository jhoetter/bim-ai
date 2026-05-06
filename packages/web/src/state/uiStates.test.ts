import { describe, expect, it } from 'vitest';
import { UI_STATE_PATTERNS, patternFor, type UiStateKind } from './uiStates';

const ALL: UiStateKind[] = [
  'canvas-empty',
  'canvas-loading',
  'network-offline',
  'engine-error',
  'conflict-409',
  'permission-denied',
];

describe('UI state patterns — spec §25', () => {
  it('covers every documented surface', () => {
    for (const k of ALL) expect(UI_STATE_PATTERNS[k]).toBeDefined();
  });

  it('canvas-empty primary CTA matches spec wording', () => {
    expect(UI_STATE_PATTERNS['canvas-empty'].cta?.action).toBe('project.insert-seed');
    expect(UI_STATE_PATTERNS['canvas-empty'].headline).toBe('This level is empty.');
  });

  it('error states use aria-live="assertive"', () => {
    expect(UI_STATE_PATTERNS['engine-error'].ariaLive).toBe('assertive');
    expect(UI_STATE_PATTERNS['network-offline'].ariaLive).toBe('assertive');
    expect(UI_STATE_PATTERNS['conflict-409'].ariaLive).toBe('assertive');
  });

  it('loading is polite', () => {
    expect(UI_STATE_PATTERNS['canvas-loading'].ariaLive).toBe('polite');
  });

  it('every pattern has a non-empty headline + hint', () => {
    for (const k of ALL) {
      const p = patternFor(k);
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.hint.length).toBeGreaterThan(0);
    }
  });

  it('patternFor is the same reference as the constant entry', () => {
    expect(patternFor('engine-error')).toBe(UI_STATE_PATTERNS['engine-error']);
  });
});
