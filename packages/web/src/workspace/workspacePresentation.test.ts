import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  disciplineScopeNote,
  firstMmVector,
  formatStatusMm,
  lensForWorkspace,
  libraryDisciplineFromLens,
  slugToken,
  splitViewTabLabel,
  summarizeJobsCounts,
} from './workspacePresentation';

describe('workspacePresentation', () => {
  it('maps workspace and lens scopes', () => {
    expect(lensForWorkspace('arch')).toBe('architecture');
    expect(lensForWorkspace('struct')).toBe('structure');
    expect(lensForWorkspace('mep')).toBe('mep');
    expect(libraryDisciplineFromLens('architecture')).toBe('arch');
    expect(libraryDisciplineFromLens('structure')).toBe('struct');
    expect(libraryDisciplineFromLens('mep')).toBe('mep');
    expect(libraryDisciplineFromLens('all')).toBe('all');
  });

  it('splits view labels and formats status distances', () => {
    expect(splitViewTabLabel('Plan · Level 1')).toEqual({
      viewType: 'Plan',
      viewName: 'Level 1',
    });
    expect(splitViewTabLabel('Level 1', 'Plan')).toEqual({
      viewType: 'Plan',
      viewName: 'Level 1',
    });
    expect(formatStatusMm(2450)).toBe('2.5 m');
  });

  it('summarizes job statuses and slugifies labels', () => {
    expect(
      summarizeJobsCounts([
        { status: 'queued' },
        { status: 'running' },
        { status: 'running' },
        { status: 'errored' },
        { status: 'done' },
      ]),
    ).toEqual({ queued: 1, running: 2, errored: 1 });
    expect(slugToken(' A-101 / Plan ')).toBe('a-101-plan');
    expect(slugToken('   ')).toBe('item');
  });

  it('extracts finite mm vectors and reports discipline scope mismatches', () => {
    expect(firstMmVector({ xMm: '1', yMm: 2, zMm: 3 })).toEqual({
      xMm: 1,
      yMm: 2,
      zMm: 3,
    });
    expect(firstMmVector({ xMm: 1, yMm: Number.NaN, zMm: 3 })).toBeUndefined();
    const wall = {
      kind: 'wall',
      id: 'w1',
      name: 'Wall 1',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
      discipline: 'structure',
    } as unknown as Element;
    expect(disciplineScopeNote('arch', wall)).toContain('outside the active discipline scope');
    expect(disciplineScopeNote('struct', wall)).toBeNull();
  });
});
