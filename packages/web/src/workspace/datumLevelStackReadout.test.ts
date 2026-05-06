import { describe, expect, it } from 'vitest';

import type { Element, Violation } from '@bim-ai/core';

import {
  LEVEL_DATUM_ELEVATION_ALIGN_EPS_MM,
  buildLevelDatumStackEvidenceToken,
  buildLevelDatumStackRows,
  filterDatumWorkbenchViolations,
  formatElevationMmReadout,
  levelIdsFromDatumRows,
  resolveDatumElevationToken,
} from './datumLevelStackReadout';

function lvl(
  id: string,
  name: string,
  elevationMm: number,
  extra?: Partial<Element> & Record<string, unknown>,
): Element {
  return {
    kind: 'level',
    id,
    name,
    elevationMm,
    ...extra,
  } as Element;
}

function planView(id: string, levelId: string): Element {
  return {
    kind: 'plan_view',
    id,
    name: id,
    levelId,
  };
}

describe('datumLevelStackReadout', () => {
  it('formatElevationMmReadout rounds to three decimals', () => {
    expect(formatElevationMmReadout(3000)).toBe('3000');
    expect(formatElevationMmReadout(3000.123456)).toBe('3000.123');
  });

  it('resolveDatumElevationToken matches constraints epsilon', () => {
    const parent = lvl('p', 'P', 1000);
    expect(resolveDatumElevationToken(2500, 1500, parent)).toBe('derived');
    expect(
      resolveDatumElevationToken(2500 - LEVEL_DATUM_ELEVATION_ALIGN_EPS_MM + 0.5, 1500, parent),
    ).toBe('derived');
    expect(
      resolveDatumElevationToken(2500 - LEVEL_DATUM_ELEVATION_ALIGN_EPS_MM * 2, 1500, parent),
    ).toBe('authored');
    expect(resolveDatumElevationToken(3000, 0, undefined)).toBe('unresolved_parent');
    expect(
      resolveDatumElevationToken(3000, 0, {
        kind: 'wall',
        id: 'w',
        name: 'W',
        levelId: 'x',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1, yMm: 0 },
        thicknessMm: 100,
        heightMm: 2000,
      }),
    ).toBe('unresolved_parent');
  });

  it('buildLevelDatumStackRows sorts by elevation then id', () => {
    const doc: Record<string, Element> = {
      l2: lvl('l2', 'L2', 6000),
      l1: lvl('l1', 'L1', 3000),
      l0a: lvl('l0a', 'L0a', 0),
      l0b: lvl('l0b', 'L0b', 0),
    };
    const rows = buildLevelDatumStackRows(doc);
    expect(rows.map((r) => r.id)).toEqual(['l0a', 'l0b', 'l1', 'l2']);
  });

  it('buildLevelDatumStackRows parent chain and tokens', () => {
    const doc: Record<string, Element> = {
      parent: lvl('parent', 'Parent', 1000),
      childOk: lvl('childOk', 'Child ok', 3500, {
        parentLevelId: 'parent',
        offsetFromParentMm: 2500,
      }),
      childOff: lvl('childOff', 'Child off', 9999, {
        parentLevelId: 'parent',
        offsetFromParentMm: 2500,
      }),
      orphan: lvl('orphan', 'Orphan', 500, { parentLevelId: 'missing', offsetFromParentMm: 100 }),
    };
    const byId = Object.fromEntries(buildLevelDatumStackRows(doc).map((r) => [r.id, r]));
    expect(byId.parent?.elevationToken).toBe('root');
    expect(byId.parent?.parentLevelId).toBe(null);
    expect(byId.childOk?.elevationToken).toBe('derived');
    expect(byId.childOff?.elevationToken).toBe('authored');
    expect(byId.orphan?.elevationToken).toBe('unresolved_parent');
    expect(byId.childOk?.parentName).toBe('Parent');
  });

  it('buildLevelDatumStackRows counts plan views per level', () => {
    const doc: Record<string, Element> = {
      a: lvl('a', 'A', 0),
      b: lvl('b', 'B', 3000),
      p1: planView('p1', 'a'),
      p2: planView('p2', 'a'),
      p3: planView('p3', 'b'),
    };
    const rows = buildLevelDatumStackRows(doc);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.a?.planViewCount).toBe(2);
    expect(byId.b?.planViewCount).toBe(1);
  });

  it('filterDatumWorkbenchViolations keeps intersecting rule ids only', () => {
    const rows = buildLevelDatumStackRows({ l: lvl('l', 'L', 0) });
    const ids = levelIdsFromDatumRows(rows);
    const viols: Violation[] = [
      { ruleId: 'level_duplicate_elevation', severity: 'warning', message: 'x', elementIds: ['l'] },
      {
        ruleId: 'level_datum_parent_offset_mismatch',
        severity: 'warning',
        message: 'm',
        elementIds: ['l', 'p'],
      },
      {
        ruleId: 'wall_constraint_levels_inverted',
        severity: 'warning',
        message: 'w',
        elementIds: ['wall1'],
      },
    ];
    const f = filterDatumWorkbenchViolations(viols, ids);
    expect(f.map((v) => v.ruleId)).toEqual(['level_datum_parent_offset_mismatch']);
  });

  it('buildLevelDatumStackEvidenceToken is stable', () => {
    const doc: Record<string, Element> = {
      b: lvl('b', 'B', 100),
      a: lvl('a', 'A', 0),
    };
    const rows = buildLevelDatumStackRows(doc);
    expect(buildLevelDatumStackEvidenceToken(rows, 'a')).toBe(
      'levelDatumStack[sel=a] a:0:root:par=-:pv=0|b:100:root:par=-:pv=0',
    );
  });
});
