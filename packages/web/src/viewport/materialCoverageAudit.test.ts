import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import { auditElementMaterialCoverage } from './materialCoverageAudit';

const wallType: Extract<Element, { kind: 'wall_type' }> = {
  kind: 'wall_type',
  id: 'wt-clad',
  name: 'Vertical clad external wall',
  layers: [
    { function: 'finish', materialKey: 'cladding_beige_grey', thicknessMm: 18 },
    { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 140 },
    { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
  ],
};

const floorType: Extract<Element, { kind: 'floor_type' }> = {
  kind: 'floor_type',
  id: 'ft-concrete',
  name: 'Concrete floor',
  layers: [
    { function: 'finish', materialKey: 'concrete_smooth', thicknessMm: 60 },
    { function: 'structure', materialKey: 'masonry_block', thicknessMm: 180 },
  ],
};

const roofType: Extract<Element, { kind: 'roof_type' }> = {
  kind: 'roof_type',
  id: 'rt-metal',
  name: 'Standing seam roof',
  layers: [
    { function: 'finish', materialKey: 'metal_standing_seam_dark_grey', thicknessMm: 45 },
    { function: 'structure', materialKey: 'timber_stud', thicknessMm: 160 },
  ],
};

function byId(entries: ReturnType<typeof auditElementMaterialCoverage>['entries']) {
  return Object.fromEntries(entries.map((entry) => [entry.elementId, entry]));
}

describe('material coverage audit — RMP-01', () => {
  it('reports typed wall exterior layer as authoritative over stale instance material', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'Stale internal instance material wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 250,
      heightMm: 3000,
      wallTypeId: wallType.id,
      materialKey: 'timber_frame_insulation',
    };

    const audit = auditElementMaterialCoverage({ [wallType.id]: wallType, [wall.id]: wall });
    const entry = byId(audit.entries).w1;

    expect(entry?.source).toBe('type-layer');
    expect(entry?.materialKey).toBe('cladding_beige_grey');
    expect(entry?.displayName).toBe('Beige-grey cladding');
    expect(entry?.shadowedMaterialKey).toBe('timber_frame_insulation');
    expect(entry?.flags).toContain('shadowed-instance-material');
    expect(audit.summary.bySource['type-layer']).toBe(1);
  });

  it('reports exterior face paint as stronger than type material', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w-painted',
      name: 'Painted wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 250,
      heightMm: 3000,
      wallTypeId: wallType.id,
      faceMaterialOverrides: [
        { faceKind: 'exterior', materialKey: 'brick_red', source: 'paint' },
      ],
    };

    const audit = auditElementMaterialCoverage({ [wallType.id]: wallType, [wall.id]: wall });
    const entry = byId(audit.entries)['w-painted'];

    expect(entry?.source).toBe('face-override');
    expect(entry?.materialKey).toBe('brick_red');
    expect(entry?.displayName).toBe('Red brick');
  });

  it('reports floor and roof type layer materials as effective render sources', () => {
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'f1',
      name: 'Typed floor',
      levelId: 'l1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
      ],
      thicknessMm: 240,
      floorTypeId: floorType.id,
    };
    const roof: Extract<Element, { kind: 'roof' }> = {
      kind: 'roof',
      id: 'r1',
      name: 'Typed roof',
      referenceLevelId: 'l2',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
      ],
      roofTypeId: roofType.id,
      materialKey: 'white_render',
    };

    const audit = auditElementMaterialCoverage({
      [floorType.id]: floorType,
      [roofType.id]: roofType,
      [floor.id]: floor,
      [roof.id]: roof,
    });
    const entries = byId(audit.entries);

    expect(entries.f1?.source).toBe('type-layer');
    expect(entries.f1?.materialKey).toBe('concrete_smooth');
    expect(entries.r1?.source).toBe('type-layer');
    expect(entries.r1?.materialKey).toBe('metal_standing_seam_dark_grey');
    expect(entries.r1?.shadowedMaterialKey).toBe('white_render');
  });

  it('reports window frame and glass as separate material facts', () => {
    const win: Extract<Element, { kind: 'window' }> = {
      kind: 'window',
      id: 'win1',
      name: 'Window',
      wallId: 'w1',
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 900,
      heightMm: 1400,
      materialKey: 'aluminium_dark_grey',
    };

    const audit = auditElementMaterialCoverage({ [win.id]: win });
    const entry = byId(audit.entries).win1;

    expect(entry?.source).toBe('instance');
    expect(entry?.materialKey).toBe('aluminium_dark_grey');
    expect(entry?.flags).toContain('no-subcomponent-slots');
    expect(entry?.subcomponents).toEqual([
      expect.objectContaining({
        slot: 'frame',
        materialKey: 'aluminium_dark_grey',
        source: 'instance',
      }),
      expect.objectContaining({
        slot: 'glass',
        materialKey: 'asset_clear_glass_double',
        source: 'subcomponent-default',
        category: 'glass',
      }),
    ]);
  });

  it('distinguishes category fallback from non-rendered elements', () => {
    const stair: Extract<Element, { kind: 'stair' }> = {
      kind: 'stair',
      id: 'stair1',
      name: 'Stair',
      baseLevelId: 'l1',
      topLevelId: 'l2',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
      widthMm: 1000,
      riserMm: 175,
      treadMm: 280,
    };
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'room1',
      name: 'Room',
      levelId: 'l1',
      outlineMm: [],
    };

    const audit = auditElementMaterialCoverage({ [stair.id]: stair, [room.id]: room });
    const entries = byId(audit.entries);

    expect(entries.stair1?.source).toBe('category-fallback');
    expect(entries.stair1?.flags).toContain('no-editable-target');
    expect(entries.room1?.source).toBe('non-rendered');
    expect(entries.room1?.flags).toContain('non-rendered-by-design');
    expect(audit.summary.flags['no-editable-target']).toBe(1);
    expect(audit.summary.flags['non-rendered-by-design']).toBe(1);
  });
});

