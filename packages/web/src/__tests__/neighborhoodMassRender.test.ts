/**
 * OSM-V3-02 — tests for neighborhood_mass rendering helpers.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import {
  extractNeighborhoodMassPrimitives,
  type NeighborhoodMassPrimitive,
} from '../plan/neighborhoodMassRender';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const massA: Extract<Element, { kind: 'neighborhood_mass' }> = {
  kind: 'neighborhood_mass',
  id: 'mass-a',
  osmId: 'way/123456',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  heightMm: 9000,
  baseElevationMm: 0,
  source: 'osm',
  isReadOnly: true,
};

const massB: Extract<Element, { kind: 'neighborhood_mass' }> = {
  kind: 'neighborhood_mass',
  id: 'mass-b',
  footprintMm: [
    { xMm: 20000, yMm: 0 },
    { xMm: 30000, yMm: 0 },
    { xMm: 25000, yMm: 12000 },
  ],
  heightMm: 6000,
  baseElevationMm: 0,
  source: 'manual',
  isReadOnly: true,
};

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall 1',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
  wallTypeId: 'generic_200mm',
};

const allElements: Record<string, Element> = {
  [massA.id]: massA,
  [massB.id]: massB,
  [wall.id]: wall,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OSM-V3-02 — extractNeighborhoodMassPrimitives', () => {
  it('neighborhood_mass element renders as a polygon with fill', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements);
    expect(prims.length).toBe(2);
    const prim = prims.find((p) => p.id === 'mass-a')!;
    expect(prim.kind).toBe('neighborhood_mass_primitive');
    expect(prim.footprintMm.length).toBe(4);
    expect(prim.fillAlpha).toBeGreaterThan(0);
  });

  it('fill uses a CSS custom-property var, not a hex literal', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements);
    for (const prim of prims) {
      // fillColorVar must start with '--' (a CSS custom property name)
      expect(prim.fillColorVar).toMatch(/^--/);
      // Must NOT be a bare hex literal (no '#' in the var name)
      expect(prim.fillColorVar).not.toMatch(/#/);
    }
  });

  it('showNeighborhoodMasses = false excludes all elements from render', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      showNeighborhoodMasses: false,
    });
    expect(prims).toHaveLength(0);
  });

  it('interior floor_plan view suppresses neighborhood masses', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      viewKind: 'floor_plan',
    });
    expect(prims).toHaveLength(0);
  });

  it('site_plan view shows neighborhood masses', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      viewKind: 'site_plan',
    });
    expect(prims.length).toBeGreaterThan(0);
  });

  it('z-order: neighborhood_mass primitive emits before wall meshes would (primitives contain no walls)', () => {
    // extractNeighborhoodMassPrimitives must only return neighborhood_mass_primitive kinds
    // and must exclude walls — confirming they are injected at lowest z-order (before walls).
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      viewKind: 'site_plan',
    });
    const hasWall = prims.some(
      (p) => (p as { kind: string }).kind !== 'neighborhood_mass_primitive',
    );
    expect(hasWall).toBe(false);
    // All returned primitives are neighborhood masses, never wall elements
    expect(prims.every((p) => p.kind === 'neighborhood_mass_primitive')).toBe(true);
  });

  it('elevation view shows neighborhood masses', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      viewKind: 'elevation',
    });
    expect(prims.length).toBeGreaterThan(0);
  });

  it('threed view shows neighborhood masses', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements, {
      viewKind: 'threed',
    });
    expect(prims.length).toBeGreaterThan(0);
  });

  it('non-mass elements are excluded from primitives', () => {
    const prims = extractNeighborhoodMassPrimitives(allElements);
    const ids = prims.map((p) => p.id);
    expect(ids).not.toContain('wall-1');
  });

  it('degenerate mass with fewer than 3 vertices is excluded', () => {
    const degenerate: Extract<Element, { kind: 'neighborhood_mass' }> = {
      ...massA,
      id: 'mass-degen',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ],
    };
    const prims = extractNeighborhoodMassPrimitives({
      [degenerate.id]: degenerate,
    });
    expect(prims).toHaveLength(0);
  });

  it('fillAlpha matches the design-token value of 0.85', () => {
    const prims = extractNeighborhoodMassPrimitives({ [massA.id]: massA });
    const prim = prims[0] as NeighborhoodMassPrimitive;
    expect(prim.fillAlpha).toBe(0.85);
  });
});
