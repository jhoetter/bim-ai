import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { inspectorPropertiesContextForElement } from './WorkspaceRightRailContext';

describe('WorkspaceRightRail — Properties Palette context', () => {
  it('classifies Project Browser type rows as type context', () => {
    const wallType: Element = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Generic 200',
      basisLine: 'center',
      layers: [],
    };

    expect(inspectorPropertiesContextForElement(wallType)).toBe('type');
  });

  it('keeps placed model elements in instance context', () => {
    const wall: Element = {
      kind: 'wall',
      id: 'w-1',
      name: 'Wall 1',
      wallTypeId: 'wt-1',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };

    expect(inspectorPropertiesContextForElement(wall)).toBe('instance');
  });

  it('routes document selections to view context', () => {
    const planView: Element = {
      kind: 'plan_view',
      id: 'pv-1',
      name: 'Level 1',
      levelId: 'lvl-1',
    };

    expect(inspectorPropertiesContextForElement(planView)).toBe('view');
  });
});
