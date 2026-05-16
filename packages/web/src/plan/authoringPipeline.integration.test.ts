/**
 * WP-NEXT-50 — End-to-end authoring pipeline integration tests.
 *
 * Proves the full helper chain works as a workflow:
 *   wall connectivity → structural validation → roof params → modify availability
 *   → advisor violation conversion
 *
 * These tests cover the non-UI portion of the proof suite (geometry/lifecycle helpers).
 * Playwright seeded screenshots cover the UI portion separately.
 */

import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  collectWallConnectivity,
  wallConnectivityToPlanJoinRecords,
  type WallConnectivityWall,
} from '../geometry/wallConnectivity';
import { validationIssuesToViolations } from '../advisor/structuralAdvisorViolations';
import { getEnabledVerbs } from './modifyAvailability';
import {
  expandFootprintByOverhang,
  roofParamsFromWallLoop,
  validateShaftSpan,
} from './roofByFootprint';
import {
  findDuplicateWalls,
  findOrphanedHostedElements,
  runStructuralValidation,
  validateBoundary,
} from './structuralValidation';

type WallElem = Extract<Element, { kind: 'wall' }>;

function makeConnWall(
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): WallConnectivityWall {
  return {
    id,
    levelId: 'lvl-1',
    start: { xMm: sx, yMm: sy },
    end: { xMm: ex, yMm: ey },
    thicknessMm: 200,
  };
}

function makeWallElem(id: string, sx: number, sy: number, ex: number, ey: number): WallElem {
  return {
    kind: 'wall',
    id,
    levelId: 'lvl-1',
    start: { xMm: sx, yMm: sy },
    end: { xMm: ex, yMm: ey },
    heightMm: 3000,
  } as WallElem;
}

// ---------------------------------------------------------------------------
// WP-NEXT-50 — Plan workflow: floor → walls → roof → attach
// ---------------------------------------------------------------------------

describe('WP-NEXT-50 authoring pipeline integration', () => {
  // --- Step 1: draw a rectangular floor boundary ---
  const floorBoundary = [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ];

  it('Step 1 — floor boundary passes structural validation', () => {
    const issues = validateBoundary('floor-1', floorBoundary);
    expect(issues).toHaveLength(0);
  });

  // --- Step 2: generate four walls from the floor ---
  const walls = [
    makeConnWall('w-s', 0, 0, 6000, 0),
    makeConnWall('w-e', 6000, 0, 6000, 4000),
    makeConnWall('w-n', 6000, 4000, 0, 4000),
    makeConnWall('w-w', 0, 4000, 0, 0),
  ];
  const wallElems = walls.map((w) =>
    makeWallElem(w.id, w.start.xMm, w.start.yMm, w.end.xMm, w.end.yMm),
  );

  it('Step 2 — four generated walls form exactly 4 endpoint joins with no T/X joins', () => {
    const joins = collectWallConnectivity(walls, { toleranceMm: 5 });
    expect(joins).toHaveLength(4);
    expect(joins.every((j) => j.kind === 'endpoint')).toBe(true);
  });

  it('Step 2 — wall join records all have null skip_reason (all joins are allowed)', () => {
    const joins = collectWallConnectivity(walls, { toleranceMm: 5 });
    const records = wallConnectivityToPlanJoinRecords(
      joins,
      Object.fromEntries(walls.map((w) => [w.id, w])),
    );
    expect(records.every((r) => r.skipReason === null)).toBe(true);
  });

  it('Step 2 — no duplicate walls in generated set', () => {
    expect(findDuplicateWalls(wallElems)).toHaveLength(0);
  });

  // --- Step 3: build roof from wall loop ---
  it('Step 3 — roofParamsFromWallLoop produces expanded footprint with overhang', () => {
    const params = roofParamsFromWallLoop(wallElems, 'lvl-1', 500, 30);
    expect(params).not.toBeNull();
    expect(params!.footprintMm.length).toBe(4);
    expect(params!.overhangMm).toBe(500);
    expect(params!.slopeDeg).toBe(30);
    // All expanded points should be outside the original bounding box
    for (const pt of params!.footprintMm) {
      expect(pt.xMm < 0 || pt.xMm > 6000 || pt.yMm < 0 || pt.yMm > 4000).toBe(true);
    }
  });

  it('Step 3 — overhang expansion preserves polygon vertex count', () => {
    const expanded = expandFootprintByOverhang(floorBoundary, 600);
    expect(expanded.length).toBe(floorBoundary.length);
  });

  // --- Step 4: insert a door; verify no orphaned elements ---
  const elementsById: Record<string, Element> = {
    ...Object.fromEntries(wallElems.map((w) => [w.id, w as unknown as Element])),
    'd-1': {
      kind: 'door',
      id: 'd-1',
      levelId: 'lvl-1',
      hostId: 'w-s',
      offsetAlongHostMm: 2000,
    } as unknown as Element,
  };

  it('Step 4 — door with valid host produces no orphan issues', () => {
    const issues = findOrphanedHostedElements(elementsById);
    expect(issues).toHaveLength(0);
  });

  it('Step 4 — full model passes runStructuralValidation', () => {
    const issues = runStructuralValidation(elementsById);
    expect(issues).toHaveLength(0);
  });

  // --- Step 5: validate shaft span for a 2-level shaft ---
  const levelElements: Record<string, Element> = {
    'lvl-1': { kind: 'level', id: 'lvl-1', name: 'Ground', elevationMm: 0 } as Element,
    'lvl-2': { kind: 'level', id: 'lvl-2', name: 'First', elevationMm: 3000 } as Element,
  };

  it('Step 5 — shaft spanning two valid levels is accepted', () => {
    const result = validateShaftSpan('lvl-1', 'lvl-2', levelElements);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  // --- Step 6: selected wall modify availability ---
  it('Step 6 — selected wall enables move/copy/rotate/attach/unjoin in plan', () => {
    const enabled = getEnabledVerbs(['wall'], 'plan');
    expect(enabled).toContain('move');
    expect(enabled).toContain('copy');
    expect(enabled).toContain('rotate');
    expect(enabled).toContain('attach');
    expect(enabled).toContain('unjoin');
  });

  // --- Step 7: invalid workflow — duplicate wall produces advisor violation ---
  it('Step 7 — duplicate wall yields structural_authoring violation in the advisor channel', () => {
    const dupElemsById: Record<string, Element> = {
      'w-a': makeWallElem('w-a', 0, 0, 4000, 0) as unknown as Element,
      'w-b': makeWallElem('w-b', 0, 0, 4000, 0) as unknown as Element,
    };
    const issues = runStructuralValidation(dupElemsById);
    const violations = validationIssuesToViolations(issues);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.ruleId).toBe('structural_authoring.duplicate_wall');
    expect(violations[0]!.severity).toBe('error');
    expect(violations[0]!.blocking).toBe(true);
  });

  // --- Step 8: Cmd+K workflow — verify evaluate chain returns correct state ---
  it('Step 8 — 3D wall attach is enabled, schedule attach is disabled', () => {
    const planEnabled = getEnabledVerbs(['wall'], 'plan');
    const scheduleEnabled = getEnabledVerbs(['wall'], 'schedule');
    expect(planEnabled).toContain('attach');
    expect(scheduleEnabled).not.toContain('attach');
  });
});
