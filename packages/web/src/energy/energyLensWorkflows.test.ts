import { describe, expect, it } from 'vitest';

import {
  ENERGY_REQUIRED_SCHEDULE_CATEGORIES,
  ENERGY_REQUIRED_SHEET_TEMPLATES,
  ENERGY_REQUIRED_VIEW_MODES,
} from './energyLensWorkflows';

describe('energyLensWorkflows', () => {
  it('declares every required schedule category from the Energieberatung spec', () => {
    expect([...ENERGY_REQUIRED_SCHEDULE_CATEGORIES]).toEqual([
      'energy_envelope',
      'energy_thermal_materials',
      'energy_u_value_summary',
      'energy_windows_solar_gains',
      'energy_thermal_bridges',
      'energy_thermal_zones',
      'energy_building_services',
      'energy_renovation_measures',
      'energy_export_qa',
    ]);
  });

  it('declares required view modes and sheet templates for handoff documentation', () => {
    expect(ENERGY_REQUIRED_VIEW_MODES).toContain('color_by_u_value');
    expect(ENERGY_REQUIRED_VIEW_MODES).toContain('shading_review');
    expect(ENERGY_REQUIRED_SHEET_TEMPLATES.map((template) => template.id)).toEqual([
      'energy-as-is-survey',
      'energy-envelope-overview',
      'energy-u-value-summary',
      'energy-renovation-comparison',
      'energy-export-qa-handoff',
    ]);
  });
});
