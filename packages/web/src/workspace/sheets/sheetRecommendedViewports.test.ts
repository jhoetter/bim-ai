import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  buildRecommendedSheetViewportDrafts,
  firstSheetId,
  placeViewOnSheetCommand,
  recommendedSheetViewportsCommand,
  recommendedViewsForSheet,
} from './sheetRecommendedViewports';

const elementsById: Record<string, Element> = {
  sheet: {
    kind: 'sheet',
    id: 'sheet',
    name: 'GA-01',
    paperWidthMm: 594,
    paperHeightMm: 420,
    viewportsMm: [{ viewportId: 'vp-existing', viewRef: 'plan:ground', label: 'Ground' }],
  } as Extract<Element, { kind: 'sheet' }>,
  ground: {
    kind: 'plan_view',
    id: 'ground',
    name: 'Ground plan',
    levelId: 'lvl',
  } as Extract<Element, { kind: 'plan_view' }>,
  upper: {
    kind: 'plan_view',
    id: 'upper',
    name: 'Upper plan',
    levelId: 'lvl2',
  } as Extract<Element, { kind: 'plan_view' }>,
  section: {
    kind: 'section_cut',
    id: 'section',
    name: 'South section',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 1000, yMm: 0 },
    cropDepthMm: 5000,
  } as Extract<Element, { kind: 'section_cut' }>,
  schedule: {
    kind: 'schedule',
    id: 'schedule',
    name: 'Door schedule',
  } as Extract<Element, { kind: 'schedule' }>,
};

describe('sheet recommended viewports', () => {
  it('returns placeable views not already on the sheet', () => {
    expect(recommendedViewsForSheet(elementsById, 'sheet').map((v) => v.id)).toEqual([
      'upper',
      'section',
      'schedule',
    ]);
  });

  it('keeps existing rows and appends deterministic recommended drafts', () => {
    const drafts = buildRecommendedSheetViewportDrafts(elementsById, 'sheet');
    expect(drafts[0]?.viewRef).toBe('plan:ground');
    expect(drafts.slice(1).map((d) => d.viewRef)).toEqual([
      'plan:upper',
      'section:section',
      'schedule:schedule',
    ]);
    expect(drafts[1]?.widthMm).toBeGreaterThan(1000);
  });

  it('builds the replayable command for one-click placement', () => {
    const cmd = recommendedSheetViewportsCommand(elementsById, 'sheet');
    expect(cmd?.type).toBe('upsertSheetViewports');
    expect(cmd?.viewportsMm).toHaveLength(4);
  });

  it('builds a command for placing a single selected view', () => {
    const cmd = placeViewOnSheetCommand(elementsById, 'sheet', 'section');
    expect(cmd?.viewportsMm.at(-1)?.viewRef).toBe('section:section');
  });

  it('does not rewrite the sheet when the selected view is already placed', () => {
    expect(placeViewOnSheetCommand(elementsById, 'sheet', 'ground')).toBeNull();
  });

  it('resolves the first sheet id by name', () => {
    expect(firstSheetId(elementsById)).toBe('sheet');
  });
});
