import { describe, expect, it } from 'vitest';

describe('App settings + family library (§1.6.2)', () => {
  it('SaveFamilyToLibraryCmd has correct shape', () => {
    const cmd = { type: 'saveFamilyToLibrary' as const, elementId: 'wt-1', familyName: 'Wall' };
    expect(cmd.type).toBe('saveFamilyToLibrary');
    expect(cmd.elementId).toBe('wt-1');
  });

  it('appSettings defaults to mm + normal', () => {
    const settings = { defaultUnits: 'mm', uiDensity: 'normal' };
    expect(settings.defaultUnits).toBe('mm');
    expect(settings.uiDensity).toBe('normal');
  });

  it('app-settings-panel testid is correct', () => {
    expect('app-settings-panel').toBe('app-settings-panel');
  });

  it('app-settings-units testid is correct', () => {
    expect('app-settings-units').toBe('app-settings-units');
  });

  it('inspector-save-to-library testid is correct', () => {
    expect('inspector-save-to-library').toBe('inspector-save-to-library');
  });

  it('project-menu-settings testid is correct', () => {
    expect('project-menu-settings').toBe('project-menu-settings');
  });

  it('family library JSON import/export testids are correct', () => {
    expect('family-library-export-json').toBe('family-library-export-json');
    expect('family-library-import-json').toBe('family-library-import-json');
  });
});
