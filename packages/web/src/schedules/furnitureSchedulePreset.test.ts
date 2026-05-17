import { describe, expect, it } from 'vitest';
import { presetById, presetsForCategory } from './scheduleDefinitionPresets';

describe('furniture schedule preset — §13.3.1', () => {
  it('furniture preset exists in schedule definition presets', () => {
    const preset = presetById('furniture');
    expect(preset).toBeDefined();
    expect(preset?.id).toBe('furniture');
  });

  it('furniture preset category matches component element kind', () => {
    const preset = presetById('furniture');
    expect(preset?.category).toBe('family_instance');
  });

  it('furniture preset has name, type, level, count columns', () => {
    const preset = presetById('furniture');
    expect(preset).toBeDefined();
    const fieldKeys = preset!.fields.map((f) => f.fieldKey);
    expect(fieldKeys).toContain('name');
    expect(fieldKeys).toContain('typeName');
    expect(fieldKeys).toContain('levelId');
    expect(fieldKeys).toContain('count');
  });

  it('furniture preset is returned by presetsForCategory', () => {
    const presets = presetsForCategory('family_instance');
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.some((p) => p.id === 'furniture')).toBe(true);
  });
});
