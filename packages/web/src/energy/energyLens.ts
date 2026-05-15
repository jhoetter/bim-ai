import type { Element, MaterialElem, WallTypeLayer } from '@bim-ai/core';

export type EnergyMaterialThermalSpec = {
  materialKey: string;
  displayName: string;
  lambdaWPerMK: number | null;
  rhoKgPerM3?: number | null;
  specificHeatJPerKgK?: number | null;
  mu?: number | null;
  sourceReference: string;
};

export type EnergyUValueReadout = {
  uValueWPerM2K: number | null;
  rTotalM2KPerW: number | null;
  missingMaterialKeys: string[];
  sourceReferences: string[];
  calculationScope: 'modeling_readout_not_geg_or_din_v_18599';
};

export const ENERGY_LENS_ID = 'energy';
export const ENERGY_LENS_GERMAN_NAME = 'Energieberatung';

const R_SI_M2K_PER_W = 0.13;
const R_SE_M2K_PER_W = 0.04;

export const STANDARD_THERMAL_MATERIALS: Readonly<Record<string, EnergyMaterialThermalSpec>> = {
  mineral_wool_wlg_035: {
    materialKey: 'mineral_wool_wlg_035',
    displayName: 'Mineral wool WLG 035',
    lambdaWPerMK: 0.035,
    rhoKgPerM3: 35,
    specificHeatJPerKgK: 1030,
    mu: 1,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  eps_wlg_032: {
    materialKey: 'eps_wlg_032',
    displayName: 'EPS WLG 032',
    lambdaWPerMK: 0.032,
    rhoKgPerM3: 20,
    specificHeatJPerKgK: 1450,
    mu: 40,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  sand_lime_brick: {
    materialKey: 'sand_lime_brick',
    displayName: 'Sand-lime brick',
    lambdaWPerMK: 0.99,
    rhoKgPerM3: 1800,
    specificHeatJPerKgK: 1000,
    mu: 15,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  reinforced_concrete: {
    materialKey: 'reinforced_concrete',
    displayName: 'Reinforced concrete',
    lambdaWPerMK: 2.3,
    rhoKgPerM3: 2400,
    specificHeatJPerKgK: 1000,
    mu: 80,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  plasterboard: {
    materialKey: 'plasterboard',
    displayName: 'Plasterboard',
    lambdaWPerMK: 0.25,
    rhoKgPerM3: 850,
    specificHeatJPerKgK: 1090,
    mu: 10,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  timber_frame_insulation: {
    materialKey: 'timber_frame_insulation',
    displayName: 'Timber frame + insulation',
    lambdaWPerMK: 0.04,
    rhoKgPerM3: 80,
    specificHeatJPerKgK: 1200,
    mu: 2,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  masonry_brick: {
    materialKey: 'masonry_brick',
    displayName: 'Masonry brick',
    lambdaWPerMK: 0.52,
    rhoKgPerM3: 1200,
    specificHeatJPerKgK: 1000,
    mu: 10,
    sourceReference: 'DIN 4108-4 / DIN EN ISO 10456 typical value',
  },
  air: {
    materialKey: 'air',
    displayName: 'Air layer',
    lambdaWPerMK: null,
    sourceReference: 'Ventilated/unventilated air layer requires specialist handling',
  },
};

function materialElementThermal(
  materialKey: string,
  material: MaterialElem,
): EnergyMaterialThermalSpec {
  const thermal = material.thermal ?? {};
  const physical = material.physical ?? {};
  return {
    materialKey,
    displayName: material.name || materialKey,
    lambdaWPerMK: thermal.lambdaWPerMK ?? thermal.conductivityWPerMK ?? null,
    rhoKgPerM3: thermal.rhoKgPerM3 ?? physical.densityKgPerM3 ?? null,
    specificHeatJPerKgK: thermal.specificHeatJPerKgK ?? null,
    mu: thermal.mu ?? null,
    sourceReference: thermal.sourceReference ?? 'project material',
  };
}

export function resolveEnergyMaterialThermal(
  materialKey: string | null | undefined,
  elementsById?: Record<string, Element>,
): EnergyMaterialThermalSpec | null {
  const key = (materialKey ?? '').trim();
  if (!key) return null;
  const element = elementsById?.[key];
  if (element?.kind === 'material') return materialElementThermal(key, element);
  return STANDARD_THERMAL_MATERIALS[key] ?? null;
}

export function computeUValueReadout(
  layers: readonly WallTypeLayer[],
  elementsById?: Record<string, Element>,
): EnergyUValueReadout {
  let rLayers = 0;
  const missingMaterialKeys: string[] = [];
  const sourceReferences = new Set<string>();

  for (const [idx, layer] of layers.entries()) {
    const materialKey = (layer.materialKey ?? '').trim();
    const thermal = resolveEnergyMaterialThermal(materialKey, elementsById);
    if (thermal?.sourceReference) sourceReferences.add(thermal.sourceReference);
    if (!thermal?.lambdaWPerMK || thermal.lambdaWPerMK <= 0) {
      missingMaterialKeys.push(materialKey || `layer-${idx}`);
      continue;
    }
    rLayers += layer.thicknessMm / 1000 / thermal.lambdaWPerMK;
  }

  if (missingMaterialKeys.length > 0 || rLayers <= 0) {
    return {
      uValueWPerM2K: null,
      rTotalM2KPerW: null,
      missingMaterialKeys,
      sourceReferences: [...sourceReferences].sort(),
      calculationScope: 'modeling_readout_not_geg_or_din_v_18599',
    };
  }

  const rTotal = R_SI_M2K_PER_W + rLayers + R_SE_M2K_PER_W;
  return {
    uValueWPerM2K: Math.round((1 / rTotal) * 10000) / 10000,
    rTotalM2KPerW: Math.round(rTotal * 1000000) / 1000000,
    missingMaterialKeys,
    sourceReferences: [...sourceReferences].sort(),
    calculationScope: 'modeling_readout_not_geg_or_din_v_18599',
  };
}
