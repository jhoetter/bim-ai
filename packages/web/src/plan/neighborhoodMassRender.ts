/**
 * OSM-V3-02 — pure rendering helpers for `neighborhood_mass` elements.
 *
 * Neighborhood masses are context-massing polygons imported from OSM (WP-067).
 * They render as filled warm-grey polygons BELOW all other elements (lowest
 * z-order). They are suppressed in `floor_plan` views and hidden when the user
 * toggles `showNeighborhoodMasses` off in the viewport settings.
 */
import type { Element, XY } from '@bim-ai/core';

export type ViewKindForMass = 'site_plan' | 'elevation' | 'threed' | 'floor_plan' | string;

export type NeighborhoodMassPrimitive = {
  kind: 'neighborhood_mass_primitive';
  id: string;
  /** Footprint polygon vertices in model mm coordinates. */
  footprintMm: XY[];
  heightMm: number;
  baseElevationMm: number;
  /** CSS custom-property name to use as the fill colour — never a hex literal. */
  fillColorVar: '--neighborhood-mass-color';
  /** Opacity as declared in --neighborhood-mass-alpha (0–1). */
  fillAlpha: 0.85;
};

/**
 * Extract rendering primitives for all `neighborhood_mass` elements.
 *
 * Pass `viewKind` to suppress rendering in interior floor-plan views.
 * Pass `showNeighborhoodMasses = false` to suppress all masses.
 */
export function extractNeighborhoodMassPrimitives(
  elementsById: Record<string, Element>,
  opts: {
    viewKind?: ViewKindForMass;
    showNeighborhoodMasses?: boolean;
  } = {},
): NeighborhoodMassPrimitive[] {
  const { viewKind, showNeighborhoodMasses = true } = opts;

  // When the user toggles the layer off, emit nothing.
  if (!showNeighborhoodMasses) return [];

  // Suppress in interior floor-plan views; show in site_plan, elevation, threed
  // and any unrecognised view kind (fail-open so future view kinds still see context).
  if (viewKind === 'floor_plan') return [];

  const out: NeighborhoodMassPrimitive[] = [];

  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'neighborhood_mass') continue;
    const mass = el as Extract<Element, { kind: 'neighborhood_mass' }>;
    if (!mass.footprintMm || mass.footprintMm.length < 3) continue;

    out.push({
      kind: 'neighborhood_mass_primitive',
      id: mass.id,
      footprintMm: mass.footprintMm,
      heightMm: mass.heightMm,
      baseElevationMm: mass.baseElevationMm,
      fillColorVar: '--neighborhood-mass-color',
      fillAlpha: 0.85,
    });
  }

  return out;
}
