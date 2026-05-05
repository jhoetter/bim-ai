import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  BUILTIN_MATERIAL_DISPLAY,
  CUT_THICKNESS_MATCH_EPS_MM,
  buildMaterialStackEvidenceToken,
  buildUpsertLayeredTypeCommand,
  formatLayerFunctionRole,
  resolveMaterialDisplayLabel,
  resolveMaterialLayerReadout,
  roundThicknessMm,
  validateLayerAuthoringDraft,
} from './materialLayerCatalogWorkbench';

const emptyDoc: Record<string, Element> = {};

describe('materialLayerCatalogWorkbench', () => {
  it('resolveMaterialDisplayLabel matches builtin seeds only', () => {
    expect(resolveMaterialDisplayLabel('mat-gwb-finish-v1')).toBe('Gypsum board finish');
    expect(resolveMaterialDisplayLabel('  mat-gwb-finish-v1  ')).toBe('Gypsum board finish');
    expect(resolveMaterialDisplayLabel('')).toBe('');
    expect(resolveMaterialDisplayLabel('unknown-mat')).toBe('');
    expect(Object.keys(BUILTIN_MATERIAL_DISPLAY).length).toBe(6);
  });

  it('formatLayerFunctionRole maps known functions', () => {
    expect(formatLayerFunctionRole('structure')).toBe('Structure');
    expect(formatLayerFunctionRole('insulation')).toBe('Insulation');
    expect(formatLayerFunctionRole('finish')).toBe('Finish');
    expect(formatLayerFunctionRole('custom')).toBe('custom');
  });

  it('roundThicknessMm matches backend-style rounding', () => {
    expect(roundThicknessMm(150.123456)).toBe(150.123);
  });

  it('wall: type stack vs instance fallback', () => {
    const wt: Element = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Partition',
      layers: [
        { thicknessMm: 100, function: 'structure', materialKey: 'mat-concrete-structure-v1' },
        { thicknessMm: 50, function: 'finish', materialKey: 'mat-gwb-finish-v1' },
      ],
    };
    const wallOk: Element = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 150,
      heightMm: 2800,
      wallTypeId: 'wt-1',
    };
    const elements: Record<string, Element> = { 'wt-1': wt, w1: wallOk };
    const r = resolveMaterialLayerReadout(wallOk, elements);
    expect(r?.layerSource).toBe('type_stack');
    expect(r?.layers).toHaveLength(2);
    expect(r?.layers[0].materialDisplay).toBe('Concrete structure');
    expect(r?.layers[1].materialDisplay).toBe('Gypsum board finish');
    expect(r?.layerTotalThicknessMm).toBe(150);
    expect(r?.layerStackMatchesCutThickness).toBe(true);

    const wallLoose: Element = { ...wallOk, thicknessMm: 150 + CUT_THICKNESS_MATCH_EPS_MM * 2 };
    const r2 = resolveMaterialLayerReadout(wallLoose, elements);
    expect(r2?.layerStackMatchesCutThickness).toBe(false);

    const wallNoType: Element = {
      kind: 'wall',
      id: 'w2',
      name: 'W2',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
    const r3 = resolveMaterialLayerReadout(wallNoType, emptyDoc);
    expect(r3?.layerSource).toBe('instance_fallback');
    expect(r3?.layers).toEqual([
      expect.objectContaining({
        function: 'structure',
        materialKey: '',
        thicknessMm: 200,
      }),
    ]);
    expect(r3?.layerStackMatchesCutThickness).toBe(true);
  });

  it('floor: typed layers and mismatch', () => {
    const ft: Element = {
      kind: 'floor_type',
      id: 'ft-a',
      name: 'Slab',
      layers: [
        { thicknessMm: 100, function: 'structure', materialKey: 'mat-concrete-structure-v1' },
        { thicknessMm: 40, function: 'finish', materialKey: 'mat-epoxy-cleanroom-v1' },
      ],
    };
    const floor: Element = {
      kind: 'floor',
      id: 'f1',
      name: 'F',
      levelId: 'lvl',
      boundaryMm: [],
      thicknessMm: 140,
      floorTypeId: 'ft-a',
    };
    const doc = { 'ft-a': ft, f1: floor };
    const r = resolveMaterialLayerReadout(floor, doc);
    expect(r?.layerSource).toBe('type_stack');
    expect(r?.layerTotalThicknessMm).toBe(140);
    expect(r?.layerStackMatchesCutThickness).toBe(true);

    const floorBad = { ...floor, thicknessMm: 999 };
    const r2 = resolveMaterialLayerReadout(floorBad, doc);
    expect(r2?.layerStackMatchesCutThickness).toBe(false);
  });

  it('roof: stacks, missing type id, empty type', () => {
    const rt: Element = {
      kind: 'roof_type',
      id: 'rt-1',
      name: 'Warm deck',
      layers: [
        { thicknessMm: 22, function: 'structure', materialKey: 'mat-osb-roof-deck-v1' },
        { thicknessMm: 140, function: 'insulation', materialKey: 'mat-insulation-roof-board-v1' },
      ],
    };
    const roof: Element = {
      kind: 'roof',
      id: 'r1',
      name: 'R',
      referenceLevelId: 'lvl',
      footprintMm: [],
      roofTypeId: 'rt-1',
    };
    const r = resolveMaterialLayerReadout(roof, { 'rt-1': rt, r1: roof });
    expect(r?.layerSource).toBe('roof_type_stack');
    expect(r?.skipReason).toBeNull();
    expect(r?.layers).toHaveLength(2);
    expect(r?.layerStackMatchesCutThickness).toBeNull();
    expect(r?.cutProxyThicknessMm).toBeNull();

    const noType = { ...roof, roofTypeId: null };
    const r2 = resolveMaterialLayerReadout(noType as Element, { 'rt-1': rt, r1: noType as Element });
    expect(r2?.layerSource).toBe('none');
    expect(r2?.skipReason).toBe('roof_missing_roof_type_id');
    expect(r2?.layers).toHaveLength(0);

    const rtEmpty: Element = { kind: 'roof_type', id: 'rt-e', name: 'Empty', layers: [] };
    const roof3: Element = { ...roof, roofTypeId: 'rt-e' };
    const r3 = resolveMaterialLayerReadout(roof3, { 'rt-e': rtEmpty, r1: roof3 });
    expect(r3?.skipReason).toBe('roof_type_without_layers');
  });

  it('type elements: preserves layer order', () => {
    const wt: Element = {
      kind: 'wall_type',
      id: 'wt',
      name: 'T',
      layers: [
        { thicknessMm: 10, function: 'finish', materialKey: '' },
        { thicknessMm: 90, function: 'structure', materialKey: '' },
      ],
    };
    const r = resolveMaterialLayerReadout(wt, { wt });
    expect(r?.mode).toBe('type_element');
    expect(r?.layers.map((x) => x.function)).toEqual(['finish', 'structure']);
    expect(r?.layerStackMatchesCutThickness).toBeNull();
    expect(r?.layerTotalThicknessMm).toBe(100);
  });

  it('buildMaterialStackEvidenceToken is stable and parse-friendly', () => {
    const readout = resolveMaterialLayerReadout(
      {
        kind: 'wall',
        id: 'w1',
        name: 'W',
        levelId: 'lvl',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1, yMm: 0 },
        thicknessMm: 150,
        heightMm: 2800,
        wallTypeId: 'wt',
      },
      {
        wt: {
          kind: 'wall_type',
          id: 'wt',
          name: 'T',
          layers: [
            { thicknessMm: 100, function: 'structure', materialKey: 'a' },
            { thicknessMm: 50, function: 'finish', materialKey: 'b' },
          ],
        },
      },
    );
    expect(readout).toBeTruthy();
    const tok = buildMaterialStackEvidenceToken(readout!);
    expect(tok).toContain('host=w1');
    expect(tok).toContain('type=wt');
    expect(tok).toContain('layers=2');
    expect(tok).toContain('align=match');
    expect(tok).toContain('src=type_stack');
  });

  it('validateLayerAuthoringDraft rejects empty or bad thickness', () => {
    expect(validateLayerAuthoringDraft([]).length).toBeGreaterThan(0);
    expect(
      validateLayerAuthoringDraft([
        { index: 0, thicknessMm: -1, function: 'structure', materialKey: '' },
      ]).length,
    ).toBeGreaterThan(0);
    expect(
      validateLayerAuthoringDraft([
        { index: 0, thicknessMm: 100, function: 'structure', materialKey: '' },
      ]),
    ).toEqual([]);
  });

  it('buildUpsertLayeredTypeCommand preserves wall basisLine and rounds thickness', () => {
    const wt: Element = {
      kind: 'wall_type',
      id: 'wt',
      name: 'Composite',
      basisLine: 'face_interior',
      layers: [],
    };
    const cmd = buildUpsertLayeredTypeCommand(wt, [
      { index: 0, thicknessMm: 100.123456, function: 'structure', materialKey: 'mat-a' },
      { index: 1, thicknessMm: 50, function: 'finish', materialKey: '  mat-b  ' },
    ]);
    expect(cmd).toMatchObject({
      type: 'upsertWallType',
      id: 'wt',
      name: 'Composite',
      basisLine: 'face_interior',
    });
    expect(cmd.layers).toEqual([
      { thicknessMm: 100.123, function: 'structure', materialKey: 'mat-a' },
      { thicknessMm: 50, function: 'finish', materialKey: 'mat-b' },
    ]);
  });

  it('buildUpsertLayeredTypeCommand builds floor and roof upserts', () => {
    const ft: Element = {
      kind: 'floor_type',
      id: 'ft',
      name: 'Slab',
      layers: [],
    };
    expect(
      buildUpsertLayeredTypeCommand(ft, [
        { index: 0, thicknessMm: 200, function: 'structure', materialKey: '' },
      ]),
    ).toMatchObject({
      type: 'upsertFloorType',
      id: 'ft',
    });
    const rt: Element = {
      kind: 'roof_type',
      id: 'rt',
      name: 'Deck',
      layers: [],
    };
    expect(
      buildUpsertLayeredTypeCommand(rt, [
        { index: 0, thicknessMm: 22, function: 'structure', materialKey: 'x' },
      ]),
    ).toMatchObject({
      type: 'upsertRoofType',
      id: 'rt',
    });
  });
});
