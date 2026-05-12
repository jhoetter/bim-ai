import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const planCanvasSource = readFileSync(resolve(process.cwd(), 'src/plan/PlanCanvas.tsx'), 'utf8');
const viewportSource = readFileSync(resolve(process.cwd(), 'src/Viewport.tsx'), 'utf8');
const sheetReviewSurfaceSource = readFileSync(
  resolve(process.cwd(), 'src/plan/SheetReviewSurface.tsx'),
  'utf8',
);

describe('canvas overlay ownership — UX-WP-07', () => {
  it('does not mount persistent plan control docks inside PlanCanvas', () => {
    expect(planCanvasSource).not.toContain('<PlanDetailLevelToolbar');
    expect(planCanvasSource).not.toContain('<AnnotateRibbon');
    expect(planCanvasSource).not.toContain('<SnapSettingsToolbar');
    expect(planCanvasSource).not.toContain('data-testid="plan-crop-view-properties"');
    expect(planCanvasSource).not.toContain('data-testid="reveal-hidden-toggle"');
    expect(planCanvasSource).not.toContain('data-testid="temp-visibility-toggle"');
  });

  it('keeps spatial/transient plan overlays available on the canvas', () => {
    expect(planCanvasSource).toContain('<SnapGlyphLayer');
    expect(planCanvasSource).toContain('<TempDimLayer');
    expect(planCanvasSource).toContain('data-testid="reveal-hidden-chip"');
    expect(planCanvasSource).toContain('data-testid="snap-override-chip"');
  });

  it('keeps the 3D view cube but removes the saved-view HUD from the viewport canvas', () => {
    expect(viewportSource).toContain('<ViewCube');
    expect(viewportSource).not.toContain('<OrbitViewpointPersistedHud');
    expect(viewportSource).not.toContain('data-testid="orbit-viewpoint-persisted-hud"');
  });

  it('does not mount a persistent sheet review toolbar inside the canvas region', () => {
    expect(sheetReviewSurfaceSource).not.toContain('data-testid="sheet-review-toolbar"');
    expect(sheetReviewSurfaceSource).not.toContain('function ReviewToolbar');
  });
});
