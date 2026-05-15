import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  effectiveFloorTopMaterialKey,
  effectiveRoofTopMaterialKey,
  effectiveWallFaceMaterialKey,
} from './effectiveHostMaterials';

describe('effective host material helpers — RMP-02', () => {
  it('resolves typed wall exterior/interior layers before stale instance material', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Compound wall',
      layers: [
        { function: 'finish', materialKey: 'masonry_brick', thicknessMm: 110 },
        { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 140 },
        { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
      ],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'Wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 260,
      heightMm: 3000,
      wallTypeId: wallType.id,
      materialKey: 'timber_frame_insulation',
    };

    expect(effectiveWallFaceMaterialKey(wall, 'exterior', { [wallType.id]: wallType })).toBe(
      'masonry_brick',
    );
    expect(effectiveWallFaceMaterialKey(wall, 'interior', { [wallType.id]: wallType })).toBe(
      'plaster',
    );
  });

  it('resolves authored wall exterior to the exposed finish layer instead of an air gap', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-air-first',
      name: 'Compound wall',
      layers: [
        { function: 'insulation', materialKey: 'air', thicknessMm: 25 },
        { function: 'finish', materialKey: 'cladding_beige_grey', thicknessMm: 18 },
        { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 140 },
        { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
      ],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'Wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 260,
      heightMm: 3000,
      wallTypeId: wallType.id,
    };

    expect(effectiveWallFaceMaterialKey(wall, 'exterior', { [wallType.id]: wallType })).toBe(
      'cladding_beige_grey',
    );
    expect(effectiveWallFaceMaterialKey(wall, 'interior', { [wallType.id]: wallType })).toBe(
      'plaster',
    );
  });

  it('allows face paint to override a typed wall face', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'Wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 260,
      heightMm: 3000,
      wallTypeId: 'generic_200mm',
      faceMaterialOverrides: [{ faceKind: 'exterior', materialKey: 'brick_red', source: 'paint' }],
    };

    expect(effectiveWallFaceMaterialKey(wall, 'exterior')).toBe('brick_red');
  });

  it('resolves floor and roof top layers before roof instance fallback', () => {
    const floorType: Extract<Element, { kind: 'floor_type' }> = {
      kind: 'floor_type',
      id: 'ft-1',
      name: 'Floor type',
      layers: [{ function: 'finish', materialKey: 'concrete_smooth', thicknessMm: 80 }],
    };
    const roofType: Extract<Element, { kind: 'roof_type' }> = {
      kind: 'roof_type',
      id: 'rt-1',
      name: 'Roof type',
      layers: [
        { function: 'finish', materialKey: 'metal_standing_seam_dark_grey', thicknessMm: 45 },
      ],
    };
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'f1',
      name: 'Floor',
      levelId: 'l1',
      boundaryMm: [],
      thicknessMm: 240,
      floorTypeId: floorType.id,
    };
    const roof: Extract<Element, { kind: 'roof' }> = {
      kind: 'roof',
      id: 'r1',
      name: 'Roof',
      referenceLevelId: 'l2',
      footprintMm: [],
      roofTypeId: roofType.id,
      materialKey: 'white_render',
    };

    expect(effectiveFloorTopMaterialKey(floor, { [floorType.id]: floorType })).toBe(
      'concrete_smooth',
    );
    expect(effectiveRoofTopMaterialKey(roof, { [roofType.id]: roofType })).toBe(
      'metal_standing_seam_dark_grey',
    );
  });
});
