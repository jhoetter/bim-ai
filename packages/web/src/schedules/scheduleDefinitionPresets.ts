/** Documented schedule definition presets (server column keys mirror `bim_ai.schedule_field_registry`). */

import type { ScheduleFieldMeta } from './schedulePanelRegistryChrome';

export type SchedulePresetCategory = 'room' | 'door' | 'window' | 'finish' | 'material_assembly';

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
    id: 'finish-room-core',
    name: 'Finish · room core',
    category: 'finish',
    fields: [
      { fieldKey: 'elementId', token: 'required', csvExportHint: 'Stable room id' },
      { fieldKey: 'name', token: 'required', csvExportHint: 'Room name' },
      { fieldKey: 'level', token: 'required', csvExportHint: 'Level label' },
      { fieldKey: 'department', token: 'optional' },
      { fieldKey: 'programmeCode', token: 'optional' },
      { fieldKey: 'finishSet', token: 'required', csvExportHint: 'Architectural finish reference' },
      { fieldKey: 'finishState', token: 'required', csvExportHint: 'Finish metadata state' },
      { fieldKey: 'areaM2', token: 'optional', unitHint: 'm²', aggregation: 'sum' },
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
