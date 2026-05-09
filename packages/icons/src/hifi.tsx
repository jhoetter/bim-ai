/**
 * High-fidelity 48×48 BIM icons.
 *
 * These are designed for display contexts (empty states, library tiles,
 * mode splash areas) where a 48px render size lets us add material
 * hatching, fills, and architectural detail that would be lost at 16–20px.
 *
 * Material conventions:
 *   Concrete — diagonal 45° hatch lines + light fill
 *   Steel    — light fill (fillOpacity 0.12) + fillet radii at junctions
 *   Glass    — double parallel lines + very light fill (fillOpacity 0.06)
 *   General fill — fillOpacity 0.07–0.08
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary faces / main outlines
 *   strokeWidth 1.5  — secondary edges, reveals, jambs
 *   strokeWidth 0.75 — hatch lines, detail, dimension ticks
 */
import { bimIconHifi } from './icon';

// ── Wall: plan cross-section with concrete hatch ──────────────────────────────
// Wall band runs full width. Outer faces are bold; fill + hatch shows material.
export const WallHifi = bimIconHifi(
  'WallHifi',
  <>
    <rect x="4" y="18" width="40" height="12" fill="currentColor" fillOpacity={0.07} />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="24" x2="10" y2="18" />
      <line x1="4" y1="30" x2="16" y2="18" />
      <line x1="10" y1="30" x2="22" y2="18" />
      <line x1="16" y1="30" x2="28" y2="18" />
      <line x1="22" y1="30" x2="34" y2="18" />
      <line x1="28" y1="30" x2="40" y2="18" />
      <line x1="34" y1="30" x2="44" y2="20" />
      <line x1="40" y1="30" x2="44" y2="26" />
    </g>
    <line x1="4" y1="18" x2="44" y2="18" strokeWidth={2} />
    <line x1="4" y1="30" x2="44" y2="30" strokeWidth={2} />
    <line x1="4" y1="18" x2="4" y2="30" strokeWidth={1.5} />
    <line x1="44" y1="18" x2="44" y2="30" strokeWidth={1.5} />
  </>,
);

