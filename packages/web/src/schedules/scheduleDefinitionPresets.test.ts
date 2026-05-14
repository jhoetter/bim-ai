import { describe, expect, it } from 'vitest';

import {
  getSchedulePresets,
  missingRequiredFieldKeys,
  presetFieldReadoutRows,
  presetsForCategory,
  resolvePresetColumnsForExport,
  type ScheduleDefinitionPreset,
} from './scheduleDefinitionPresets';

describe('scheduleDefinitionPresets', () => {
  it('presetsForCategory returns stable sorted ids per category', () => {
    const room = presetsForCategory('room').map((p) => p.id);
    expect(room).toEqual(['room-core-area', 'room-programme']);

    const door = presetsForCategory('door').map((p) => p.id);
    expect(door).toEqual(['door-host-identity', 'door-opening-qto']);

    const win = presetsForCategory('window').map((p) => p.id);
    expect(win).toEqual(['window-glazing-host', 'window-opening-qto']);

    const asm = presetsForCategory('material_assembly').map((p) => p.id);
    expect(asm).toEqual(['assembly-layer-takeoff']);

    expect(presetsForCategory('quantity_takeoff').map((p) => p.id)).toEqual([
      'cost-quantity-takeoff',
    ]);
    expect(presetsForCategory('cost_estimate').map((p) => p.id)).toEqual(['cost-estimate-source']);
    expect(presetsForCategory('element_cost_group').map((p) => p.id)).toEqual([
      'cost-element-groups',
    ]);
    expect(presetsForCategory('scenario_delta').map((p) => p.id)).toEqual(['cost-scenario-delta']);
  });

  it('resolvePresetColumnsForExport preserves preset order and ignores unknown keys', () => {
    const presetOrder = ['z_extra', 'name', 'level', 'areaM2', 'elementId'];
    const server = ['elementId', 'areaM2', 'name', 'level', 'perimeterM'];
    expect(resolvePresetColumnsForExport(presetOrder, server)).toEqual([
      'name',
      'level',
      'areaM2',
      'elementId',
    ]);
  });

  it('missingRequiredFieldKeys lists required keys absent from server columns (room)', () => {
    const preset = presetsForCategory('room').find((p) => p.id === 'room-core-area')!;
    expect(missingRequiredFieldKeys(preset, ['elementId', 'name', 'level'])).toEqual(['areaM2']);
    expect(missingRequiredFieldKeys(preset, ['elementId', 'name', 'level', 'areaM2'])).toEqual([]);
  });

  it('missingRequiredFieldKeys (door opening preset)', () => {
    const preset = presetsForCategory('door').find((p) => p.id === 'door-opening-qto')!;
    expect(
      missingRequiredFieldKeys(preset, [
        'elementId',
        'name',
        'level',
        'widthMm',
        'roughOpeningWidthMm',
      ]),
    ).toEqual(['roughOpeningAreaM2']);
  });

  it('missingRequiredFieldKeys (window opening preset)', () => {
    const preset = presetsForCategory('window').find((p) => p.id === 'window-opening-qto')!;
    expect(
      missingRequiredFieldKeys(preset, ['elementId', 'name', 'level', 'widthMm', 'heightMm']),
    ).toEqual(['roughOpeningAreaM2']);
  });

  it('missingRequiredFieldKeys (material assembly)', () => {
    const preset = presetsForCategory('material_assembly')[0]!;
    expect(
      missingRequiredFieldKeys(preset, [
        'hostElementId',
        'hostKind',
        'layerIndex',
        'materialDisplay',
      ]),
    ).toEqual(['thicknessMm']);
    expect(
      missingRequiredFieldKeys(preset, [
        'hostElementId',
        'hostKind',
        'layerIndex',
        'materialDisplay',
        'thicknessMm',
      ]),
    ).toEqual([]);
  });

  it('missingRequiredFieldKeys (cost estimate source)', () => {
    const preset = presetsForCategory('cost_estimate')[0]!;
    expect(
      missingRequiredFieldKeys(preset, [
        'rowId',
        'elementId',
        'scenarioId',
        'costGroup',
        'unit',
        'quantity',
        'costDataStatus',
      ]),
    ).toEqual(['costSource']);
  });

  it('presetFieldReadoutRows merges labels and roles from payload metadata', () => {
    const preset: ScheduleDefinitionPreset = {
      id: 'test',
      name: 'Test',
      category: 'room',
      fields: [{ fieldKey: 'areaM2', token: 'required', unitHint: 'm²' }],
    };
    const rows = presetFieldReadoutRows(preset, {
      areaM2: { label: 'Area (m²)', role: 'number' },
    });
    expect(rows[0]).toMatchObject({
      fieldKey: 'areaM2',
      label: 'Area (m²)',
      roleReadout: 'number',
      unitHint: 'm²',
      token: 'required',
    });
  });

  it('presetFieldReadoutRows falls back to field key when metadata missing', () => {
    const preset: ScheduleDefinitionPreset = {
      id: 'test',
      name: 'Test',
      category: 'door',
      fields: [{ fieldKey: 'wallId', token: 'optional' }],
    };
    const rows = presetFieldReadoutRows(preset, {});
    expect(rows[0]?.label).toBe('wallId');
    expect(rows[0]?.roleReadout).toBe('');
  });
});

describe('getSchedulePresets', () => {
  it('returns room presets with aggregation on areaM2', () => {
    const presets = getSchedulePresets('room');
    expect(presets.length).toBeGreaterThan(0);
    const coreArea = presets.find((p) => p.id === 'room-core-area');
    expect(coreArea).toBeDefined();
    const areaField = coreArea?.fields.find((f) => f.fieldKey === 'areaM2');
    expect(areaField?.aggregation).toBe('sum');
  });

  it('returns empty array for unknown category', () => {
    const presets = getSchedulePresets('door');
    expect(Array.isArray(presets)).toBe(true);
  });
});
