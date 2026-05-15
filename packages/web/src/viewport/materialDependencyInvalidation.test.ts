import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { materialDependencyDirtyIds } from './materialDependencyInvalidation';

describe('materialDependencyDirtyIds', () => {
  it('marks typed wall, floor, and roof instances dirty when their type changes', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Wall type',
      layers: [{ function: 'finish', thicknessMm: 20, materialKey: 'render_white' }],
    };
    const floorType: Extract<Element, { kind: 'floor_type' }> = {
      kind: 'floor_type',
      id: 'ft-1',
      name: 'Floor type',
      layers: [{ function: 'finish', thicknessMm: 20, materialKey: 'oak_light' }],
    };
    const roofType: Extract<Element, { kind: 'roof_type' }> = {
      kind: 'roof_type',
      id: 'rt-1',
      name: 'Roof type',
      layers: [{ function: 'finish', thicknessMm: 20, materialKey: 'metal_roof' }],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 250,
      heightMm: 3000,
      wallTypeId: wallType.id,
    };
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor',
      levelId: 'l1',
      boundaryMm: [],
      thicknessMm: 200,
      floorTypeId: floorType.id,
    };
    const roof: Extract<Element, { kind: 'roof' }> = {
      kind: 'roof',
      id: 'roof-1',
      name: 'Roof',
      referenceLevelId: 'l1',
      footprintMm: [],
      roofTypeId: roofType.id,
    };

    expect(
      materialDependencyDirtyIds(
        {
          [wallType.id]: wallType,
          [floorType.id]: floorType,
          [roofType.id]: roofType,
          [wall.id]: wall,
          [floor.id]: floor,
          [roof.id]: roof,
        },
        [wallType.id, floorType.id, roofType.id],
      ),
    ).toEqual(new Set(['wall-1', 'floor-1', 'roof-1']));
  });

  it('marks hosts dirty when a project material used by a type layer changes', () => {
    const material: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-cladding',
      name: 'Project cladding',
      category: 'cladding',
      appearance: { baseColor: '#777766' },
    };
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-project',
      name: 'Project wall type',
      layers: [{ function: 'finish', thicknessMm: 20, materialKey: material.id }],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-project',
      name: 'Wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 250,
      heightMm: 3000,
      wallTypeId: wallType.id,
    };

    expect(
      materialDependencyDirtyIds(
        { [material.id]: material, [wallType.id]: wallType, [wall.id]: wall },
        [material.id],
      ),
    ).toEqual(new Set(['wt-project', 'wall-project']));
  });

  it('marks material-slot elements dirty when the referenced material changes', () => {
    const material: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-hardware',
      name: 'Hardware',
      category: 'metal',
      appearance: { baseColor: '#222222' },
    };
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'door-1',
      name: 'Door',
      wallId: 'wall-1',
      alongT: 0.5,
      widthMm: 900,
      materialSlots: { hardware: material.id },
    };

    expect(
      materialDependencyDirtyIds({ [material.id]: material, [door.id]: door }, [material.id]),
    ).toEqual(new Set(['door-1']));
  });
});
