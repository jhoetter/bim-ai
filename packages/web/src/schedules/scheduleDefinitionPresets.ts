/** Documented schedule definition presets (server column keys mirror `bim_ai.schedule_field_registry`). */

import type { ScheduleFieldMeta } from './schedulePanelRegistryChrome';
import type { EnergyScheduleCategory } from '../energy/energyLensWorkflows';

export type SchedulePresetCategory =
  | 'room'
  | 'door'
  | 'window'
  | 'material_assembly'
  | EnergyScheduleCategory;

export type SchedulePresetFieldToken = 'required' | 'optional';

export type ScheduleAggregation = 'sum' | 'average' | 'min' | 'max' | 'count';

export type ScheduleDefinitionPresetField = {
  fieldKey: string;
  token: SchedulePresetFieldToken;
  /** Human unit cue when label does not spell it out (e.g. "m²"). */
  unitHint?: string;
  /** Short note for CSV / API export consumers. */
  csvExportHint?: string;
  /** Footer aggregation for Calculate Totals (null = no footer). */
  aggregation?: ScheduleAggregation | null;
};

export type ScheduleDefinitionPreset = {
  id: string;
  name: string;
  category: SchedulePresetCategory;
  fields: ScheduleDefinitionPresetField[];
};

const PRESETS: ScheduleDefinitionPreset[] = [
  {
    id: 'room-core-area',
    name: 'Room · core area',
    category: 'room',
    fields: [
      { fieldKey: 'elementId', token: 'required', csvExportHint: 'Stable row id' },
      { fieldKey: 'name', token: 'required', csvExportHint: 'Room name' },
      { fieldKey: 'level', token: 'required', csvExportHint: 'Level label' },
      {
        fieldKey: 'areaM2',
        token: 'required',
        unitHint: 'm²',
        csvExportHint: 'Derived area',
        aggregation: 'sum',
      },
      { fieldKey: 'perimeterM', token: 'optional', unitHint: 'm', aggregation: 'sum' },
      { fieldKey: 'targetAreaM2', token: 'optional', unitHint: 'm²', aggregation: 'sum' },
      { fieldKey: 'areaDeltaM2', token: 'optional', unitHint: 'm²', aggregation: 'sum' },
    ],
  },
  {
    id: 'room-programme',
    name: 'Room · programme',
    category: 'room',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'level', token: 'required' },
      { fieldKey: 'programmeCode', token: 'required', csvExportHint: 'Programme code' },
      { fieldKey: 'department', token: 'optional' },
      { fieldKey: 'functionLabel', token: 'optional' },
      { fieldKey: 'finishSet', token: 'optional' },
      { fieldKey: 'areaM2', token: 'optional', unitHint: 'm²' },
      { fieldKey: 'targetAreaM2', token: 'optional', unitHint: 'm²' },
      { fieldKey: 'areaDeltaM2', token: 'optional', unitHint: 'm²' },
    ],
  },
  {
    id: 'door-opening-qto',
    name: 'Door · opening QTO',
    category: 'door',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'level', token: 'required' },
      { fieldKey: 'widthMm', token: 'required', unitHint: 'mm' },
      {
        fieldKey: 'roughOpeningAreaM2',
        token: 'required',
        unitHint: 'm²',
        csvExportHint: 'Rough opening area',
      },
      { fieldKey: 'roughOpeningWidthMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'roughOpeningHeightMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'hostHeightMm', token: 'optional', unitHint: 'mm' },
    ],
  },
  {
    id: 'door-host-identity',
    name: 'Door · host & type',
    category: 'door',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'level', token: 'required' },
      { fieldKey: 'hostWallTypeDisplay', token: 'required', csvExportHint: 'Host wall type label' },
      { fieldKey: 'hostWallTypeId', token: 'optional' },
      { fieldKey: 'wallId', token: 'optional' },
      { fieldKey: 'familyTypeId', token: 'optional' },
      { fieldKey: 'familyTypeDisplay', token: 'optional' },
      { fieldKey: 'materialDisplay', token: 'optional' },
    ],
  },
  {
    id: 'window-opening-qto',
    name: 'Window · opening QTO',
    category: 'window',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'level', token: 'required' },
      { fieldKey: 'widthMm', token: 'required', unitHint: 'mm' },
      { fieldKey: 'heightMm', token: 'required', unitHint: 'mm' },
      { fieldKey: 'roughOpeningAreaM2', token: 'required', unitHint: 'm²' },
      {
        fieldKey: 'openingAreaM2',
        token: 'optional',
        unitHint: 'm²',
        csvExportHint: 'Glazing area',
      },
      { fieldKey: 'sillMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'aspectRatio', token: 'optional' },
      { fieldKey: 'headHeightMm', token: 'optional', unitHint: 'mm' },
    ],
  },
  {
    id: 'window-glazing-host',
    name: 'Window · glazing & host',
    category: 'window',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'level', token: 'required' },
      { fieldKey: 'hostWallTypeDisplay', token: 'required' },
      { fieldKey: 'materialDisplay', token: 'optional' },
      { fieldKey: 'familyTypeDisplay', token: 'optional' },
      { fieldKey: 'roughOpeningWidthMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'roughOpeningHeightMm', token: 'optional', unitHint: 'mm' },
    ],
  },
  {
    id: 'assembly-layer-takeoff',
    name: 'Assembly · layer takeoff',
    category: 'material_assembly',
    fields: [
      { fieldKey: 'hostElementId', token: 'required', csvExportHint: 'Wall/floor/roof instance' },
      { fieldKey: 'hostKind', token: 'required', csvExportHint: 'Host category' },
      { fieldKey: 'layerIndex', token: 'required', csvExportHint: '0-based layer stack index' },
      { fieldKey: 'materialDisplay', token: 'required' },
      { fieldKey: 'thicknessMm', token: 'required', unitHint: 'mm' },
      {
        fieldKey: 'grossAreaM2',
        token: 'optional',
        unitHint: 'm²',
        csvExportHint: 'Layer gross face area',
      },
      { fieldKey: 'grossVolumeM3', token: 'optional', unitHint: 'm³' },
      { fieldKey: 'layerOffsetFromExteriorMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'assemblyTotalThicknessMm', token: 'optional', unitHint: 'mm' },
      { fieldKey: 'level', token: 'optional' },
    ],
  },
  {
    id: 'energy-envelope-surfaces',
    name: 'Energy · envelope surfaces',
    category: 'energy_envelope',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'hostKind', token: 'required' },
      { fieldKey: 'thermalClassification', token: 'required' },
      { fieldKey: 'surfaceAreaM2', token: 'required', unitHint: 'm²', aggregation: 'sum' },
      { fieldKey: 'uValueWPerM2K', token: 'optional', unitHint: 'W/(m²K)' },
      { fieldKey: 'missingMaterialKeys', token: 'optional' },
      { fieldKey: 'sourceReferences', token: 'optional' },
    ],
  },
  {
    id: 'energy-thermal-materials',
    name: 'Energy · thermal materials',
    category: 'energy_thermal_materials',
    fields: [
      { fieldKey: 'materialKey', token: 'required' },
      { fieldKey: 'materialDisplay', token: 'required' },
      { fieldKey: 'lambdaWPerMK', token: 'required', unitHint: 'W/(mK)' },
      { fieldKey: 'rhoKgPerM3', token: 'optional', unitHint: 'kg/m³' },
      { fieldKey: 'specificHeatJPerKgK', token: 'optional', unitHint: 'J/(kgK)' },
      { fieldKey: 'mu', token: 'optional' },
      { fieldKey: 'sourceReference', token: 'required' },
      { fieldKey: 'thermalDataStatus', token: 'required' },
    ],
  },
  {
    id: 'energy-u-value-summary',
    name: 'Energy · U-value summary',
    category: 'energy_u_value_summary',
    fields: [
      { fieldKey: 'typeId', token: 'required' },
      { fieldKey: 'typeName', token: 'required' },
      { fieldKey: 'hostKind', token: 'required' },
      { fieldKey: 'uValueWPerM2K', token: 'required', unitHint: 'W/(m²K)' },
      { fieldKey: 'rTotalM2KPerW', token: 'optional', unitHint: 'm²K/W' },
      { fieldKey: 'missingMaterialKeys', token: 'optional' },
      { fieldKey: 'calculationScope', token: 'required' },
    ],
  },
  {
    id: 'energy-windows-solar-gains',
    name: 'Energy · windows and solar gains',
    category: 'energy_windows_solar_gains',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'openingAreaM2', token: 'required', unitHint: 'm²', aggregation: 'sum' },
      { fieldKey: 'uValueWPerM2K', token: 'required', unitHint: 'W/(m²K)' },
      { fieldKey: 'gValue', token: 'required' },
      { fieldKey: 'frameFraction', token: 'optional' },
      { fieldKey: 'annualShadingFactorEstimate', token: 'optional' },
      { fieldKey: 'shadingDevice', token: 'optional' },
    ],
  },
  {
    id: 'energy-thermal-bridges',
    name: 'Energy · thermal bridges',
    category: 'energy_thermal_bridges',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'markerType', token: 'required' },
      { fieldKey: 'hostElementIds', token: 'optional' },
      { fieldKey: 'suggestedMitigation', token: 'optional' },
      { fieldKey: 'psiValueReference', token: 'optional' },
    ],
  },
  {
    id: 'energy-thermal-zones',
    name: 'Energy · thermal zones',
    category: 'energy_thermal_zones',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'name', token: 'required' },
      { fieldKey: 'heatingStatus', token: 'required' },
      { fieldKey: 'usageProfile', token: 'optional' },
      { fieldKey: 'setpointC', token: 'optional', unitHint: '°C' },
      { fieldKey: 'airChangeRate', token: 'optional' },
      { fieldKey: 'zoneId', token: 'required' },
      { fieldKey: 'conditionedVolumeIncluded', token: 'optional' },
    ],
  },
  {
    id: 'energy-building-services',
    name: 'Energy · building services handoff',
    category: 'energy_building_services',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'heatingGeneratorType', token: 'required' },
      { fieldKey: 'energyCarrier', token: 'required' },
      { fieldKey: 'distributionType', token: 'optional' },
      { fieldKey: 'domesticHotWaterSystem', token: 'optional' },
      { fieldKey: 'ventilationSystem', token: 'optional' },
      { fieldKey: 'measureCandidateNotes', token: 'optional' },
    ],
  },
  {
    id: 'energy-renovation-measures',
    name: 'Energy · renovation measures',
    category: 'energy_renovation_measures',
    fields: [
      { fieldKey: 'scenarioId', token: 'required' },
      { fieldKey: 'scenarioName', token: 'required' },
      { fieldKey: 'scenarioStatus', token: 'required' },
      { fieldKey: 'measureName', token: 'optional' },
      { fieldKey: 'measureNotes', token: 'optional' },
      { fieldKey: 'costPlaceholder', token: 'optional', aggregation: 'sum' },
    ],
  },
  {
    id: 'energy-export-qa',
    name: 'Energy · export QA checklist',
    category: 'energy_export_qa',
    fields: [
      { fieldKey: 'elementId', token: 'required' },
      { fieldKey: 'issueCode', token: 'required' },
      { fieldKey: 'severity', token: 'required' },
      { fieldKey: 'message', token: 'required' },
      { fieldKey: 'missingMaterialKeys', token: 'optional' },
    ],
  },
];

