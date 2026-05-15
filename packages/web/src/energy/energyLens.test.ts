import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { computeUValueReadout, resolveEnergyMaterialThermal } from './energyLens';

describe('energyLens helpers', () => {
  it('computes a modeling U-value readout from thermal layer lambdas', () => {
    const readout = computeUValueReadout([
      { thicknessMm: 12.5, function: 'finish', materialKey: 'plasterboard' },
      { thicknessMm: 160, function: 'insulation', materialKey: 'mineral_wool_wlg_035' },
      { thicknessMm: 100, function: 'structure', materialKey: 'masonry_brick' },
    ]);

    expect(readout.calculationScope).toBe('modeling_readout_not_geg_or_din_v_18599');
    expect(readout.missingMaterialKeys).toEqual([]);
    expect(readout.uValueWPerM2K).toBeGreaterThan(0);
    expect(readout.uValueWPerM2K).toBeLessThan(0.25);
  });

  it('uses project material thermal fields before the standard fallback library', () => {
    const elementsById: Record<string, Element> = {
      project_insulation: {
        kind: 'material',
        id: 'project_insulation',
        name: 'Manufacturer insulation',
        thermal: {
          lambdaWPerMK: 0.029,
          rhoKgPerM3: 42,
          sourceReference: 'manufacturer datasheet',
        },
      },
    };

    expect(resolveEnergyMaterialThermal('project_insulation', elementsById)).toMatchObject({
      lambdaWPerMK: 0.029,
      rhoKgPerM3: 42,
      sourceReference: 'manufacturer datasheet',
    });
  });

  it('flags missing lambda values instead of inventing hidden assumptions', () => {
    const readout = computeUValueReadout([
      { thicknessMm: 50, function: 'insulation', materialKey: 'unknown_material' },
    ]);

    expect(readout.uValueWPerM2K).toBeNull();
    expect(readout.missingMaterialKeys).toEqual(['unknown_material']);
  });
});
