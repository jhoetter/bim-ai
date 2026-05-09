/**
 * High-fidelity 48×48 BIM icons — extended view and documentation types.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — walls, structural (warm stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, white, plaster (warm off-white)
 *   --hi-glass    / --hi-glass-op     — glazing panes (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, header rows (blue-gray)
 *   --hi-leaf                         — vegetation accent (currentColor fallback)
 *   --hi-roof     / --hi-roof-op      — roof surface (warm tan)
 *   --hi-room     / --hi-room-op      — interior space, data rows (pale yellow)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, grid lines, text placeholder lines
 */
import { bimIconHifi } from './icon';

// ── ReflectedCeilingPlanHifi — ceiling plan (room fill) with grid, light fixtures, down-arrow ──
export const ReflectedCeilingPlanHifi = bimIconHifi(
  'ReflectedCeilingPlanHifi',
  <>
    {/* Ceiling interior fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="36"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
    />

    {/* Ceiling outline */}
    <rect x="4" y="4" width="40" height="36" strokeWidth={2} />

    {/* Ceiling grid lines — horizontal */}
    <line x1="4" y1="16" x2="44" y2="16" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="28" x2="44" y2="28" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Ceiling grid lines — vertical */}
    <line x1="16" y1="4" x2="16" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="30" y1="4" x2="30" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Light fixture squares with finish fill */}
    <rect
      x="9"
      y="9"
      width="4"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1}
    />
    <rect
      x="23"
      y="9"
      width="4"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1}
    />
    <rect
      x="9"
      y="21"
      width="4"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1}
    />
    <rect
      x="23"
      y="21"
      width="4"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1}
    />

    {/* Light fixture cross marks */}
    <line x1="9" y1="11" x2="13" y2="11" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="11" y1="9" x2="11" y2="13" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="23" y1="11" x2="27" y2="11" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="25" y1="9" x2="25" y2="13" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="9" y1="23" x2="13" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="11" y1="21" x2="11" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="23" y1="23" x2="27" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="25" y1="21" x2="25" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Down-arrow indicating reflected view direction */}
    <line x1="38" y1="7" x2="38" y2="36" strokeWidth={1.5} />
    <polyline points="35,32 38,37 41,32" strokeWidth={1.5} fill="none" />
  </>,
);

// ── StructuralPlanHifi — structural floor plan with columns, beams, grid ──
export const StructuralPlanHifi = bimIconHifi(
  'StructuralPlanHifi',
  <>
    {/* Structural slab fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />

    {/* Outer perimeter outline */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Structural grid lines */}
    <line
      x1="4"
      y1="20"
      x2="44"
      y2="20"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.4}
    />
    <line
      x1="4"
      y1="36"
      x2="44"
      y2="36"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.4}
    />
    <line
      x1="20"
      y1="4"
      x2="20"
      y2="44"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.4}
    />
    <line
      x1="36"
      y1="4"
      x2="36"
      y2="44"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.4}
    />

    {/* Columns as filled squares — steel fill at grid intersections */}
    <rect
      x="17"
      y="17"
      width="6"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="33"
      y="17"
      width="6"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="17"
      y="33"
      width="6"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="33"
      y="33"
      width="6"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />

    {/* Corner columns */}
    <rect
      x="4"
      y="4"
      width="5"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="39"
      y="4"
      width="5"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="4"
      y="39"
      width="5"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />
    <rect
      x="39"
      y="39"
      width="5"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1.5}
    />

    {/* Beam lines connecting columns */}
    <line x1="9" y1="7" x2="39" y2="7" strokeWidth={1.5} />
    <line x1="9" y1="41" x2="39" y2="41" strokeWidth={1.5} />
    <line x1="7" y1="9" x2="7" y2="39" strokeWidth={1.5} />
    <line x1="41" y1="9" x2="41" y2="39" strokeWidth={1.5} />
  </>,
);

