import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  buildAttachTopCommand,
  buildDetachTopCommand,
  ceilingBoundaryFromRoom,
  expandFootprintByOverhang,
  roofParamsFromFloor,
  roofParamsFromWallLoop,
  validateShaftSpan,
} from './roofByFootprint';

type WallElem = Extract<Element, { kind: 'wall' }>;
type FloorElem = Extract<Element, { kind: 'floor' }>;

function makeWall(
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  levelId = 'lvl-1',
): WallElem {
  return {
    kind: 'wall',
    id,
    levelId,
    start: { xMm: sx, yMm: sy },
    end: { xMm: ex, yMm: ey },
    heightMm: 3000,
  } as WallElem;
}

function makeFloor(id: string, boundary: { xMm: number; yMm: number }[]): FloorElem {
  return { kind: 'floor', id, levelId: 'lvl-1', boundaryMm: boundary } as FloorElem;
}

function makeLevel(id: string, elevationMm: number): Element {
  return { kind: 'level', id, name: id, elevationMm } as Element;
}

// ---------------------------------------------------------------------------
// WP-NEXT-45 — Roof by Footprint
// ---------------------------------------------------------------------------

describe('WP-NEXT-45 roofByFootprint', () => {
  describe('expandFootprintByOverhang', () => {
    it('expands a square by the given overhang on each side', () => {
      const pts = [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ];
      const expanded = expandFootprintByOverhang(pts, 500);
      expect(expanded.length).toBe(4);
      // All points should be farther from the centroid than the originals.
      const cx = 2000;
      const cy = 1500;
      for (let i = 0; i < 4; i++) {
        const d0 = Math.hypot(pts[i]!.xMm - cx, pts[i]!.yMm - cy);
        const d1 = Math.hypot(expanded[i]!.xMm - cx, expanded[i]!.yMm - cy);
        expect(d1).toBeGreaterThan(d0 - 1);
      }
    });

    it('returns original points unchanged when overhang is 0', () => {
      const pts = [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 2000 },
      ];
      expect(expandFootprintByOverhang(pts, 0)).toEqual(pts);
    });

    it('returns original points unchanged when fewer than 3 points', () => {
      const pts = [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ];
      expect(expandFootprintByOverhang(pts, 500)).toEqual(pts);
    });
  });

  describe('roofParamsFromWallLoop', () => {
    it('derives footprint from wall start points and expands by overhang', () => {
      const walls = [
        makeWall('s', 0, 0, 4000, 0),
        makeWall('e', 4000, 0, 4000, 3000),
        makeWall('n', 4000, 3000, 0, 3000),
        makeWall('w', 0, 3000, 0, 0),
      ];
      const params = roofParamsFromWallLoop(walls, 'lvl-1', 300, 25);
      expect(params).not.toBeNull();
      expect(params!.referenceLevelId).toBe('lvl-1');
      expect(params!.overhangMm).toBe(300);
      expect(params!.slopeDeg).toBe(25);
      expect(params!.footprintMm.length).toBe(4);
    });

    it('returns null for fewer than 3 walls', () => {
      const walls = [makeWall('a', 0, 0, 4000, 0), makeWall('b', 4000, 0, 4000, 3000)];
      expect(roofParamsFromWallLoop(walls, 'lvl-1', 0, 25)).toBeNull();
    });
  });

  describe('roofParamsFromFloor', () => {
    it('derives footprint from floor boundary', () => {
      const floor = makeFloor('f1', [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 4000 },
        { xMm: 0, yMm: 4000 },
      ]);
      const params = roofParamsFromFloor(floor, 400, 30);
      expect(params).not.toBeNull();
      expect(params!.footprintMm.length).toBe(4);
      expect(params!.slopeDeg).toBe(30);
    });

    it('returns null when floor has no valid boundary', () => {
      const floor = makeFloor('f2', [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ]);
      expect(roofParamsFromFloor(floor, 0, 25)).toBeNull();
    });
  });

  describe('ceilingBoundaryFromRoom', () => {
    it('returns the room boundary when present', () => {
      const boundary = [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ];
      const roomElem = {
        kind: 'room',
        id: 'rm-1',
        levelId: 'lvl-1',
        name: 'Living',
        boundaryMm: boundary,
      } as unknown as Element;
      const result = ceilingBoundaryFromRoom('rm-1', { 'rm-1': roomElem });
      expect(result).toEqual(boundary);
    });

    it('returns null when the room has no boundary', () => {
      const roomElem = { kind: 'room', id: 'rm-2', levelId: 'lvl-1', name: 'R' } as Element;
      expect(ceilingBoundaryFromRoom('rm-2', { 'rm-2': roomElem })).toBeNull();
    });

    it('returns null when the element id is not a room', () => {
      const wall = makeWall('w', 0, 0, 1000, 0);
      expect(ceilingBoundaryFromRoom('w', { w: wall as unknown as Element })).toBeNull();
    });
  });

  describe('validateShaftSpan', () => {
    const elementsById: Record<string, Element> = {
      'lvl-gnd': makeLevel('lvl-gnd', 0),
      'lvl-1': makeLevel('lvl-1', 3000),
      'lvl-2': makeLevel('lvl-2', 6000),
      'lvl-roof': makeLevel('lvl-roof', 9000),
    };

    it('accepts a valid two-level span', () => {
      const r = validateShaftSpan('lvl-gnd', 'lvl-2', elementsById);
      expect(r.valid).toBe(true);
      expect(r.reason).toBeNull();
    });

    it('rejects when base is not below top', () => {
      const r = validateShaftSpan('lvl-2', 'lvl-1', elementsById);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('base_level_not_below_top');
    });

    it('rejects when base level is unknown', () => {
      const r = validateShaftSpan('lvl-missing', 'lvl-2', elementsById);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('base_level_not_found');
    });

    it('rejects when top level is unknown', () => {
      const r = validateShaftSpan('lvl-gnd', 'lvl-missing', elementsById);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('top_level_not_found');
    });
  });

  describe('buildAttachTopCommand / buildDetachTopCommand', () => {
    it('builds an attachWallTop payload for a roof target', () => {
      const cmd = buildAttachTopCommand('wall-1', 'roof', 'roof-1');
      expect(cmd).toEqual({
        type: 'attachWallTop',
        wallId: 'wall-1',
        targetKind: 'roof',
        targetId: 'roof-1',
      });
    });

    it('builds a detachWallTop payload', () => {
      const cmd = buildDetachTopCommand('wall-1');
      expect(cmd).toEqual({ type: 'detachWallTop', wallId: 'wall-1' });
    });
  });
});
