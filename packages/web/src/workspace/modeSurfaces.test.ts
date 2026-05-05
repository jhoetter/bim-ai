import { describe, expect, it } from 'vitest';
import {
  SECTION_ELEVATION_DEFAULTS,
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