// ── AreaPlanHifi — floor plan with area zone fill, boundary dashes, area tag ──
export const AreaPlanHifi = bimIconHifi(
  'AreaPlanHifi',
  <>
    {/* Wall outlines — concrete fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="9" y="9" width="30" height="30" fill="none" strokeWidth={1.5} />

    {/* Wall fill frame — clear interior */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Interior area zone fill */}
    <rect
      x="9"
      y="9"
      width="30"
      height="30"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
      stroke="none"
    />

    {/* Area boundary dashes */}
    <rect
      x="13"
      y="13"
      width="22"
      height="22"
      fill="none"
      strokeWidth={0.75}
      strokeDasharray="4 2"
    />

    {/* Area tag box with sqm label placeholder — center */}
    <rect x="16" y="18" width="16" height="10" rx="1" fill="none" strokeWidth={1} />
    <line x1="19" y1="22" x2="29" y2="22" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="20" y1="25" x2="27" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── DetailViewHifi — plan + magnifier circle zooming to large detail, reference bubble ──
export const DetailViewHifi = bimIconHifi(
  'DetailViewHifi',
  <>
    {/* Small source plan in top-left */}
    <rect
      x="4"
      y="4"
      width="18"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    {/* Inner room of source plan */}
    <rect x="7" y="7" width="12" height="10" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Magnifier circle boundary */}
    <circle cx="13" cy="12" r="5" fill="none" strokeWidth={1.5} strokeDasharray="2 1.5" />

    {/* Leader line from magnifier to large detail view */}
    <line x1="17" y1="16" x2="24" y2="23" strokeWidth={1} strokeOpacity={0.6} />

    {/* Large detail view box — finish fill */}
    <rect
      x="24"
      y="23"
      width="20"
      height="18"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={2}
    />

    {/* Detail content — hatch pattern */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="24" y1="27" x2="30" y2="23" />
      <line x1="24" y1="32" x2="36" y2="23" />
      <line x1="24" y1="37" x2="42" y2="24" />
      <line x1="27" y1="41" x2="44" y2="27" />
      <line x1="33" y1="41" x2="44" y2="32" />
      <line x1="39" y1="41" x2="44" y2="38" />
    </g>

    {/* Scale bar below detail */}
    <line x1="24" y1="44" x2="44" y2="44" strokeWidth={1} />
    <line x1="24" y1="42" x2="24" y2="44" strokeWidth={1} />
    <line x1="34" y1="42" x2="34" y2="44" strokeWidth={1} />
    <line x1="44" y1="42" x2="44" y2="44" strokeWidth={1} />

    {/* Reference bubble at top-right of detail */}
    <circle
      cx="39"
      cy="19"
      r="5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1}
    />
    <line x1="37" y1="19" x2="41" y2="19" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="39" y1="17" x2="39" y2="21" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── DraftingViewHifi — blank drafting sheet with hand-drawn linework, pencil icon ──
export const DraftingViewHifi = bimIconHifi(
  'DraftingViewHifi',
  <>
    {/* Drafting sheet — finish fill */}
    <rect
      x="6"
      y="4"
      width="32"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={2}
    />

    {/* Sheet margin line */}
    <rect x="9" y="7" width="26" height="33" fill="none" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Hand-drawn linework — concrete stroke, slightly irregular lines */}
    <line x1="11" y1="13" x2="33" y2="13" strokeWidth={1.5} />
    <line x1="11" y1="13" x2="11" y2="30" strokeWidth={1.5} />
    <line x1="11" y1="30" x2="22" y2="30" strokeWidth={1.5} />
    <line x1="22" y1="22" x2="22" y2="30" strokeWidth={1.5} />
    <line x1="22" y1="22" x2="33" y2="22" strokeWidth={1.5} />
    <line x1="33" y1="13" x2="33" y2="22" strokeWidth={1.5} />

    {/* Detail marks — dimension tick lines */}
    <line x1="11" y1="34" x2="33" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="11" y1="33" x2="11" y2="35" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="33" y1="33" x2="33" y2="35" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Pencil icon at top-right corner */}
    <line x1="37" y1="7" x2="42" y2="12" strokeWidth={1.5} />
    <line x1="37" y1="7" x2="39" y2="5" strokeWidth={1.5} />
    <line x1="39" y1="5" x2="44" y2="10" strokeWidth={1.5} />
    <line x1="44" y1="10" x2="42" y2="12" strokeWidth={1.5} />
    <line x1="37" y1="7" x2="35" y2="14" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="42" y1="12" x2="35" y2="14" strokeWidth={1} strokeOpacity={0.6} />
    {/* Pencil tip */}
    <polygon points="35,14 36,17 38,15" fill="currentColor" stroke="none" />
  </>,
);

