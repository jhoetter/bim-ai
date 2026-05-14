import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { makeFamilyInstancePlanSymbol } from './familyInstancePlanRendering';
import { FAMILY_EDITOR_CATEGORY_PARAM } from '../familyEditor/familyEditorPersistence';

describe('makeFamilyInstancePlanSymbol', () => {
  it('draws a footprint for loaded furniture families without symbolic lines', () => {
    const type: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-chair',
      name: 'Lounge Chair',
      familyId: 'catalog:living-room:chair',
      discipline: 'generic',
      parameters: {
        [FAMILY_EDITOR_CATEGORY_PARAM]: 'furniture',
        widthMm: 900,
        depthMm: 850,
      },
    };
    const instance: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'fi-chair',
      name: 'Lounge Chair',
      familyTypeId: type.id,
      levelId: 'lvl-1',
      positionMm: { xMm: 1200, yMm: 800 },
      rotationDeg: 90,
    };

    const symbol = makeFamilyInstancePlanSymbol(
      instance,
      { [type.id]: type, [instance.id]: instance },
      'medium',
    );

    expect(symbol).toBeInstanceOf(THREE.Group);
    expect(symbol?.userData.bimPickId).toBe('fi-chair');
    expect(symbol?.children.some((child) => child instanceof THREE.LineSegments)).toBe(true);
  });
});
