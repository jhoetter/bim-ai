export const ENERGY_REQUIRED_VIEW_MODES = [
  'color_by_u_value',
  'color_by_thermal_classification',
  'highlight_thermal_envelope',
  'show_unclassified_envelope_elements',
  'show_missing_material_thermal_values',
  'shading_review',
  'scenario_comparison',
] as const;

export const ENERGY_REQUIRED_SHEET_TEMPLATES = [
  {
    id: 'energy-as-is-survey',
    name: 'Bestandsaufnahme / as-is energy survey',
    recommendedViewModes: [
      'color_by_thermal_classification',
      'show_unclassified_envelope_elements',
    ],
  },
  {
    id: 'energy-envelope-overview',
    name: 'Thermal envelope overview',
    recommendedViewModes: ['highlight_thermal_envelope', 'color_by_thermal_classification'],
  },
  {
    id: 'energy-u-value-summary',
    name: 'U-value summary',
    recommendedViewModes: ['color_by_u_value', 'show_missing_material_thermal_values'],
  },
  {
    id: 'energy-renovation-comparison',
    name: 'Renovation scenario comparison',
    recommendedViewModes: ['scenario_comparison', 'color_by_u_value'],
  },
  {
    id: 'energy-export-qa-handoff',
    name: 'Export QA handoff sheet',
    recommendedViewModes: ['show_missing_material_thermal_values', 'shading_review'],
  },
] as const;

export const ENERGY_REQUIRED_SCHEDULE_CATEGORIES = [
  'energy_envelope',
  'energy_thermal_materials',
  'energy_u_value_summary',
  'energy_windows_solar_gains',
  'energy_thermal_bridges',
  'energy_thermal_zones',
  'energy_building_services',
  'energy_renovation_measures',
  'energy_export_qa',
] as const;

export type EnergyViewMode = (typeof ENERGY_REQUIRED_VIEW_MODES)[number];
export type EnergyScheduleCategory = (typeof ENERGY_REQUIRED_SCHEDULE_CATEGORIES)[number];
