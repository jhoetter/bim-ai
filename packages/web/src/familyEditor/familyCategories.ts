export const FAMILY_CATEGORIES = [
  { key: 'doors', label: 'Doors' },
  { key: 'windows', label: 'Windows' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'structural_columns', label: 'Structural Columns' },
  { key: 'structural_framing', label: 'Structural Framing' },
  { key: 'casework', label: 'Casework' },
  { key: 'generic_models', label: 'Generic Models' },
  { key: 'lighting_fixtures', label: 'Lighting Fixtures' },
  { key: 'mechanical_equipment', label: 'Mechanical Equipment' },
  { key: 'plumbing_fixtures', label: 'Plumbing Fixtures' },
  { key: 'specialty_equipment', label: 'Specialty Equipment' },
] as const;

export type FamilyCategoryKey = (typeof FAMILY_CATEGORIES)[number]['key'];