// ── WalkthroughHifi — corridor in perspective, camera path arrows, walking figure ──
export const WalkthroughHifi = bimIconHifi(
  'WalkthroughHifi',
  <>
    {/* Floor in perspective — concrete fill */}
    <polygon
      points="4,44 44,44 36,28 12,28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={2}
    />

    {/* Ceiling in perspective — room fill */}
    <polygon
      points="4,8 44,8 36,22 12,22"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
      strokeWidth={2}
    />

    {/* Left wall */}
    <polygon
      points="4,8 12,22 12,28 4,44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Right wall */}
    <polygon
      points="44,8 36,22 36,28 44,44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Vanishing point perspective lines */}
    <line x1="4" y1="8" x2="24" y2="25" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="44" y1="8" x2="24" y2="25" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="4" y1="44" x2="24" y2="25" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="44" y1="44" x2="24" y2="25" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Camera path arrow along floor center */}
    <line x1="24" y1="41" x2="24" y2="30" strokeWidth={1.5} />
    <polyline points="21,33 24,28 27,33" strokeWidth={1.5} fill="none" />

    {/* Keyframe diamond markers along path */}
    <polygon points="24,38 26,36 24,34 22,36" fill="currentColor" stroke="none" />

    {/* Walking figure — simplified stick figure */}
    <circle cx="24" cy="15" r="2" strokeWidth={1} />
    <line x1="24" y1="17" x2="24" y2="21" strokeWidth={1} />
    <line x1="21" y1="19" x2="27" y2="19" strokeWidth={1} />
    <line x1="24" y1="21" x2="22" y2="24" strokeWidth={1} />
    <line x1="24" y1="21" x2="26" y2="24" strokeWidth={1} />
  </>,
);

// ── LegendHifi — sheet with legend key boxes: material swatches and labels ──
export const LegendHifi = bimIconHifi(
  'LegendHifi',
  <>
    {/* Legend sheet — finish fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={2}
    />

    {/* Legend title bar */}
    <rect
      x="4"
      y="4"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      stroke="none"
    />
    <line x1="4" y1="12" x2="44" y2="12" strokeWidth={1.5} />
    <line x1="7" y1="8" x2="22" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Concrete swatch */}
    <rect
      x="8"
      y="16"
      width="8"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Concrete hatch inside swatch */}
    <line x1="8" y1="20" x2="12" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="10" y1="22" x2="16" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="13" y1="22" x2="16" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Concrete label placeholder */}
    <line x1="20" y1="18" x2="38" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="20" y1="21" x2="34" y2="21" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Steel swatch */}
    <rect
      x="8"
      y="26"
      width="8"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={1}
    />
    {/* Steel label placeholder */}
    <line x1="20" y1="28" x2="40" y2="28" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="20" y1="31" x2="36" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Roof/finish swatch */}
    <rect
      x="8"
      y="36"
      width="8"
      height="6"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.07)' }}
      strokeWidth={1}
    />
    {/* Roof label placeholder */}
    <line x1="20" y1="38" x2="38" y2="38" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="20" y1="41" x2="32" y2="41" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── SheetListHifi — stacked sheets with number/title/revision columns and header ──
export const SheetListHifi = bimIconHifi(
  'SheetListHifi',
  <>
    {/* Header row — steel fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
    />

    {/* Sheet list rows — finish fill */}
    <rect
      x="4"
      y="12"
      width="40"
      height="32"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />

    {/* Outer border */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Header bottom line */}
    <line x1="4" y1="12" x2="44" y2="12" strokeWidth={1.5} />

    {/* Column dividers */}
    <line x1="14" y1="4" x2="14" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="34" y1="4" x2="34" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Header text placeholders */}
    <line x1="6" y1="8" x2="12" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="16" y1="8" x2="30" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="36" y1="8" x2="42" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Row separators */}
    <line x1="4" y1="20" x2="44" y2="20" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="28" x2="44" y2="28" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Row 1 data */}
    <line x1="6" y1="16" x2="12" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="16" x2="31" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="36" y1="16" x2="40" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row 2 data */}
    <line x1="6" y1="24" x2="12" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="24" x2="29" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="36" y1="24" x2="41" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row 3 data */}
    <line x1="6" y1="32" x2="12" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="32" x2="32" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="36" y1="32" x2="39" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row 4 data */}
    <line x1="6" y1="40" x2="12" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="40" x2="30" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="36" y1="40" x2="42" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── NoteBlockHifi — text block with callout bubble, number indicator, leader arrow ──
