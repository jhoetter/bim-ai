import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  materialTargetLayerIndex,
  topLayerIndex,
  wallTypeExteriorLayerIndex,
  wallTypeInteriorLayerIndex,
} from './hostMaterialLayerTargets';

describe('host material layer targets', () => {
  it('targets the first finish layer as wall exterior instead of blindly layer zero', () => {
    const type: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt',
      name: 'Wall',
      layers: [
        { function: 'insulation', thicknessMm: 25, materialKey: 'air' },
        { function: 'finish', thicknessMm: 18, materialKey: 'cladding_beige_grey' },
        { function: 'structure', thicknessMm: 140, materialKey: 'timber_frame_insulation' },
        { function: 'finish', thicknessMm: 13, materialKey: 'plaster' },
      ],
    };

    expect(wallTypeExteriorLayerIndex(type)).toBe(1);
    expect(wallTypeInteriorLayerIndex(type)).toBe(3);
    expect(materialTargetLayerIndex(type)).toBe(1);
  });

  it('falls back to visible layer order when no finish layer is authored', () => {
    const type: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt',
      name: 'Wall',
      layers: [
        { function: 'insulation', thicknessMm: 25, materialKey: 'air' },
        { function: 'structure', thicknessMm: 140, materialKey: 'masonry_block' },
      ],
    };

    expect(wallTypeExteriorLayerIndex(type)).toBe(1);
  });

  it('targets the top finish layer for floor and roof types', () => {
    const floorType: Extract<Element, { kind: 'floor_type' }> = {
      kind: 'floor_type',
      id: 'ft',
      name: 'Floor',
      layers: [
        { function: 'structure', thicknessMm: 180, materialKey: 'concrete_smooth' },
        { function: 'finish', thicknessMm: 20, materialKey: 'oak_light' },
      ],
    };
    const roofType: Extract<Element, { kind: 'roof_type' }> = {
      kind: 'roof_type',
      id: 'rt',
      name: 'Roof',
      layers: [
        { function: 'structure', thicknessMm: 160, materialKey: 'timber_frame_insulation' },
        { function: 'finish', thicknessMm: 45, materialKey: 'metal_standing_seam_dark_grey' },
      ],
    };

    expect(topLayerIndex(floorType)).toBe(1);
    expect(topLayerIndex(roofType)).toBe(1);
    expect(materialTargetLayerIndex(floorType)).toBe(1);
    expect(materialTargetLayerIndex(roofType)).toBe(1);
  });
});
