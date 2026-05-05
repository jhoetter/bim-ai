import { describe, expect, it } from 'vitest';
import {
  moveViewport,
  resizeViewport,
  SECTION_ELEVATION_DEFAULTS,
  SHEET_DEFAULTS,
  type SheetViewport,
  withActiveSection,
  withFarClip,
  withViewTemplate,
} from './modeSurfaces';

describe('Section / Elevation surface — spec §20.4', () => {
  it('starts with no active section and 9 m far clip', () => {
    expect(SECTION_ELEVATION_DEFAULTS.activeSectionId).toBeNull();
    expect(SECTION_ELEVATION_DEFAULTS.farClipMm).toBe(9000);
  });

  it('withActiveSection sets the section id', () => {
    const next = withActiveSection(SECTION_ELEVATION_DEFAULTS, 'seed-sec-aa');
    expect(next.activeSectionId).toBe('seed-sec-aa');
  });

  it('withFarClip clamps negatives to 0', () => {
    expect(withFarClip(SECTION_ELEVATION_DEFAULTS, -1).farClipMm).toBe(0);
    expect(withFarClip(SECTION_ELEVATION_DEFAULTS, 4500).farClipMm).toBe(4500);
  });

  it('withViewTemplate accepts id or null', () => {
    expect(withViewTemplate(SECTION_ELEVATION_DEFAULTS, 'seed-vt-arch-1to100').viewTemplateId).toBe(
      'seed-vt-arch-1to100',
    );
    expect(
      withViewTemplate({ ...SECTION_ELEVATION_DEFAULTS, viewTemplateId: 'x' }, null).viewTemplateId,
    ).toBeNull();
  });
});

describe('Sheet surface — spec §20.5', () => {
  const baseVp: SheetViewport = {
    id: 'vp-1',
    label: 'Ground plan',
    viewRef: 'plan:seed-plan-eg',
    xMm: 1500,
    yMm: 1500,
    widthMm: 38000,
    heightMm: 25000,
  };

  it('SHEET_DEFAULTS exposes a 50 mm snap tolerance', () => {
    expect(SHEET_DEFAULTS.snapToleranceMm).toBe(50);
    expect(SHEET_DEFAULTS.activeSheetId).toBeNull();
  });

  it('moveViewport translates by deltas and snaps to a 50 mm gauge', () => {
    const moved = moveViewport(baseVp, 25, 60);
    // 1500 + 25 = 1525 → within 50 of 1500 → snap to 1500
    expect(moved.xMm).toBe(1500);
    // 1500 + 60 = 1560 → within 40 of 1550 → snap toward upper gauge (1550)
    expect(moved.yMm).toBe(1550);
  });

  it('resizeViewport clamps to a 200 mm minimum', () => {
    const small = resizeViewport(baseVp, -90000, -90000);
    expect(small.widthMm).toBe(200);
    expect(small.heightMm).toBe(200);
  });

  it('resizeViewport adds positive deltas', () => {
    const big = resizeViewport(baseVp, 1000, 500);
    expect(big.widthMm).toBe(39000);
    expect(big.heightMm).toBe(25500);
  });
});