export const NoteBlockHifi = bimIconHifi(
  'NoteBlockHifi',
  <>
    {/* Text block — finish fill */}
    <rect
      x="12"
      y="4"
      width="32"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={2}
    />

    {/* Text lines inside block */}
    <line x1="16" y1="10" x2="40" y2="10" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="14" x2="40" y2="14" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="18" x2="38" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="22" x2="40" y2="22" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="26" x2="36" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="30" x2="40" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="34" x2="34" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Keynote number callout bubble — concrete fill */}
    <circle
      cx="8"
      cy="20"
      r="7"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    {/* Keynote number placeholder */}
    <line x1="5" y1="20" x2="11" y2="20" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Leader arrow from bubble to text block */}
    <line x1="15" y1="20" x2="12" y2="20" strokeWidth={1} />
    <polygon points="12,20 15,18.5 15,21.5" fill="currentColor" stroke="none" />

    {/* Keynote indicator at top of text block */}
    <circle cx="20" cy="7" r="2.5" fill="none" strokeWidth={1} />
    <line x1="18.5" y1="7" x2="21.5" y2="7" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Bottom tag area */}
    <rect x="12" y="40" width="32" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="42" x2="28" y2="42" strokeWidth={0.75} strokeOpacity={0.35} />
  </>,
);

// ── ViewListHifi — alternating rows with type icon, name, discipline badge columns ──
export const ViewListHifi = bimIconHifi(
  'ViewListHifi',
  <>
    {/* Header row */}
    <rect
      x="4"
      y="4"
      width="40"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
    />

    {/* Alternating row fills */}
    <rect
      x="4"
      y="11"
      width="40"
      height="7"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />
    <rect
      x="4"
      y="18"
      width="40"
      height="7"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
    />
    <rect
      x="4"
      y="25"
      width="40"
      height="7"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />
    <rect
      x="4"
      y="32"
      width="40"
      height="7"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
    />
    <rect
      x="4"
      y="39"
      width="40"
      height="5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />

    {/* Outer border */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Header line */}
    <line x1="4" y1="11" x2="44" y2="11" strokeWidth={1.5} />

    {/* Column dividers */}
    <line x1="14" y1="4" x2="14" y2="44" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="34" y1="4" x2="34" y2="44" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row dividers */}
    <line x1="4" y1="18" x2="44" y2="18" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="4" y1="25" x2="44" y2="25" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="4" y1="32" x2="44" y2="32" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="4" y1="39" x2="44" y2="39" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* View type icon placeholders — small squares in first column */}
    <rect x="6" y="13" width="5" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="6" y="20" width="5" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="6" y="27" width="5" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="6" y="34" width="5" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="6" y="40" width="5" height="3" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* View name text placeholder lines */}
    <line x1="16" y1="15" x2="30" y2="15" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="22" x2="32" y2="22" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="29" x2="28" y2="29" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="36" x2="31" y2="36" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Discipline badge — steel fill tags in third column */}
    <rect
      x="36"
      y="13"
      width="6"
      height="4"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={0.75}
    />
    <rect
      x="36"
      y="20"
      width="6"
      height="4"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={0.75}
    />
    <rect
      x="36"
      y="27"
      width="6"
      height="4"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
      strokeWidth={0.75}
    />
  </>,
);

// ── PanelScheduleViewHifi — electrical schedule with circuit rows, breaker sizes, header ──
export const PanelScheduleViewHifi = bimIconHifi(
  'PanelScheduleViewHifi',
  <>
    {/* Header band — steel fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.07)' }}
    />

    {/* Schedule body — finish fill */}
    <rect
      x="4"
      y="12"
      width="40"
      height="32"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />

    {/* Outer border */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Header bottom line */}
    <line x1="4" y1="12" x2="44" y2="12" strokeWidth={1.5} />

    {/* Phase column dividers */}
    <line x1="16" y1="4" x2="16" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="28" y1="4" x2="28" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="38" y1="4" x2="38" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Header text — phase labels placeholders */}
    <line x1="6" y1="8" x2="14" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="18" y1="8" x2="26" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="30" y1="8" x2="36" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="39" y1="8" x2="43" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Circuit row separators */}
    <line x1="4" y1="18" x2="44" y2="18" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="24" x2="44" y2="24" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="30" x2="44" y2="30" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Circuit row data — circuit number, load, breaker */}
    <line x1="6" y1="15" x2="14" y2="15" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="15" x2="26" y2="15" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="15" x2="36" y2="15" strokeWidth={0.75} strokeOpacity={0.4} />

    <line x1="6" y1="21" x2="14" y2="21" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="21" x2="25" y2="21" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="21" x2="37" y2="21" strokeWidth={0.75} strokeOpacity={0.4} />

    <line x1="6" y1="27" x2="14" y2="27" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="27" x2="26" y2="27" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="27" x2="35" y2="27" strokeWidth={0.75} strokeOpacity={0.4} />

    <line x1="6" y1="33" x2="14" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="33" x2="27" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="33" x2="36" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Breaker size indicators in last column */}
    <rect x="39" y="13" width="4" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="39" y="19" width="4" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="39" y="25" width="4" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect x="39" y="31" width="4" height="4" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── GraphicalColumnScheduleHifi — building section with elevation bands and column marks ──