export function getSchedulePresets(category: SchedulePresetCategory): ScheduleDefinitionPreset[] {
  return PRESETS.filter((p) => p.category === category);
}

export function presetsForCategory(category: SchedulePresetCategory): ScheduleDefinitionPreset[] {
  return PRESETS.filter((p) => p.category === category)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function presetById(id: string): ScheduleDefinitionPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Keep preset field order; only keys present in `serverColumns` are returned.
 * `serverColumns` is typically the server `columns` array (registry order + extras).
 */
export function resolvePresetColumnsForExport(
  fieldKeysInPresetOrder: readonly string[],
  serverColumns: readonly string[],
): string[] {
  const allowed = new Set(serverColumns);
  return fieldKeysInPresetOrder.filter((k) => allowed.has(k));
}

export function missingRequiredFieldKeys(
  preset: ScheduleDefinitionPreset,
  serverColumns: readonly string[],
): string[] {
  const allowed = new Set(serverColumns);
  return preset.fields
    .filter((f) => f.token === 'required' && !allowed.has(f.fieldKey))
    .map((f) => f.fieldKey);
}

export type PresetFieldReadoutRow = {
  fieldKey: string;
  label: string;
  roleReadout: string;
  unitHint?: string;
  token: SchedulePresetFieldToken;
  csvExportHint?: string;
};

function roleFromMeta(meta: ScheduleFieldMeta | undefined): string {
  const r = meta?.role;
  return typeof r === 'string' && r.trim() ? r.trim() : '';
}

/** Merge preset entries with server field metadata for deterministic panel readout. */
export function presetFieldReadoutRows(
  preset: ScheduleDefinitionPreset,
  fieldMeta: Record<string, ScheduleFieldMeta> | undefined,
): PresetFieldReadoutRow[] {
  const fm = fieldMeta ?? {};
  return preset.fields.map((f) => {
    const meta = fm[f.fieldKey];
    const label = typeof meta?.label === 'string' && meta.label.trim() ? meta.label : f.fieldKey;
    return {
      fieldKey: f.fieldKey,
      label,
      roleReadout: roleFromMeta(meta),
      unitHint: f.unitHint,
      token: f.token,
      csvExportHint: f.csvExportHint,
    };
  });
}
