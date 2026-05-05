import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  planLevelEvidenceToken,
  scheduleProjectBrowserEvidenceLine,
  sectionCutBrowserTooltipTitle,
  sectionCutProjectBrowserEvidenceLine,
  sheetProjectBrowserEvidenceLine,
  siteProjectBrowserEvidenceLine,
} from './projectBrowserEvidence';

const level1: Element = {
  kind: 'level',
  id: 'lvl-1',
  name: 'L1',
  elevationMm: 0,
};

function baseSection(id: string): Extract<Element, { kind: 'section_cut' }> {
  return {
    kind: 'section_cut',
    id,
    name: 'A-A',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 1000, yMm: 0 },
  };
}

describe('planLevelEvidenceToken', () => {
  it('uses level name when resolved', () => {
    const byId: Record<string, Element> = { 'lvl-1': level1 };
    expect(planLevelEvidenceToken(byId, 'lvl-1')).toBe('level=L1');
  });

  it('falls back to id when missing', () => {
    expect(planLevelEvidenceToken({}, 'lvl-x')).toBe('level=lvl-x');
  });
});

describe('sheetProjectBrowserEvidenceLine', () => {
  it('shows ∅ titleBlock and viewport count', () => {
    const sheet: Extract<Element, { kind: 'sheet' }> = {
      kind: 'sheet',
      id: 's1',
      name: 'S-101',
      viewportsMm: [{ viewRef: 'plan:p1' }, { viewRef: 'sec:sec1' }] as unknown[],
      titleblockParameters: { SheetNumber: 'A101', DesignedBy: 'x' },
    };
    expect(sheetProjectBrowserEvidenceLine(sheet)).toBe('titleBlock=∅ · viewports=2 · tbParams=2');
  });

  it('truncates long title blocks and adds paper size when finite', () => {
    const longName = 'A'.repeat(30);
    const sheet: Extract<Element, { kind: 'sheet' }> = {
      kind: 'sheet',
      id: 's1',
      name: 'S',
      titleBlock: longName,
      viewportsMm: [],
      paperWidthMm: 420,
      paperHeightMm: 297,
      titleblockParameters: {},
    };
    const line = sheetProjectBrowserEvidenceLine(sheet);
    expect(line.startsWith('titleBlock=')).toBe(true);
    expect(line).toContain('…');
    expect(line).toContain('viewports=0');
    expect(line).toContain('paper=420×297mm');
  });
});

describe('scheduleProjectBrowserEvidenceLine', () => {
  const sheet: Extract<Element, { kind: 'sheet' }> = {
    kind: 'sheet',
    id: 'sh-host',
    name: 'A-001',
    viewportsMm: [],
  };

  it('shows ∅ sheet placement and zero keys', () => {
    const sch: Extract<Element, { kind: 'schedule' }> = {
      kind: 'schedule',
      id: 'room-sched',
      name: 'Rooms',
    };
    expect(scheduleProjectBrowserEvidenceLine({}, sch)).toBe(
      'sheet=∅ · filterKeys=0 · groupKeys=0',
    );
  });

  it('resolves sheet name and counts filter/group keys', () => {
    const sch: Extract<Element, { kind: 'schedule' }> = {
      kind: 'schedule',
      id: 'room-sched',
      name: 'Rooms',
      sheetId: 'sh-host',
      filters: { rule1: {}, rule2: 'x' },
      grouping: { by: 'name' },
    };
    const byId: Record<string, Element> = { 'sh-host': sheet };
    expect(scheduleProjectBrowserEvidenceLine(byId, sch)).toBe(
      'sheet=A-001 · filterKeys=2 · groupKeys=1',
    );
  });

  it('uses sheetRef when sheet id missing from model', () => {
    const sch: Extract<Element, { kind: 'schedule' }> = {
      kind: 'schedule',
      id: 'sch',
      name: 'Door',
      sheetId: 'missing',
    };
    expect(scheduleProjectBrowserEvidenceLine({}, sch)).toBe(
      'sheetRef=missing · filterKeys=0 · groupKeys=0',
    );
  });
});

describe('sectionCutProjectBrowserEvidenceLine', () => {
  it('reports zero hosts without crop/path', () => {
    const sc = baseSection('sec-a');
    const byId: Record<string, Element> = { [sc.id]: sc };
    expect(sectionCutProjectBrowserEvidenceLine(byId, sc)).toBe('sheetHosts=0');
  });

  it('includes cropDepth, path vertex count, and sorted sheet hints', () => {
    const sc: Extract<Element, { kind: 'section_cut' }> = {
      ...baseSection('sec-shared'),
      cropDepthMm: 2400,
      segmentedPathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1, yMm: 0 },
        { xMm: 2, yMm: 0 },
      ],
    };
    const shB: Extract<Element, { kind: 'sheet' }> = {
      kind: 'sheet',
      id: 'sheet-b',
      name: 'B-200',
      viewportsMm: [{ viewRef: 'section:sec-shared' }] as unknown[],
    };
    const shA: Extract<Element, { kind: 'sheet' }> = {
      kind: 'sheet',
      id: 'sheet-a',
      name: 'A-100',
      viewportsMm: [{ view_ref: 'sec:sec-shared' }] as unknown[],
    };
    const byId: Record<string, Element> = {
      [sc.id]: sc,
      [shA.id]: shA,
      [shB.id]: shB,
    };
    const line = sectionCutProjectBrowserEvidenceLine(byId, sc);
    expect(line).toContain('cropDepthMm=2400');
    expect(line).toContain('pathVerts=3');
    expect(line).toContain('sheetHosts=');
    expect(line).toMatch(/A-100\(section:sec-shared\).*B-200\(section:sec-shared\)/);
  });
});

describe('sectionCutBrowserTooltipTitle', () => {
  it('prefixes readable name before evidence segment', () => {
    const sc = baseSection('sec-x');
    const byId: Record<string, Element> = { [sc.id]: sc };
    expect(sectionCutBrowserTooltipTitle(byId, sc)).toMatch(/^section_cut · A-A · /);
  });
});

describe('siteProjectBrowserEvidenceLine', () => {
  it('summarizes boundary, context rows, resolved ref level', () => {
    const site: Extract<Element, { kind: 'site' }> = {
      kind: 'site',
      id: 'site1',
      name: 'Lot A',
      referenceLevelId: 'lvl-1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
      contextObjects: [
        {
          id: 'c1',
          contextType: 'tree',
          positionMm: { xMm: 0, yMm: 0 },
        },
      ],
    };
    const byId: Record<string, Element> = { 'lvl-1': level1, [site.id]: site };
    expect(siteProjectBrowserEvidenceLine(byId, site)).toBe(
      'boundaryVerts=2 · context=1 · refLevel=L1',
    );
  });
});