export const GraphicalColumnScheduleHifi = bimIconHifi(
  'GraphicalColumnScheduleHifi',
  <>
    {/* Building section silhouette — concrete fill */}
    <rect
      x="8"
      y="4"
      width="32"
      height="36"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={2}
    />

    {/* Elevation level bands — finish fill horizontal strips */}
    <rect
      x="8"
      y="10"
      width="32"
      height="8"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      stroke="none"
    />
    <rect
      x="8"
      y="22"
      width="32"
      height="8"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      stroke="none"
    />

    {/* Elevation level lines */}
    <line x1="4" y1="10" x2="44" y2="10" strokeWidth={1.5} />
    <line x1="4" y1="18" x2="44" y2="18" strokeWidth={1.5} />
    <line x1="4" y1="26" x2="44" y2="26" strokeWidth={1.5} />
    <line x1="4" y1="34" x2="44" y2="34" strokeWidth={1.5} />

    {/* Level datum ticks at left */}
    <line x1="4" y1="10" x2="8" y2="10" strokeWidth={1} />
    <line x1="4" y1="18" x2="8" y2="18" strokeWidth={1} />
    <line x1="4" y1="26" x2="8" y2="26" strokeWidth={1} />
    <line x1="4" y1="34" x2="8" y2="34" strokeWidth={1} />

    {/* Column mark tags along bottom */}
    <rect x="10" y="38" width="6" height="5" rx="1" fill="none" strokeWidth={0.75} />
    <rect x="21" y="38" width="6" height="5" rx="1" fill="none" strokeWidth={0.75} />
    <rect x="32" y="38" width="6" height="5" rx="1" fill="none" strokeWidth={0.75} />

    {/* Column mark label lines */}
    <line x1="11" y1="41" x2="15" y2="41" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="22" y1="41" x2="26" y2="41" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="33" y1="41" x2="37" y2="41" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Vertical column element lines */}
    <line x1="13" y1="4" x2="13" y2="38" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="24" y1="4" x2="24" y2="38" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="35" y1="4" x2="35" y2="38" strokeWidth={1} strokeOpacity={0.4} />
  </>,
);

// ── ViewReferenceHifi — view boundary, reference tag bubble, section mark arrow ──
export const ViewReferenceHifi = bimIconHifi(
  'ViewReferenceHifi',
  <>
    {/* View interior — glass fill */}
    <rect
      x="6"
      y="8"
      width="30"
      height="24"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.07)' }}
    />

    {/* View boundary outline */}
    <rect x="6" y="8" width="30" height="24" strokeWidth={2} />

    {/* View content placeholder lines */}
    <line x1="10" y1="14" x2="32" y2="14" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="10" y1="19" x2="28" y2="19" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="10" y1="24" x2="30" y2="24" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Leader line from view to reference tag */}
    <line x1="36" y1="20" x2="41" y2="20" strokeWidth={1} strokeOpacity={0.6} />

    {/* Reference tag bubble — finish fill */}
    <circle
      cx="41"
      cy="20"
      r="6"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
      strokeWidth={1.5}
    />
    {/* Tag divider line */}
    <line x1="35" y1="20" x2="47" y2="20" strokeWidth={0.75} strokeOpacity={0.5} />
    {/* Tag number placeholder */}
    <line x1="38" y1="17" x2="44" y2="17" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="38" y1="23" x2="44" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Section mark — bold vertical bar at view edge with arrow */}
    <line x1="6" y1="4" x2="6" y2="44" strokeWidth={2.5} />
    {/* Direction arrow pointing right into view */}
    <polygon points="6,14 6,20 12,17" fill="currentColor" stroke="none" />

    {/* Corner crop marks */}
    <line x1="6" y1="8" x2="10" y2="8" strokeWidth={1.5} />
    <line x1="6" y1="32" x2="10" y2="32" strokeWidth={1.5} />
    <line x1="32" y1="8" x2="36" y2="8" strokeWidth={1.5} />
    <line x1="32" y1="32" x2="36" y2="32" strokeWidth={1.5} />
  </>,
);
