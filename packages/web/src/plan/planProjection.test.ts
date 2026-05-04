import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import { canonHiddenCategory, resolvePlanViewDisplay } from './planProjection';

describe('planProjection', () => {
  it('maps common category aliases', () => {
    expect(canonHiddenCategory('Rooms')).toBe('room');
    expect(canonHiddenCategory('grid-lines')).toBe('grid_line');
  });

  it('inherits template hiddenCategories when plan_view references template', () => {
    const elementsById: Record<string, Element> = {
      'vt-1': {
        kind: 'view_template',
        id: 'vt-1',
        name: 'T',
        scale: 'scale_100',
        hiddenCategories: ['door'],
      },
      'pv-1': {
        kind: 'plan_view',
        id: 'pv-1',
        name: 'V',
        levelId: 'lvl-1',
        viewTemplateId: 'vt-1',
        categoriesHidden: ['room'],
      },
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'EG', elevationMm: 0 },
    };
    const d = resolvePlanViewDisplay(elementsById, 'pv-1', 'lvl-99', 'default');
    expect(d.activeLevelId).toBe('lvl-1');
    expect(d.presentation).toBe('default');
    expect(d.hiddenSemanticKinds.has('room')).toBe(true);
    expect(d.hiddenSemanticKinds.has('door')).toBe(true);
  });

  it('uses global presentation fallback when plan_view inactive', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'EG', elevationMm: 0 },
    };
    const d = resolvePlanViewDisplay(elementsById, undefined, 'lvl-1', 'room_scheme');
    expect(d.activeLevelId).toBe('lvl-1');
    expect(d.presentation).toBe('room_scheme');
    expect(d.hiddenSemanticKinds.size).toBe(0);
  });
});
