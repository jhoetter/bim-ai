import { describe, expect, it } from 'vitest';

import { exportToIfc } from './ifcExporter';

import type { Element } from '@bim-ai/core';

describe('exportToIfc', () => {
  it('contains IFCWALL, IFCDOOR, IFCOPENINGELEMENT for a minimal model with 2 walls and 1 door', () => {
    const elements: Record<string, Element> = {
      'lvl-1': {
        kind: 'level',
        id: 'lvl-1',
        name: 'Ground Floor',
        elevationMm: 0,
      },
      'wall-1': {
        kind: 'wall',
        id: 'wall-1',
        name: 'Wall A',
        levelId: 'lvl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 5000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
      },
      'wall-2': {
        kind: 'wall',
        id: 'wall-2',
        name: 'Wall B',
        levelId: 'lvl-1',
        start: { xMm: 5000, yMm: 0 },
        end: { xMm: 5000, yMm: 4000 },
        thicknessMm: 200,
        heightMm: 2800,
      },
      'door-1': {
        kind: 'door',
        id: 'door-1',
        name: 'Front Door',
        wallId: 'wall-1',
        alongT: 0.5,
        widthMm: 900,
      },
    };

    const result = exportToIfc(elements);

    expect(result).toContain('IFCWALLSTANDARDCASE');
    expect(result).toContain('IFCDOOR');
    expect(result).toContain('IFCOPENINGELEMENT');
  });

  it('starts with ISO-10303-21 and ends with END-ISO-10303-21;', () => {
    const result = exportToIfc({});

    expect(result.startsWith('ISO-10303-21;')).toBe(true);
    expect(result.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
  });

  it('contains IFCSPACE for a model with a room element', () => {
    const elements: Record<string, Element> = {
      'lvl-1': {
        kind: 'level',
        id: 'lvl-1',
        name: 'Ground Floor',
        elevationMm: 0,
      },
      'room-1': {
        kind: 'room',
        id: 'room-1',
        name: 'Living Room',
        levelId: 'lvl-1',
        outlineMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      },
    };

    const result = exportToIfc(elements);

    expect(result).toContain('IFCSPACE');
  });

  it('emits Pset_WallCommon and Pset_DoorCommon for walls and doors', () => {
    const elements: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground Floor', elevationMm: 0 },
      'wall-1': {
        kind: 'wall',
        id: 'wall-1',
        name: 'Wall A',
        levelId: 'lvl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 5000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
      },
      'door-1': {
        kind: 'door',
        id: 'door-1',
        name: 'Front Door',
        wallId: 'wall-1',
        alongT: 0.5,
        widthMm: 900,
      },
    };

    const result = exportToIfc(elements);

    expect(result).toContain('Pset_WallCommon');
    expect(result).toContain('Pset_DoorCommon');
    expect(result).toContain('IFCPROPERTYSET');
    expect(result).toContain('IFCRELDEFINESBYPROPERTIES');
  });

  it('emits IFCMATERIALLAYERSETUSAGE for walls', () => {
    const elements: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground Floor', elevationMm: 0 },
      'wall-1': {
        kind: 'wall',
        id: 'wall-1',
        name: 'Wall A',
        levelId: 'lvl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 5000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
      },
    };

    const result = exportToIfc(elements);

    expect(result).toContain('IFCMATERIALLAYER');
    expect(result).toContain('IFCMATERIALLAYERSET');
    expect(result).toContain('IFCMATERIALLAYERSETUSAGE');
    expect(result).toContain('IFCRELASSOCIATESMATERIAL');
  });

  it('emits Pset_SpaceCommon with NetFloorArea for rooms with an outline', () => {
    const elements: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground Floor', elevationMm: 0 },
      'room-1': {
        kind: 'room',
        id: 'room-1',
        name: 'Living Room',
        levelId: 'lvl-1',
        // 4m × 3m = 12 m²
        outlineMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      },
    };

    const result = exportToIfc(elements);

    expect(result).toContain('Pset_SpaceCommon');
    expect(result).toContain('NetFloorArea');
    // 12.0 m² as IFCAREAMEASURE
    expect(result).toContain('IFCAREAMEASURE(12.000000)');
  });

  it('produces a valid ISO 10303-21 file (round-trip header check)', () => {
    const elements: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground Floor', elevationMm: 0 },
      'wall-1': {
        kind: 'wall',
        id: 'wall-1',
        name: 'Wall A',
        levelId: 'lvl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 5000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
      },
    };

    const result = exportToIfc(elements);

    // Every line in the DATA section that starts with # must end with ;
    const dataSection = result.split('DATA;')[1]!.split('ENDSEC;')[0]!;
    const entityLines = dataSection
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('#'));
    for (const line of entityLines) {
      expect(line.endsWith(';'), `Entity line must end with semicolon: ${line}`).toBe(true);
    }

    // Must contain FILE_SCHEMA IFC2X3
    expect(result).toContain("FILE_SCHEMA(('IFC2X3'))");
  });
});