// ── Door: plan view — wall with opening, hinge, door leaf, and swing arc ──────
// Wall sits in upper portion; door swings downward into the room.
// Hinge at (16,24). Leaf shown in open (perpendicular) position.
// Arc traces from closed position (32,24) to open position (16,40).
export const DoorHifi = bimIconHifi(
  'DoorHifi',
  <>
    {/* Left wall segment */}
    <rect x="4" y="12" width="12" height="12" fill="currentColor" fillOpacity={0.07} />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="20" x2="8" y2="12" />
      <line x1="4" y1="24" x2="12" y2="12" />
      <line x1="8" y1="24" x2="16" y2="16" />
      <line x1="12" y1="24" x2="16" y2="20" />
    </g>
    <line x1="4" y1="12" x2="16" y2="12" strokeWidth={2} />
    <line x1="4" y1="24" x2="16" y2="24" strokeWidth={2} />
    <line x1="4" y1="12" x2="4" y2="24" strokeWidth={1.5} />

    {/* Right wall segment */}
    <rect x="32" y="12" width="12" height="12" fill="currentColor" fillOpacity={0.07} />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="32" y1="20" x2="36" y2="12" />
      <line x1="32" y1="24" x2="40" y2="12" />
      <line x1="36" y1="24" x2="44" y2="16" />
      <line x1="40" y1="24" x2="44" y2="20" />
    </g>
    <line x1="32" y1="12" x2="44" y2="12" strokeWidth={2} />
    <line x1="32" y1="24" x2="44" y2="24" strokeWidth={2} />
    <line x1="44" y1="12" x2="44" y2="24" strokeWidth={1.5} />

    {/* Door jambs */}
    <line x1="16" y1="12" x2="16" y2="24" strokeWidth={1.5} />
    <line x1="32" y1="12" x2="32" y2="24" strokeWidth={1.5} />

    {/* Door leaf in open position — thin filled panel perpendicular to wall */}
    <rect x="14.5" y="24" width="3" height="16" fill="currentColor" />

    {/* Swing arc (dashed) — quarter circle CW from closed to open */}
    <path d="M32 24 A16 16 0 0 1 16 40" strokeWidth={1} strokeDasharray="3 2" />

    {/* Hinge pins */}
    <circle cx="16" cy="25.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="38.5" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

// ── Window: plan view — wall with reveal, frame, and glass panes ──────────────
// Opening runs from x=14 to x=34. Glass shown as double line with light fill.
export const WindowHifi = bimIconHifi(
  'WindowHifi',
  <>
    {/* Left wall */}
    <rect x="4" y="14" width="10" height="20" fill="currentColor" fillOpacity={0.07} />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="22" x2="8" y2="14" />
      <line x1="4" y1="28" x2="12" y2="14" />
      <line x1="4" y1="34" x2="14" y2="22" />
      <line x1="8" y1="34" x2="14" y2="28" />
      <line x1="12" y1="34" x2="14" y2="32" />
    </g>
    <line x1="4" y1="14" x2="14" y2="14" strokeWidth={2} />
    <line x1="4" y1="34" x2="14" y2="34" strokeWidth={2} />
    <line x1="4" y1="14" x2="4" y2="34" strokeWidth={1.5} />

    {/* Right wall */}
    <rect x="34" y="14" width="10" height="20" fill="currentColor" fillOpacity={0.07} />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="34" y1="22" x2="38" y2="14" />
      <line x1="34" y1="28" x2="42" y2="14" />
      <line x1="34" y1="34" x2="44" y2="22" />
      <line x1="38" y1="34" x2="44" y2="28" />
      <line x1="42" y1="34" x2="44" y2="32" />
    </g>
    <line x1="34" y1="14" x2="44" y2="14" strokeWidth={2} />
    <line x1="34" y1="34" x2="44" y2="34" strokeWidth={2} />
    <line x1="44" y1="14" x2="44" y2="34" strokeWidth={1.5} />

    {/* Window frame: head, sill, and reveal jambs */}
    <line x1="14" y1="14" x2="34" y2="14" strokeWidth={1.5} />
    <line x1="14" y1="34" x2="34" y2="34" strokeWidth={1.5} />
    <line x1="14" y1="14" x2="14" y2="34" strokeWidth={1.5} />
    <line x1="34" y1="14" x2="34" y2="34" strokeWidth={1.5} />

    {/* Glass: two parallel panes with light fill between */}
    <rect x="14" y="21" width="20" height="6" fill="currentColor" fillOpacity={0.06} />
    <line x1="14" y1="21" x2="34" y2="21" strokeWidth={1.2} />
    <line x1="14" y1="27" x2="34" y2="27" strokeWidth={1.2} />
  </>,
);

// ── Stair: plan view — 4 treads, nosing lines, cut diagonal, up-arrow ─────────
// Stair rises from lower-left (10,42) to upper-right (42,10).
// Diagonal dashed line = floor-plan cut. Arrow = direction of ascent.
export const StairHifi = bimIconHifi(
  'StairHifi',
  <>
    {/* Tread fill */}
    <path d="M42 10H34V18H26V26H18V34H10V42H42Z" fill="currentColor" fillOpacity={0.07} />

    {/* Nosing lines (riser faces) — slightly bolder than the outer boundary */}
    <line x1="34" y1="10" x2="34" y2="18" strokeWidth={2} />
    <line x1="26" y1="18" x2="26" y2="26" strokeWidth={2} />
    <line x1="18" y1="26" x2="18" y2="34" strokeWidth={2} />
    <line x1="10" y1="34" x2="10" y2="42" strokeWidth={2} />

    {/* Outer stair boundary */}
    <path d="M42 10H34V18H26V26H18V34H10V42H42Z" strokeWidth={1.5} />

    {/* Cut line — diagonal dashed across the stair */}
    <line x1="10" y1="10" x2="42" y2="42" strokeWidth={1.5} strokeDasharray="4 3" />

    {/* Direction arrow — pointing up-right (direction of travel) */}
    <line x1="22" y1="32" x2="32" y2="20" strokeWidth={1.5} />
    <polygon points="32,20 25,22 27,28" fill="currentColor" stroke="none" />
  </>,
);

// ── Column: plan cross-section — concrete hatch, bold border, grid lines ──────
// 20×20 column centred at (24,24). Dashed grid lines extend to canvas edge.
// Grid bubble circle at top marks the grid intersection.
export const ColumnHifi = bimIconHifi(
  'ColumnHifi',
  <>
    {/* Column body fill */}
    <rect x="14" y="14" width="20" height="20" fill="currentColor" fillOpacity={0.07} />

    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="14" y1="22" x2="20" y2="14" />
      <line x1="14" y1="28" x2="26" y2="14" />
      <line x1="14" y1="34" x2="32" y2="14" />
      <line x1="18" y1="34" x2="34" y2="18" />
      <line x1="24" y1="34" x2="34" y2="24" />
      <line x1="30" y1="34" x2="34" y2="30" />
    </g>

    {/* Bold column border */}
    <rect x="14" y="14" width="20" height="20" strokeWidth={2} />

    {/* Dashed grid lines outside column */}
    <line x1="24" y1="4" x2="24" y2="14" strokeWidth={1} strokeDasharray="3 2" />
    <line x1="24" y1="34" x2="24" y2="41" strokeWidth={1} strokeDasharray="3 2" />
    <line x1="4" y1="24" x2="14" y2="24" strokeWidth={1} strokeDasharray="3 2" />
    <line x1="34" y1="24" x2="44" y2="24" strokeWidth={1} strokeDasharray="3 2" />

    {/* Grid bubble at top */}
    <circle cx="24" cy="4" r="4" strokeWidth={1} />
  </>,
);

// ── Beam: I-section cross-section — flanges, web, steel fill, fillet radii ────
// Proportioned as a UB/W-shape: wide flanges, narrow web, rounded junctions.
export const BeamHifi = bimIconHifi(
  'BeamHifi',
  <>
    {/* Top flange */}
    <rect x="8" y="10" width="32" height="7" fill="currentColor" fillOpacity={0.12} />
    <rect x="8" y="10" width="32" height="7" strokeWidth={1.5} />

    {/* Bottom flange */}
    <rect x="8" y="31" width="32" height="7" fill="currentColor" fillOpacity={0.12} />
    <rect x="8" y="31" width="32" height="7" strokeWidth={1.5} />

    {/* Web fill */}
    <rect x="19.5" y="17" width="9" height="14" fill="currentColor" fillOpacity={0.12} />
    <line x1="19.5" y1="17" x2="19.5" y2="31" strokeWidth={1.5} />
    <line x1="28.5" y1="17" x2="28.5" y2="31" strokeWidth={1.5} />

    {/* Fillet radii at top flange–web junctions */}
    <path d="M19.5 17 Q19.5 20 22 20" strokeWidth={1} />
    <path d="M28.5 17 Q28.5 20 26 20" strokeWidth={1} />

    {/* Fillet radii at bottom flange–web junctions */}
    <path d="M19.5 31 Q19.5 28 22 28" strokeWidth={1} />
    <path d="M28.5 31 Q28.5 28 26 28" strokeWidth={1} />
  </>,
);

// ── Roof: pitched elevation — ridge, two slopes, tile courses, eave ───────────
// Ridge at (24,7). Eaves at y=43. Horizontal tile courses clipped by the slope.
export const RoofHifi = bimIconHifi(
  'RoofHifi',
  <>
    {/* Roof fill */}
    <path d="M24 7L44 43L4 43Z" fill="currentColor" fillOpacity={0.06} />

    {/* Tile course lines — horizontal, inside the roof triangle */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="21" y1="14" x2="27" y2="14" />
      <line x1="17" y1="21" x2="31" y2="21" />
      <line x1="13" y1="28" x2="35" y2="28" />
      <line x1="9" y1="35" x2="39" y2="35" />
    </g>

    {/* Main outline */}
    <line x1="24" y1="7" x2="4" y2="43" strokeWidth={1.5} />
    <line x1="24" y1="7" x2="44" y2="43" strokeWidth={1.5} />
    <line x1="4" y1="43" x2="44" y2="43" strokeWidth={2} />

    {/* Ridge cap */}
    <line x1="21" y1="7" x2="27" y2="7" strokeWidth={2} />

    {/* Fascia drop at eaves */}
    <line x1="4" y1="43" x2="4" y2="46" strokeWidth={1.5} />
    <line x1="44" y1="43" x2="44" y2="46" strokeWidth={1.5} />
  </>,
);

// ── Room: plan view — dashed boundary, centroid cross, label area ─────────────
// Room separation lines are conventionally dashed (not solid walls).
// Cross marks the room's area-label anchor point.
export const RoomHifi = bimIconHifi(
  'RoomHifi',
  <>
    {/* Room boundary */}
    <rect x="5" y="5" width="38" height="38" strokeWidth={1.5} strokeDasharray="4 3" />

    {/* Centroid cross */}
    <line x1="24" y1="18" x2="24" y2="30" strokeWidth={1.5} />
    <line x1="18" y1="24" x2="30" y2="24" strokeWidth={1.5} />

    {/* Room label placeholder lines */}
    <line x1="15" y1="33" x2="33" y2="33" strokeWidth={1} strokeOpacity={0.45} />
    <line x1="18" y1="37" x2="30" y2="37" strokeWidth={1} strokeOpacity={0.45} />
  </>,
);

// ── Section: plan cut-line symbol — heavy dash, end bubbles, view arrows ──────
// Two circles mark the cut ends; downward legs + filled triangles show the
// viewing direction (looking south into the section).
export const SectionHifi = bimIconHifi(
  'SectionHifi',
  <>
    {/* Cut line */}
    <line x1="14" y1="18" x2="34" y2="18" strokeWidth={2} strokeDasharray="5 3" />

    {/* Left end bubble */}
    <circle cx="10" cy="18" r="5" strokeWidth={1.5} />
    <line x1="10" y1="23" x2="10" y2="34" strokeWidth={1.5} />
    <polygon points="7,34 13,34 10,41" fill="currentColor" stroke="none" />

    {/* Right end bubble */}
    <circle cx="38" cy="18" r="5" strokeWidth={1.5} />
    <line x1="38" y1="23" x2="38" y2="34" strokeWidth={1.5} />
    <polygon points="35,34 41,34 38,41" fill="currentColor" stroke="none" />

    {/* Sheet/number divider lines inside bubbles */}
    <line x1="6" y1="18" x2="14" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="34" y1="18" x2="42" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── Floor slab: plan view — boundary, concrete hatch, inner edge relief ───────
// Large slab area with full concrete hatch and a dashed inner offset line
// suggesting the slab edge or a drop panel boundary.
export const FloorHifi = bimIconHifi(
  'FloorHifi',
  <>
    {/* Slab fill */}
    <rect x="4" y="10" width="40" height="28" fill="currentColor" fillOpacity={0.07} />

    {/* Concrete hatch — 45° lines NE, spaced 6px */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="22" x2="16" y2="10" />
      <line x1="4" y1="28" x2="22" y2="10" />
      <line x1="4" y1="34" x2="28" y2="10" />
      <line x1="6" y1="38" x2="34" y2="10" />
      <line x1="12" y1="38" x2="40" y2="10" />
      <line x1="18" y1="38" x2="44" y2="12" />
      <line x1="24" y1="38" x2="44" y2="18" />
      <line x1="30" y1="38" x2="44" y2="24" />
      <line x1="36" y1="38" x2="44" y2="30" />
      <line x1="42" y1="38" x2="44" y2="36" />
    </g>

    {/* Bold slab boundary */}
    <rect x="4" y="10" width="40" height="28" strokeWidth={2} />

    {/* Inner offset — drop panel / edge condition suggestion */}
    <rect
      x="10"
      y="16"
      width="28"
      height="16"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />
  </>,
);
