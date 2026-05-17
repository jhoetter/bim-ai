import { describe, expect, it } from 'vitest';
import { getSchedulePresets, presetById, presetsForCategory } from './scheduleDefinitionPresets';

describe('steel connection schedule preset — §9.5.2', () => {
  it('getSchedulePresets includes steel_connections preset', () => {
    const presets = getSchedulePresets('steel_connection');
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.some((p) => p.id === 'steel_connections')).toBe(true);
  });

  it('steel_connections preset has connectionType field', () => {
    const preset = presetById('steel_connections');
    expect(preset).toBeDefined();
    const field = preset!.fields.find((f) => f.fieldKey === 'connectionType');
    expect(field).toBeDefined();
    expect(field!.token).toBe('required');
  });

  it('steel_connections preset has count aggregation field', () => {
    const preset = presetById('steel_connections');
    expect(preset).toBeDefined();
    const field = preset!.fields.find((f) => f.fieldKey === 'count');
    expect(field).toBeDefined();
    expect(field!.aggregation).toBe('count');
  });

  it('steel_connections preset category is steel_connection', () => {
    const preset = presetById('steel_connections');
    expect(preset?.category).toBe('steel_connection');
  });

  it('presetsForCategory returns steel_connections preset', () => {
    const presets = presetsForCategory('steel_connection');
    expect(presets.some((p) => p.id === 'steel_connections')).toBe(true);
  });
});
