import { describe, expect, it } from 'vitest';
import { VISUAL_BASELINES, baselineById } from './visualRegressionBaselines';

describe('visual regression baseline manifest — §28', () => {
  it('covers every documented chrome surface', () => {
    const sections = VISUAL_BASELINES.map((b) => b.specSection);
    for (const required of ['§8', '§11', '§12', '§13', '§14', '§15', '§16', '§17']) {
      expect(sections).toContain(required);
    }
  });

  it('every entry declares a non-zero viewport', () => {
    for (const b of VISUAL_BASELINES) {
      expect(b.viewport.widthPx).toBeGreaterThan(0);
      expect(b.viewport.heightPx).toBeGreaterThan(0);
    }
  });

  it('app-shell baselines exist for both light and dark', () => {
    const ids = VISUAL_BASELINES.map((b) => b.id);
    expect(ids).toContain('app-shell-light');
    expect(ids).toContain('app-shell-dark');
  });

  it('baselineById returns null for unknown ids', () => {
    expect(baselineById('does-not-exist')).toBeNull();
  });
});
